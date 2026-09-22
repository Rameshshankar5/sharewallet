import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const COL = {
  users: 'users',
  rooms: 'rooms',
  expenses: 'expenses',
  settlements: 'settlements',
  audit: 'audit',
  resetRequests: 'resetRequests',
} as const;

export const usersCol = () => collection(db(), COL.users);
export const roomsCol = () => collection(db(), COL.rooms);
export const expensesCol = () => collection(db(), COL.expenses);
export const settlementsCol = () => collection(db(), COL.settlements);
export const auditCol = () => collection(db(), COL.audit);
export const resetRequestsCol = () => collection(db(), COL.resetRequests);

export const userDoc = (uid: string) => doc(db(), COL.users, uid);
export const roomDoc = (id: string) => doc(db(), COL.rooms, id);
export const expenseDoc = (id: string) => doc(db(), COL.expenses, id);
export const settlementDoc = (id: string) => doc(db(), COL.settlements, id);

/** Keyed by the lowercased email, so one person leaves one request. */
export const resetRequestDoc = (email: string) => doc(db(), COL.resetRequests, email);
