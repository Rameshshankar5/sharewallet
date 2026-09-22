import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { settlementsCol, settlementDoc } from './collections';
import { writeAudit } from './audit';
import { formatMoney } from '../lib/money';
import type { Settlement, UserProfile } from '../types';

export interface SettlementInput {
  fromUid: string;
  toUid: string;
  amount: number;
  note: string;
  date: number;
  /**
   * Everyone who should see this payment, beyond the two people involved:
   * the members of every room they are both in.
   *
   * Room balances are worked out on each phone from the payments it can read.
   * If a payment were private, other members would compute a different balance
   * for the same room — so visibility follows the rooms rather than being a
   * question put to whoever records it.
   */
  alsoVisibleTo: string[];
}

export async function recordSettlement(
  input: SettlementInput,
  actor: UserProfile,
  nameOf: (uid: string) => string,
): Promise<string> {
  if (input.amount <= 0) throw new Error('Enter an amount greater than zero.');
  if (input.fromUid === input.toUid) throw new Error('Pick two different people.');

  const participantIds = [input.fromUid, input.toUid].sort();
  const viewers = new Set(participantIds);
  viewers.add(actor.uid);
  input.alsoVisibleTo.forEach((uid) => viewers.add(uid));
  const viewerIds = Array.from(viewers).sort();

  const ref = doc(settlementsCol());
  const settlement: Omit<Settlement, 'id'> = {
    fromUid: input.fromUid,
    toUid: input.toUid,
    amount: input.amount,
    note: input.note.trim(),
    participantIds,
    viewerIds,
    date: input.date,
    createdBy: actor.uid,
    createdAt: Date.now(),
    deleted: false,
  };

  const label = `${nameOf(input.fromUid)} paid ${nameOf(input.toUid)} ${formatMoney(input.amount)}`;

  const batch = writeBatch(db());
  batch.set(ref, settlement);
  writeAudit(batch, {
    action: 'settlement.create',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: ref.id,
    targetLabel: label,
    roomId: null,
    viewerIds,
    changes: [{
      field: 'settlement', kind: 'added', label,
      before: null, after: formatMoney(input.amount),
    }],
  });
  await batch.commit();
  return ref.id;
}

export async function deleteSettlement(
  settlement: Settlement,
  actor: UserProfile,
  nameOf: (uid: string) => string,
) {
  const batch = writeBatch(db());
  batch.update(settlementDoc(settlement.id), { deleted: true });
  writeAudit(batch, {
    action: 'settlement.delete',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: settlement.id,
    targetLabel: 'Payment removed',
    roomId: null,
    viewerIds: settlement.viewerIds,
    changes: [{
      field: 'settlement', kind: 'removed',
      label: `Removed payment: ${nameOf(settlement.fromUid)} -> ${nameOf(settlement.toUid)}`,
      before: formatMoney(settlement.amount), after: null,
    }],
  });
  await batch.commit();
}
