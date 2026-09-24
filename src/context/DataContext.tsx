import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onSnapshot, orderBy, query, where, limit } from 'firebase/firestore';
import {
  auditCol, connectionsCol, expensesCol, roomsCol, settlementsCol, userDoc, usersCol,
} from '../services/collections';
import { otherMember } from '../services/connections';
import { useRoomSync } from '../hooks/useRoomSync';
import { retrying } from '../services/retrying';
import { readSnapshot, writeSnapshot, type DataSnapshot } from '../services/dataCache';
import { buildLedger, Ledger } from '../lib/balance';
import { useAuth } from './AuthContext';
import type { AuditEntry, Connection, Expense, Room, Settlement, UserProfile } from '../types';

/**
 * Everything the app needs is held in memory and kept live with Firestore
 * snapshot listeners. For a group of friends this is a handful of documents, so
 * there is no pagination and no server: balances recompute locally the instant
 * anyone else saves something.
 *
 * Until the live data arrives, the app shows the copy saved on the phone at
 * the end of the last session (services/dataCache.ts), with `refreshing` set.
 */
interface DataValue {
  /** Nothing to show yet: no live data and no saved copy either. */
  loading: boolean;
  /** Showing the saved copy while the live data is still on its way. */
  refreshing: boolean;
  /**
   * Every profile this person can see: themselves and their connections — or,
   * for the superadmin, everybody.
   */
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
  /** The people you are connected to, active accounts only — the pool you can split with. */
  friends: UserProfile[];
  /** uids you are connected to, whether or not their profile has loaded yet. */
  connectedIds: string[];
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
  /** Everyone, for the superadmin; unused otherwise. */
  users: UserProfile[];
  connections: Connection[];
  rooms: Room[];
  expenses: Expense[];
  settlements: Settlement[];
  audit: AuditEntry[];
  ready: { users: boolean; rooms: boolean; expenses: boolean; settlements: boolean };
}

const EMPTY: Store = {
  uid: null,
  users: [], connections: [], rooms: [], expenses: [], settlements: [], audit: [],
  ready: { users: false, rooms: false, expenses: false, settlements: false },
};

