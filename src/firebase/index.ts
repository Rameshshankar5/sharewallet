import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as fbAuth from 'firebase/auth';
import { initializeFirestore, getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig, isConfigured } from './config';

const PRIMARY = '[DEFAULT]';
/** Used only by the superadmin to mint accounts without losing their own session. */
const SECONDARY = 'admin-worker';

function makeApp(name: string): FirebaseApp {
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  return name === PRIMARY
    ? initializeApp(firebaseConfig)
    : initializeApp(firebaseConfig, name);
}

/**
 * React Native has no browser storage, so Firebase Auth needs AsyncStorage to
 * keep people signed in across app restarts. `getReactNativePersistence` only
 * exists in the SDK's React Native build, so we look it up defensively and fall
 * back to the default (in-memory) rather than crashing on web.
 */
function makeAuth(app: FirebaseApp, persist: boolean): fbAuth.Auth {
  const getRNPersistence = (fbAuth as unknown as {
    getReactNativePersistence?: (s: unknown) => fbAuth.Persistence;
  }).getReactNativePersistence;

  try {
    if (persist && getRNPersistence) {
      return fbAuth.initializeAuth(app, { persistence: getRNPersistence(AsyncStorage) });
    }
    // The secondary app must NOT persist — it signs a brand-new user in for a
    // moment while creating them, and we don't want that overwriting the
    // superadmin's stored session.
    return fbAuth.initializeAuth(app, { persistence: fbAuth.inMemoryPersistence });
  } catch {
    // initializeAuth throws if it already ran (Fast Refresh) — reuse it.
    return fbAuth.getAuth(app);
  }
}

let _app: FirebaseApp | null = null;
let _auth: fbAuth.Auth | null = null;
let _db: Firestore | null = null;

export function app(): FirebaseApp {
  if (!_app) _app = makeApp(PRIMARY);
  return _app;
}

export function auth(): fbAuth.Auth {
  if (!_auth) _auth = makeAuth(app(), true);
  return _auth;
}

export function db(): Firestore {
  if (!_db) {
    try {
      // React Native cannot use the streaming WebChannel transport the SDK
      // prefers, so we force long polling. Without this, snapshots silently
      // stall on some Android networks.
      _db = initializeFirestore(app(), { experimentalForceLongPolling: true });
    } catch {
      _db = getFirestore(app());
    }
  }
  return _db;
}

/** A throwaway auth instance for admin-side account creation. */
export function adminWorkerAuth(): fbAuth.Auth {
  const workerApp = makeApp(SECONDARY);
  return makeAuth(workerApp, false);
}

export { isConfigured };
