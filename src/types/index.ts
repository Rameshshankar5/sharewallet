import type { CentMap, SplitMode } from '../lib/split';

export type Role = 'superadmin' | 'member';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  /** Set when the superadmin creates the account; cleared once they pick their own. */
  mustChangePassword: boolean;
  createdAt: number;
  createdBy: string | null;
}

export interface Room {
  id: string;
  name: string;
  /** Lucide icon name rendered from our curated set — never an emoji. */
  icon: string;
  memberIds: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
}

export type ExpenseCategory =
  | 'general' | 'food' | 'travel' | 'stay' | 'shopping'
  | 'bills' | 'fuel' | 'entertainment' | 'health';

export interface Expense {
  id: string;
  /** null = a direct expense between the participants, not tied to a room. */
  roomId: string | null;
  description: string;
  note: string;
  category: ExpenseCategory;
  /** Integer cents. Always equals sum(payers) and sum(splits). */
  totalCents: number;
  /** uid -> cents actually paid out of pocket. */
  payers: CentMap;
  /** uid -> cents owed for their share. */
  splits: CentMap;
  splitMode: SplitMode;
  /** Payers ∪ splits. Drives per-person balances. */
  participantIds: string[];
  /** participantIds ∪ room members. Drives read access and queries. */
  viewerIds: string[];
  /** Epoch ms of when the money was spent (not when the row was created). */
  date: number;
  createdBy: string;
  createdAt: number;
  updatedBy: string;
  updatedAt: number;
  /** Bumped on every save; used to detect two people editing at once. */
  version: number;
  deleted: boolean;
}

export interface Settlement {
  id: string;
  /** Person handing over the cash. */
  fromUid: string;
  /** Person receiving it. */
  toUid: string;
  amount: number;
  note: string;
  participantIds: string[];
  viewerIds: string[];
  date: number;
  createdBy: string;
  createdAt: number;
  deleted: boolean;
}

/** One human-readable line in the audit trail. */
export interface ChangeLine {
  /** Machine key, e.g. "split:abc123" — lets the UI group related lines. */
  field: string;
  label: string;
  before: string | null;
  after: string | null;
  kind: 'added' | 'removed' | 'changed';
}

export type AuditAction =
  | 'expense.create' | 'expense.update' | 'expense.delete' | 'expense.restore'
  | 'settlement.create' | 'settlement.delete'
  | 'room.create' | 'room.update' | 'room.members'
  | 'user.create' | 'user.update';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  byUid: string;
  /** Snapshotted so the log still reads correctly if a name changes later. */
  byName: string;
  at: number;
  targetId: string;
  targetLabel: string;
  roomId: string | null;
  changes: ChangeLine[];
  viewerIds: string[];
}
