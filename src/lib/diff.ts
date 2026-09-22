/**
 * Change detection for the audit trail.
 *
 * The point of this file is the thing you asked for: if someone quietly edits
 * their own share, everyone else can see exactly what moved, from what, to what.
 * So we diff at field level — including per-person payer and split amounts —
 * rather than storing "expense updated".
 */

import { formatMoney } from './money';
import type { CentMap } from './split';
import type { ChangeLine, Expense } from '../types';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General', food: 'Food & drink', travel: 'Travel', stay: 'Stay',
  shopping: 'Shopping', bills: 'Bills', fuel: 'Fuel',
  entertainment: 'Entertainment', health: 'Health',
};

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Draft shape shared by the create and edit screens. */
export interface ExpenseDraft {
  description: string;
  note: string;
  category: string;
  totalCents: number;
  payers: CentMap;
  splits: CentMap;
  roomId: string | null;
  receiptUrl: string | null;
  date: number;
}

function diffCentMaps(
  before: CentMap,
  after: CentMap,
  nameOf: (uid: string) => string,
  prefix: string,
  verb: string,
): ChangeLine[] {
  const lines: ChangeLine[] = [];
  const ids = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  for (const uid of ids) {
    const b = before[uid] ?? null;
    const a = after[uid] ?? null;
    if (b === a) continue;

    const name = nameOf(uid);
    if (b === null) {
      lines.push({
        field: `${prefix}:${uid}`, kind: 'added',
        label: `${name} added — ${verb} ${formatMoney(a as number)}`,
        before: null, after: formatMoney(a as number),
      });
    } else if (a === null) {
      lines.push({
        field: `${prefix}:${uid}`, kind: 'removed',
        label: `${name} removed — was ${verb} ${formatMoney(b)}`,
        before: formatMoney(b), after: null,
      });
    } else {
      lines.push({
        field: `${prefix}:${uid}`, kind: 'changed',
        label: `${name} ${verb}`,
        before: formatMoney(b), after: formatMoney(a),
      });
    }
  }
  return lines;
}

export function diffExpense(
  before: ExpenseDraft,
  after: ExpenseDraft,
  nameOf: (uid: string) => string,
  roomNameOf: (id: string | null) => string,
): ChangeLine[] {
  const lines: ChangeLine[] = [];

  if (before.description !== after.description) {
    lines.push({
      field: 'description', kind: 'changed', label: 'Description',
      before: before.description, after: after.description,
    });
  }

  if (before.totalCents !== after.totalCents) {
    lines.push({
      field: 'totalCents', kind: 'changed', label: 'Total amount',
      before: formatMoney(before.totalCents), after: formatMoney(after.totalCents),
    });
  }

  if (before.category !== after.category) {
    lines.push({
      field: 'category', kind: 'changed', label: 'Category',
      before: CATEGORY_LABELS[before.category] ?? before.category,
      after: CATEGORY_LABELS[after.category] ?? after.category,
    });
  }

  if (before.date !== after.date) {
    lines.push({
      field: 'date', kind: 'changed', label: 'Date',
      before: formatDate(before.date), after: formatDate(after.date),
    });
  }

  if (before.roomId !== after.roomId) {
    lines.push({
      field: 'roomId', kind: 'changed', label: 'Room',
      before: roomNameOf(before.roomId), after: roomNameOf(after.roomId),
    });
  }

  if ((before.receiptUrl || null) !== (after.receiptUrl || null)) {
    // The URL itself would be noise in a log people actually read.
    lines.push({
      field: 'receiptUrl',
      kind: !before.receiptUrl ? 'added' : !after.receiptUrl ? 'removed' : 'changed',
      label: 'Receipt photo',
      before: before.receiptUrl ? 'Attached' : null,
      after: after.receiptUrl ? 'Attached' : null,
    });
  }

  if ((before.note || '') !== (after.note || '')) {
    lines.push({
      field: 'note', kind: 'changed', label: 'Note',
      before: before.note || '—', after: after.note || '—',
    });
  }

  lines.push(...diffCentMaps(before.payers, after.payers, nameOf, 'paid', 'paid'));
  lines.push(...diffCentMaps(before.splits, after.splits, nameOf, 'split', 'owes'));

  return lines;
}

export function draftFromExpense(e: Expense): ExpenseDraft {
  return {
    description: e.description,
    note: e.note,
    category: e.category,
    totalCents: e.totalCents,
    payers: { ...e.payers },
    splits: { ...e.splits },
    roomId: e.roomId,
    receiptUrl: e.receiptUrl ?? null,
    date: e.date,
  };
}

/** One-line summary for the activity feed, e.g. "Total amount, Kasun owes". */
export function summarizeChanges(changes: ChangeLine[]): string {
  if (changes.length === 0) return 'No visible changes';
  const labels = changes.slice(0, 3).map((c) => c.label);
  const extra = changes.length - labels.length;
  return labels.join(' · ') + (extra > 0 ? ` · +${extra} more` : '');
}
