import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuditEntry, Expense, Room, Settlement, UserProfile } from '../types';

/**
 * The last data this phone saw, so the app can open on it.
 *
 * Firestore's own offline cache needs IndexedDB, which React Native does not
 * have, so without this every launch waits out a full connection to Firebase —
 * five seconds or more on a slow network — before showing a single number.
 * With it, the app opens on what it knew last time and updates in place when
 * the live data lands.
 *
 * It is a picture, not a source of truth. Nothing is written from it; every
 * change still goes through Firestore and its rules. It is kept per account
 * and deleted on sign-out, so nobody signing in on this phone next sees it.
 */

/** Bump when the shape changes; an old snapshot is then ignored. */
const VERSION = 1;

/** Enough for months of history without the file growing without limit. */
const MAX_AUDIT = 200;

export interface DataSnapshot {
  users: UserProfile[];
  connectedIds: string[];
  rooms: Room[];
  expenses: Expense[];
  settlements: Settlement[];
  audit: AuditEntry[];
}

interface Stored extends DataSnapshot {
  v: number;
  uid: string;
  savedAt: number;
}

const key = (uid: string) => `sharewallet.data.${uid}`;

/** The uid of whoever last had the app open, to start on before Auth replies. */
export const LAST_UID_KEY = 'sharewallet.lastUid';

export async function readSnapshot(uid: string): Promise<DataSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.v !== VERSION || parsed.uid !== uid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeSnapshot(uid: string, snap: DataSnapshot): Promise<void> {
  const stored: Stored = {
    ...snap,
    audit: snap.audit.slice(0, MAX_AUDIT),
    v: VERSION,
    uid,
    savedAt: Date.now(),
  };
  await AsyncStorage.setItem(key(uid), JSON.stringify(stored)).catch(() => {});
}

export async function clearSnapshot(uid: string): Promise<void> {
  await AsyncStorage.multiRemove([key(uid), LAST_UID_KEY]).catch(() => {});
}