/** Rows written before a field existed read as the absence of it. */
function toProfile(id: string, data: object): UserProfile {
  return { uid: id, photoUrl: null, pushTokens: [], ...data } as unknown as UserProfile;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { profile, status, user } = useAuth();
  const uid = profile?.uid ?? null;
  const isAdmin = profile?.role === 'superadmin';
  // The app may open on a saved profile before Firebase Auth has restored the
  // session. Listeners wait for the real session: started earlier, they would
  // be refused as signed out and back off for seconds before retrying.
  const online = status === 'ready' && !!user && user.uid === uid;

  const [saved, setSaved] = useState<{ uid: string; data: DataSnapshot | null } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void readSnapshot(uid).then((data) => { if (!cancelled) setSaved({ uid, data }); });
    return () => { cancelled = true; };
  }, [uid]);
  const snapshot = saved?.uid === uid ? saved.data : null;

  const [store, setStore] = useState<Store>(EMPTY);
  /**
   * Everything in each of your rooms, whenever it was added. The viewer-based
   * queries above only find rows you were on when they were written; these
   * are what give somebody who joined later the room's whole history.
   */
  const [roomRows, setRoomRows] = useState<{
    uid: string | null;
    byRoom: Record<string, { expenses?: Expense[]; settlements?: Settlement[]; audit?: AuditEntry[] }>;
  }>({ uid: null, byRoom: {} });
  /** Profiles of connections, fetched one by one: only the admin may list. */
  const [people, setPeople] = useState<{ uid: string | null; byId: Record<string, UserProfile> }>(
    { uid: null, byId: {} },
  );

  useEffect(() => {
    if (!uid || !online) return;

    // Each listener merges into the store, starting fresh whenever the uid it
    // belongs to differs from what's already held.
    const merge = (patch: Partial<Store>) =>
      setStore((prev) => (prev.uid === uid
        ? { ...prev, ...patch, ready: { ...prev.ready, ...patch.ready } }
        : { ...EMPTY, ...patch, uid, ready: { ...EMPTY.ready, ...patch.ready } }));

    const unsubs = [
      // The connection list is what everybody else's visibility hangs off.
      // It also decides when "users" is ready for anyone but the admin.
      //
      // Only connections the server has confirmed count. One just written on
      // this phone shows up locally first, and reading the other person's
      // profile on the strength of it is refused until the server has it.
      retrying((fail) => onSnapshot(
        query(connectionsCol(), where('memberIds', 'array-contains', uid)),
        { includeMetadataChanges: true },
        (snap) => merge({
          connections: snap.docs
            .filter((d) => !d.metadata.hasPendingWrites)
            .map((d) => ({ id: d.id, ...d.data() } as Connection)),
          ...(isAdmin ? {} : { ready: { users: true } as Store['ready'] }),
        }),
        fail,
      )),

      retrying((fail) => onSnapshot(
        query(roomsCol(), where('memberIds', 'array-contains', uid)),
        (snap) => merge({
          rooms: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Room)),
          ready: { rooms: true } as Store['ready'],
        }),
        fail,
      )),

      retrying((fail) => onSnapshot(
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
        fail,
      )),

      retrying((fail) => onSnapshot(
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
        fail,
      )),

      retrying((fail) => onSnapshot(
        query(
          auditCol(),
          where('viewerIds', 'array-contains', uid),
          orderBy('at', 'desc'),
          limit(AUDIT_PAGE),
        ),
        (snap) => merge({
          audit: snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditEntry)),
        }),
        fail,
      )),
    ];

    if (isAdmin) {
      unsubs.push(retrying((fail) => onSnapshot(usersCol(), (snap) => merge({
        users: snap.docs.map((d) => toProfile(d.id, d.data())),
        ready: { users: true } as Store['ready'],
      }), fail)));
    }

    return () => unsubs.forEach((u) => u());
  }, [uid, online, isAdmin]);

  // Data belonging to a previous session is ignored outright.
  const live = uid && store.uid === uid ? store : EMPTY;

  const roomKey = useMemo(
    () => live.rooms.map((r) => r.id).sort().join(','),
    [live.rooms],
  );

  useEffect(() => {
    if (!uid || !online || !roomKey) return;
    const put = (roomId: string, patch: Partial<Record<'expenses' | 'settlements' | 'audit', unknown[]>>) =>
      setRoomRows((prev) => {
        const byRoom = prev.uid === uid ? { ...prev.byRoom } : {};
        byRoom[roomId] = { ...byRoom[roomId], ...patch } as (typeof byRoom)[string];
        return { uid, byRoom };
      });
    const unsubs = roomKey.split(',').flatMap((roomId) => [
      retrying((fail) => onSnapshot(
        query(expensesCol(), where('roomId', '==', roomId)),
        (snap) => put(roomId, {
          expenses: snap.docs.map((d) => ({ id: d.id, receiptUrl: null, ...d.data() } as Expense)),
        }),
        fail,
      )),
      retrying((fail) => onSnapshot(
        query(settlementsCol(), where('roomId', '==', roomId)),
        (snap) => put(roomId, {
          settlements: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Settlement)),
        }),
        fail,
      )),
      retrying((fail) => onSnapshot(
        query(auditCol(), where('roomId', '==', roomId)),
        (snap) => put(roomId, {
          audit: snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditEntry)),
        }),
        fail,
      )),
    ]);
    return () => unsubs.forEach((u) => u());
  }, [uid, online, roomKey]);

  // One listener per connection. Keyed on the sorted list so it only
  // resubscribes when somebody is actually added.
  const connectedIds = useMemo(
    () => Array.from(new Set(live.connections
      .map((conn) => otherMember(conn.memberIds, uid ?? ''))
      .filter((x): x is string => !!x))).sort(),
    [live.connections, uid],
  );
  const connectedKey = connectedIds.join(',');

  useEffect(() => {
    if (!uid || !online || isAdmin) return;
    const ids = connectedKey ? connectedKey.split(',') : [];
    const unsubs = ids.map((id) => retrying((fail) => onSnapshot(
      userDoc(id),
      (snap) => setPeople((prev) => {
        const byId = prev.uid === uid ? { ...prev.byId } : {};
        if (snap.exists()) byId[id] = toProfile(snap.id, snap.data());
        else delete byId[id];
        return { uid, byId };
      }),
      fail,
    )));
    return () => unsubs.forEach((u) => u());
  }, [uid, online, isAdmin, connectedKey]);

  const liveLoading = !(live.ready.users && live.ready.rooms
    && live.ready.expenses && live.ready.settlements);
  // While live data is on its way, the saved copy stands in for it.
  const fromSaved = liveLoading && !!snapshot;

  const value = useMemo<DataValue>(() => {
    const usersById: Record<string, UserProfile> = {};
    // Saved profiles first, live ones over the top: a friend's name shows from
    // the first frame instead of flickering through "Removed member".
    snapshot?.users.forEach((u) => { usersById[u.uid] = u; });
    if (isAdmin) {
      live.users.forEach((u) => { usersById[u.uid] = u; });
    } else if (people.uid === uid) {
      Object.values(people.byId).forEach((u) => { usersById[u.uid] = u; });
    }
    if (profile) usersById[profile.uid] = profile;
    const users = Object.values(usersById);
    const connectedList = fromSaved ? snapshot!.connectedIds : connectedIds;
    const connected = new Set(connectedList);

    const liveRooms = fromSaved ? snapshot!.rooms : live.rooms;
    const roomsById: Record<string, Room> = {};
    liveRooms.forEach((r) => { roomsById[r.id] = r; });

    // Your own rows plus every room's, each once. A room you have left
    // stops contributing, but rows you were on stay through the first query.
    const rooms = roomRows.uid === uid ? roomRows.byRoom : {};
    const inRooms = Object.entries(rooms).filter(([id]) => roomsById[id]).map(([, v]) => v);
    const union = <T extends { id: string }>(own: T[], extra: (T[] | undefined)[]): T[] => {
      const byId = new Map(own.map((r) => [r.id, r]));
      extra.forEach((list) => list?.forEach((r) => byId.set(r.id, r)));
      return [...byId.values()];
    };
    const expenses = fromSaved
      ? snapshot!.expenses
      : union(live.expenses, inRooms.map((r) => r.expenses)).sort((a, b) => b.date - a.date);
    const settlements = fromSaved
      ? snapshot!.settlements
      : union(live.settlements, inRooms.map((r) => r.settlements));
    const audit = fromSaved
      ? snapshot!.audit
      : union(live.audit, inRooms.map((r) => r.audit)).sort((a, b) => b.at - a.at);

    const liveExpenses = expenses.filter((e) => !e.deleted);
    const liveSettlements = settlements.filter((s) => !s.deleted);

    return {
      loading: liveLoading && !fromSaved,
      refreshing: fromSaved,
      users,
      usersById,
      rooms: [...liveRooms].sort(
        (a, b) => Number(a.archived) - Number(b.archived) || b.updatedAt - a.updatedAt,
      ),
      roomsById,
      expenses,
      settlements,
      audit,
      ledger: buildLedger(liveExpenses, liveSettlements),
      nameOf: (id: string) => usersById[id]?.displayName ?? 'Removed member',
      roomNameOf: (roomId: string | null) => (roomId ? roomsById[roomId]?.name ?? 'A room' : 'No room'),
      friends: users
        .filter((u) => connected.has(u.uid) && u.active)
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      connectedIds: connectedList,
    };
  }, [live, uid, isAdmin, people, profile, connectedIds, roomRows, snapshot, fromSaved, liveLoading]);

  // Only live data may trigger writes; the saved copy could be out of date.
  useRoomSync(uid, liveLoading ? null : value);

  // Save what is on screen once it is live, for the next launch to open on.
  // Debounced: a burst of snapshots on arrival should write once, not ten times.
  useEffect(() => {
    if (!uid || liveLoading) return;
    const t = setTimeout(() => {
      void writeSnapshot(uid, {
        users: value.users,
        connectedIds: value.connectedIds,
        rooms: value.rooms,
        expenses: value.expenses,
        settlements: value.settlements,
        audit: value.audit,
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [uid, liveLoading, value]);

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
