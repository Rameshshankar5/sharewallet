import { doc, serverTimestamp, type WriteBatch, type Transaction } from 'firebase/firestore';
import { auditCol } from './collections';
import type { AuditAction, ChangeLine } from '../types';

export interface AuditInput {
  action: AuditAction;
  byUid: string;
  byName: string;
  targetId: string;
  targetLabel: string;
  roomId: string | null;
  changes: ChangeLine[];
  viewerIds: string[];
}

/**
 * Audit rows are append-only — firestore.rules forbids update and delete on this
 * collection, so a record of who changed what cannot be quietly rewritten later.
 * That is the whole point of the feature, so it is enforced server-side rather
 * than trusted to the app.
 */
export function writeAudit(batchOrTx: WriteBatch | Transaction, input: AuditInput) {
  const ref = doc(auditCol());
  const payload = {
    ...input,
    at: Date.now(),
    serverAt: serverTimestamp(),
  };
  // WriteBatch and Transaction both expose `set`, but their signatures don't
  // unify, so narrow on `commit`, which only WriteBatch has.
  if ('commit' in batchOrTx) batchOrTx.set(ref, payload);
  else batchOrTx.set(ref, payload);
  return ref;
}
