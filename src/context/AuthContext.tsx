import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unregisterFromPush } from '../services/push';
import { auth, isConfigured } from '../firebase';
import { userDoc } from '../services/collections';
import type { UserProfile } from '../types';

export type AuthStatus =
  | 'booting'        // restoring the saved session
  | 'unconfigured'   // .env not filled in yet
  | 'signedOut'
  | 'noProfile'      // authenticated, but the superadmin hasn't granted access
  | 'mustChangePassword'
  | 'disabled'       // account switched off by the superadmin
  | 'ready';

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  profile: UserProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Non-null when the last sign-in attempt failed. */
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthValue>(null as unknown as AuthValue);

/** Firebase error codes are machine-readable; people are not. */
function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'That email address does not look right.';
    case 'auth/user-disabled': return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Email or password is incorrect.';
    case 'auth/too-many-requests': return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed': return 'No connection. Check your internet and retry.';
    case 'auth/email-already-in-use': return 'An account already uses that email.';
    case 'auth/weak-password': return 'Use a password of at least 6 characters.';
    default: return 'Could not sign in. Please try again.';
  }
}

/** What Firebase Auth has told us so far. `resolved` flips once, at first reply. */
interface Session {
  resolved: boolean;
  user: User | null;
}

/**
 * The profile snapshot, tagged with the uid it belongs to. Tagging lets us
 * *derive* "there is no profile for the current user" instead of clearing state
 * inside an effect — which would cost an extra render pass on every sign-in and
 * sign-out.
 */
interface ProfileSnapshot {
  uid: string | null;
  profile: UserProfile | null;
  loaded: boolean;
}

const NO_PROFILE: ProfileSnapshot = { uid: null, profile: null, loaded: false };

const profileKey = (uid: string) => `sharewallet.profile.${uid}`;

/**
 * The last profile seen for this account, kept on the phone.
 *
 * Without it, every launch sits on "Signing you in…" until a Firestore round
 * trip completes — the session itself is restored locally and instantly, so
 * that wait is entirely the profile fetch. Seeding from the cache lets the app
 * open at once and reconcile a moment later when the live snapshot lands.
 *
 * This cannot be used to get in somewhere you should not be: firestore.rules
 * decide every read and write on the server, so a stale cached role or a
 * revoked account grants nothing. The worst it can do is show a stale name for
 * the moment before the real profile arrives.
 */
async function readCachedProfile(uid: string): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(profileKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed?.uid === uid ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // When Firebase isn't configured there will never be a callback, so start
  // resolved rather than hanging on the splash screen forever.
  const [session, setSession] = useState<Session>(() => ({
    resolved: !isConfigured,
    user: null,
  }));
  const [snapshot, setSnapshot] = useState<ProfileSnapshot>(NO_PROFILE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    return onAuthStateChanged(auth(), (u) => setSession({ resolved: true, user: u }));
  }, []);

  // A live subscription rather than a one-off read: if the superadmin disables
  // an account or changes a role, it takes effect on that person's phone
  // immediately instead of at next launch.
  useEffect(() => {
    const uid = session.user?.uid;
    if (!uid) return;

    let cancelled = false;

    // Open on what we already knew, rather than on a spinner. If the live
    // snapshot wins the race this is discarded untouched.
    void readCachedProfile(uid).then((cached) => {
      if (cancelled || !cached) return;
      setSnapshot((prev) => (prev.uid === uid && prev.loaded
        ? prev
        : { uid, profile: cached, loaded: true }));
    });

    return onSnapshot(
      userDoc(uid),
      (snap) => {
        const profile = snap.exists()
          ? ({ uid: snap.id, ...snap.data() } as UserProfile)
          : null;
        setSnapshot({ uid, profile, loaded: true });
        // Keep the cache honest, including removing it for an account whose
        // profile has gone, so the next launch does not open on a ghost.
        void (profile
          ? AsyncStorage.setItem(profileKey(uid), JSON.stringify(profile))
          : AsyncStorage.removeItem(profileKey(uid))
        ).catch(() => {});
      },
      // An error here means we could not reach Firestore, not that the profile
      // is gone. Keep whatever the cache gave us instead of ejecting someone
      // from an app that was working a second ago.
      () => setSnapshot((prev) => (prev.uid === uid && prev.loaded
        ? prev
        : { uid, profile: null, loaded: true })),
    );
  }, [session.user]);

  // Anything left over from a previous account is ignored by uid, so signing
  // out can never briefly show the next person the last person's data.
  const matches = !!session.user && snapshot.uid === session.user.uid;
  const profile = matches ? snapshot.profile : null;
  const profileLoaded = matches && snapshot.loaded;

  const status: AuthStatus = useMemo(() => {
    if (!isConfigured) return 'unconfigured';
    if (!session.resolved) return 'booting';
    if (!session.user) return 'signedOut';
    if (!profileLoaded) return 'booting';
    if (!profile) return 'noProfile';
    if (!profile.active) return 'disabled';
    if (profile.mustChangePassword) return 'mustChangePassword';
    return 'ready';
  }, [session.resolved, session.user, profile, profileLoaded]);

  const value = useMemo<AuthValue>(() => ({
    status,
    user: session.user,
    profile,
    error,
    clearError: () => setError(null),
    signIn: async (email, password) => {
      setError(null);
      try {
        await signInWithEmailAndPassword(auth(), email.trim(), password);
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        setError(friendlyAuthError(code));
        throw e;
      }
    },
    signOut: async () => {
      // Drop this device's push token and the cached profile first: signing
      // out then failing to clear either would leave the next launch opening
      // into the old account's shell, and this phone still receiving that
      // account's expenses.
      const uid = session.user?.uid;
      if (uid) {
        await unregisterFromPush(uid);
        await AsyncStorage.removeItem(profileKey(uid)).catch(() => {});
      }
      await fbSignOut(auth());
    },
  }), [status, session.user, profile, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Convenience for screens that are only reachable once signed in. */
export function useProfile(): UserProfile {
  const { profile } = useAuth();
  if (!profile) throw new Error('useProfile used outside an authenticated screen');
  return profile;
}
