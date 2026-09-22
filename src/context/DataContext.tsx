import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onSnapshot, orderBy, query, where, limit } from 'firebase/firestore';
import {
  auditCol, expensesCol, roomsCol, settlementsCol, usersCol,
} from '../services/collections';
import { buildLedger, Ledger } from '../lib/balance';
import { useAuth } from './AuthContext';
import type { AuditEntry, Expense, Room, Settlement, UserProfile } from '../types';

/**
 * Everything the app needs is held in memory and kept live with Firestore
 * snapshot listeners. For a group of friends this is a handful of documents, so
 * there is no pagination, no cache layer and no server: balances recompute
 * locally the instant anyone else saves something.
 */
interface DataValue {
  loading: boolean;
  users: UserProfile[];
  usersById: Record<string, UserProfile>;
  rooms: Room[];
  roomsById: Record<string, Room>;
  expenses: Expense[];
  settlements: Settlement[];
  audit: AuditEntry[];
  ledger: Ledger;
  nameOf: (uid: string) => string;
  roomNameOf: (roomId: string | null) => string;
  /** Everyone except you, active accounts only — the pool you can split with. */
  friends: UserProfile[];
}

const DataContext = createContext<DataValue>(null as unknown as DataValue);

const AUDIT_PAGE = 200;
const EXPENSE_PAGE = 500;

/**
 * All five collections in one state object, tagged with the uid they were
 * fetched for. Tagging lets stale data be *derived away* when the signed-in
 * user changes, rather than cleared by a setState inside an effect — which
 * would cost a whole extra render of the app on every sign-in and sign-out.
 */
interface Store {
  uid: string | null;
  users: UserProfile[];
  rooms: Room[];
  expenses: Expense[];
  settlements: Settlement[];
  audit: AuditEntry[];
  ready: { users: boolean; rooms: boolean; expenses: boolean; settlements: boolean };
}

const EMPTY: Store = {
  uid: null,
  users: [], rooms: [], expenses: [], settlements: [], audit: [],
  ready: { users: false, rooms: false, expenses: false, settlements: false },
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { profile, status } = useAuth();
  const uid = profile?.uid ?? null;

  const [store, setStore] = useState<Store>(EMPTY);

  useEffect(() => {
    if (!uid || status !== 'ready') return;

    // Each listener merges into the store, starting fresh whenever the uid it
    // belongs to differs from what's already held.
    const merge = (patch: Partial<Store>) =>
      setStore((prev) => (prev.uid === uid
        ? { ...prev, ...patch, ready: { ...prev.ready, ...patch.ready } }
        : { ...EMPTY, ...patch, uid, ready: { ...EMPTY.ready, ...patch.ready } }));

    const unsubs = [
      onSnapshot(usersCol(), (snap) => merge({
        // Rows written before a field existed read as the absence of it,
        // not as undefined — every consumer can then treat them alike.
        users: snap.docs.map((d) => ({
          uid: d.id, photoUrl: null, ...d.data(),
        } as UserProfile)),
        ready: { users: true } as Store['ready'],
      })),

      onSnapshot(
        query(roomsCol(), where('memberIds', 'array-contains', uid)),
        (snap) => merge({
          rooms: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Room)),
          ready: { rooms: true } as Store['ready'],
        }),
      ),

      onSnapshot(
        query(
          expensesCol(),
          where('viewerIds', 'array-contains', uid),
          orderBy('date', 'desc'),
          limit(EXPENSE_PAGE),
        ),
        (snap) => merge({
          expenses: snap.docs.map((d) => ({
            id: d.id, receiptUrl: null, ...d.data(),
          } as Expense)),
          ready: { expenses: true } as Store['ready'],
        }),
      ),

      onSnapshot(
        query(settlementsCol(), where('viewerIds', 'array-contains', uid)),
        (snap) => merge({
          // Payments written before rooms owned their own settlements have no
          // roomId. They were recorded against the overall balance, so that is
          // what they stay: a direct debt, belonging to no room.
          settlements: snap.docs.map((d) => ({
            id: d.id, roomId: null, ...d.data(),
          } as Settlement)),
          ready: { settlements: true } as Store['ready'],
        }),
      ),

      onSnapshot(
        query(
          auditCol(),
          where('viewerIds', 'array-contains', uid),
          orderBy('at', 'desc'),
          limit(AUDIT_PAGE),
        ),
        (snap) => merge({
          audit: snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditEntry)),
        }),
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [uid, status]);

  const value = useMemo<DataValue>(() => {
    // Data belonging to a previous session is ignored outright.
    const live = uid && store.uid === uid ? store : EMPTY;

    const usersById: Record<string, UserProfile> = {};
    live.users.forEach((u) => { usersById[u.uid] = u; });

    const roomsById: Record<string, Room> = {};
    live.rooms.forEach((r) => { roomsById[r.id] = r; });

    const liveExpenses = live.expenses.filter((e) => !e.deleted);
    const liveSettlements = live.settlements.filter((s) => !s.deleted);

    return {
      loading: !(live.ready.users && live.ready.rooms && live.ready.expenses && live.ready.settlements),
      users: live.users,
      usersById,
      rooms: [...live.rooms].sort(
        (a, b) => Number(a.archived) - Number(b.archived) || b.updatedAt - a.updatedAt,
      ),
      roomsById,
      expenses: live.expenses,
      settlements: live.settlements,
      audit: live.audit,
      ledger: buildLedger(liveExpenses, liveSettlements),
      nameOf: (id: string) => usersById[id]?.displayName ?? 'Removed member',
      roomNameOf: (roomId: string | null) => (roomId ? roomsById[roomId]?.name ?? 'A room' : 'No room'),
      friends: live.users
        .filter((u) => u.uid !== uid && u.active)
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    };
  }, [store, uid]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}

/**
 * The data context if there is one, otherwise null.
 *
 * `useData()` is the right call inside the app. This exists for shared
 * components — Avatar above all — that want a person's picture when they are
 * rendered inside the app, but must still draw on the login screen, where
 * there is no provider and no session to look anything up in.
 */
export function useDataOptional(): DataValue | null {
  return useContext(DataContext) ?? null;
}
