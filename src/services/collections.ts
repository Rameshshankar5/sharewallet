import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const COL = {
  users: 'users',
  rooms: 'rooms',
  expenses: 'expenses',
  settlements: 'settlements',
  audit: 'audit',
  resetRequests: 'resetRequests',
  connections: 'connections',
  invites: 'invites',
} as const;

export const usersCol = () => collection(db(), COL.users);
export const roomsCol = () => collection(db(), COL.rooms);
export const expensesCol = () => collection(db(), COL.expenses);
export const settlementsCol = () => collection(db(), COL.settlements);
export const auditCol = () => collection(db(), COL.audit);
export const resetRequestsCol = () => collection(db(), COL.resetRequests);
export const connectionsCol = () => collection(db(), COL.connections);
export const invitesCol = () => collection(db(), COL.invites);

export const userDoc = (uid: string) => doc(db(), COL.users, uid);
export const roomDoc = (id: string) => doc(db(), COL.rooms, id);
export const expenseDoc = (id: string) => doc(db(), COL.expenses, id);
export const settlementDoc = (id: string) => doc(db(), COL.settlements, id);
export const inviteDoc = (id: string) => doc(db(), COL.invites, id);

/** One row per pair, whichever of the two is asking. */
export function pairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}
export const connectionDoc = (a: string, b: string) => doc(db(), COL.connections, pairId(a, b));

/** Keyed by the lowercased email, so one person leaves one request. */
export const resetRequestDoc = (email: string) => doc(db(), COL.resetRequests, email);
