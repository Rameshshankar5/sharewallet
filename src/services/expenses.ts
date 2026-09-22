import { doc, getDoc, runTransaction, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { expensesCol, expenseDoc, roomDoc } from './collections';
import { writeAudit } from './audit';
import { diffExpense, draftFromExpense, type ExpenseDraft } from '../lib/diff';
import { sumMap } from '../lib/split';
import { formatMoney } from '../lib/money';
import type { Expense, ExpenseCategory, UserProfile } from '../types';
import type { SplitMode } from '../lib/split';

/** Thrown when someone else saved the same expense while this edit was open. */
export class ConflictError extends Error {
  constructor(public readonly latest: Expense) {
    super('This expense was changed by someone else while you were editing.');
    this.name = 'ConflictError';
  }
}

export class UnbalancedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnbalancedError';
  }
}

export interface SaveExpenseInput extends ExpenseDraft {
  category: ExpenseCategory;
  splitMode: SplitMode;
}

/**
 * The rule you asked for: an expense is only storable when the money balances
 * in BOTH directions — what everyone paid adds up to the total, and what
 * everyone owes adds up to the same total. We check it here as well as in the
 * UI, so a stale screen or a race can never write a broken row.
 */
function assertBalanced(input: SaveExpenseInput) {
  if (input.totalCents <= 0) {
    throw new UnbalancedError('Enter a total amount greater than zero.');
  }
  const paid = sumMap(input.payers);
  if (paid !== input.totalCents) {
    const diff = input.totalCents - paid;
    throw new UnbalancedError(
      diff > 0
        ? `Who paid is short by ${formatMoney(diff)}.`
        : `Who paid is over by ${formatMoney(-diff)}.`,
    );
  }
  const owed = sumMap(input.splits);
  if (owed !== input.totalCents) {
    const diff = input.totalCents - owed;
    throw new UnbalancedError(
      diff > 0
        ? `The split is short by ${formatMoney(diff)}.`
        : `The split is over by ${formatMoney(-diff)}.`,
    );
  }
}

function participantsOf(input: SaveExpenseInput): string[] {
  const ids = new Set<string>();
  for (const k in input.payers) if (input.payers[k] !== 0) ids.add(k);
  for (const k in input.splits) if (input.splits[k] !== 0) ids.add(k);
  return Array.from(ids).sort();
}

async function viewersFor(
  participantIds: string[],
  roomId: string | null,
  actorUid: string,
): Promise<string[]> {
  const ids = new Set(participantIds);
  // The person recording the expense can always see it, even when they aren't
  // splitting it themselves — otherwise they'd write a row they can't read.
  ids.add(actorUid);
  if (roomId) {
    const snap = await getDoc(roomDoc(roomId));
    const members: string[] = snap.exists() ? (snap.data().memberIds ?? []) : [];
    members.forEach((m) => ids.add(m));
  }
  return Array.from(ids).sort();
}

export async function createExpense(
  input: SaveExpenseInput,
  actor: UserProfile,
  nameOf: (uid: string) => string,
): Promise<string> {
  assertBalanced(input);

  const participantIds = participantsOf(input);
  if (participantIds.length === 0) {
    throw new UnbalancedError('Pick at least one person to split with.');
  }
  const viewerIds = await viewersFor(participantIds, input.roomId, actor.uid);

  const ref = doc(expensesCol());
  const now = Date.now();
  const expense: Omit<Expense, 'id'> = {
    roomId: input.roomId,
    description: input.description.trim(),
    note: input.note.trim(),
    category: input.category,
    totalCents: input.totalCents,
    payers: input.payers,
    splits: input.splits,
    splitMode: input.splitMode,
    participantIds,
    viewerIds,
    date: input.date,
    createdBy: actor.uid,
    createdAt: now,
    updatedBy: actor.uid,
    updatedAt: now,
    version: 1,
    deleted: false,
  };

  const batch = writeBatch(db());
  batch.set(ref, expense);
  writeAudit(batch, {
    action: 'expense.create',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: ref.id,
    targetLabel: expense.description,
    roomId: expense.roomId,
    viewerIds,
    changes: [
      {
        field: 'created', kind: 'added',
        label: `Added "${expense.description}" for ${formatMoney(expense.totalCents)}`,
        before: null, after: formatMoney(expense.totalCents),
      },
      ...participantIds.map((uid) => ({
        field: `split:${uid}`,
        kind: 'added' as const,
        label: `${nameOf(uid)} owes`,
        before: null,
        after: formatMoney(input.splits[uid] ?? 0),
      })),
    ],
  });
  await batch.commit();
  return ref.id;
}

export async function updateExpense(
  id: string,
  expectedVersion: number,
  input: SaveExpenseInput,
  actor: UserProfile,
  nameOf: (uid: string) => string,
  roomNameOf: (roomId: string | null) => string,
): Promise<void> {
  assertBalanced(input);

  const participantIds = participantsOf(input);
  if (participantIds.length === 0) {
    throw new UnbalancedError('Pick at least one person to split with.');
  }
  const viewerIds = await viewersFor(participantIds, input.roomId, actor.uid);

  await runTransaction(db(), async (tx) => {
    const ref = expenseDoc(id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This expense no longer exists.');

    const current = { id: snap.id, ...(snap.data() as Omit<Expense, 'id'>) };

    // Two people editing the same expense is exactly the scenario this app
    // exists to make visible, so we refuse the blind overwrite and let the UI
    // show what changed underneath.
    if (current.version !== expectedVersion) throw new ConflictError(current);

    const before = draftFromExpense(current);
    const after: ExpenseDraft = {
      description: input.description.trim(),
      note: input.note.trim(),
      category: input.category,
      totalCents: input.totalCents,
      payers: input.payers,
      splits: input.splits,
      roomId: input.roomId,
      date: input.date,
    };

    const changes = diffExpense(before, after, nameOf, roomNameOf);
    if (changes.length === 0) return; // Nothing moved — don't pollute the log.

    tx.update(ref, {
      ...after,
      description: after.description,
      category: input.category,
      splitMode: input.splitMode,
      participantIds,
      viewerIds,
      updatedBy: actor.uid,
      updatedAt: Date.now(),
      version: current.version + 1,
    });

    writeAudit(tx, {
      action: 'expense.update',
      byUid: actor.uid,
      byName: actor.displayName,
      targetId: id,
      targetLabel: after.description,
      roomId: after.roomId,
      // Anyone who could see it before still needs to see that it changed.
      viewerIds: Array.from(new Set([...viewerIds, ...current.viewerIds])).sort(),
      changes,
    });
  });
}

/**
 * Expenses are never hard-deleted. A removed expense still has to be
 * explainable later — "where did that Rs 4,000 go?" — so we flag it and keep
 * the row and its history.
 */
export async function setExpenseDeleted(
  expense: Expense,
  deleted: boolean,
  actor: UserProfile,
) {
  const batch = writeBatch(db());
  batch.update(expenseDoc(expense.id), {
    deleted,
    updatedBy: actor.uid,
    updatedAt: Date.now(),
    version: expense.version + 1,
  });
  writeAudit(batch, {
    action: deleted ? 'expense.delete' : 'expense.restore',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: expense.id,
    targetLabel: expense.description,
    roomId: expense.roomId,
    viewerIds: expense.viewerIds,
    changes: [{
      field: 'deleted',
      kind: deleted ? 'removed' : 'added',
      label: deleted
        ? `Deleted "${expense.description}" (${formatMoney(expense.totalCents)})`
        : `Restored "${expense.description}"`,
      before: deleted ? formatMoney(expense.totalCents) : null,
      after: deleted ? null : formatMoney(expense.totalCents),
    }],
  });
  await batch.commit();
}
