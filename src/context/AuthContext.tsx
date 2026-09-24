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
import { retrying } from '../services/retrying';
import { clearSnapshot, LAST_UID_KEY } from '../services/dataCache';
import type { UserProfile } from '../types';

export type AuthStatus =
  | 'booting'        // restoring the saved session
  | 'unconfigured'   // .env not filled in yet
  | 'signedOut'
  | 'verifyEmail'    // signed themselves up; the email link is not tapped yet
  | 'finishSignup'   // email verified; password and profile still to come
  | 'mustChangePassword'
  | 'disabled'       // account switched off by the superadmin
  | 'ready';

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  profile: UserProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Re-read the Firebase user. `emailVerified` only changes on a reload, and
   * the object reloads in place, so this also tells React it changed.
   */
  refreshUser: () => Promise<void>;
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
  /** Bumped by refreshUser, since a reloaded user is still the same object. */
  version: number;
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
    version: 0,
  }));
  const [snapshot, setSnapshot] = useState<ProfileSnapshot>(NO_PROFILE);
  const [error, setError] = useState<string | null>(null);

  /**
   * Whoever had the app open last time, with the profile saved for them.
   *
   * Firebase Auth checks the saved session with the server before it answers,
   * which on a slow network is several seconds of "Signing you in…" for
   * somebody who is plainly still signed in. Opening on this instead shows the
   * app at once. It grants nothing: every read and write still needs the real
   * session, and if Auth comes back signed out, this is dropped.
   */
  const [early, setEarly] = useState<{ done: boolean; profile: UserProfile | null }>(
    { done: false, profile: null },
  );
  useEffect(() => {
    if (!isConfigured) return;
    void (async () => {
      const lastUid = await AsyncStorage.getItem(LAST_UID_KEY).catch(() => null);
      const cached = lastUid ? await readCachedProfile(lastUid) : null;
      setEarly({ done: true, profile: cached });
    })();
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    return onAuthStateChanged(auth(), (u) => setSession((s) => ({
      resolved: true, user: u, version: s.version + 1,
    })));
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

    // Whether the server has confirmed this profile exists. Edits to a
    // profile it already has can show straight away.
    let onServer = false;

    return retrying((fail) => onSnapshot(
      userDoc(uid),
      { includeMetadataChanges: true },
      (snap) => {
        const profile = snap.exists()
          ? ({ uid: snap.id, ...snap.data() } as UserProfile)
          : null;
        // A profile this phone has only just written — the last step of
        // signing up — exists locally before it exists on the server. Letting
        // people in on the local copy starts every other listener early, and
        // the server refuses them all because, as far as it knows, there is
        // no profile yet. Wait for the server to confirm it.
        if (profile && snap.metadata.hasPendingWrites && !onServer) return;
        // "Not found" from the phone's own cache only means the server has not
        // answered yet. Treating it as "no profile" sent existing accounts to
        // the sign-up screens and wiped their cached profile. Only the server
        // gets to say a profile is missing.
        if (!profile && snap.metadata.fromCache) return;
        if (profile && !snap.metadata.hasPendingWrites) onServer = true;
        setSnapshot({ uid, profile, loaded: true });
        if (profile && !snap.metadata.fromCache) {
          void AsyncStorage.setItem(LAST_UID_KEY, uid).catch(() => {});
        }
        // Keep the cache honest, including removing it for an account whose
        // profile has gone, so the next launch does not open on a ghost.
        void (profile
          ? AsyncStorage.setItem(profileKey(uid), JSON.stringify(profile))
          : AsyncStorage.removeItem(profileKey(uid))
        ).catch(() => {});
      },
      // An error here means we could not reach Firestore, not that the profile
      // is gone. Keep whatever the cache gave us and try again. With nothing
      // cached, stay on "Signing you in…" rather than guess: guessing "no
      // profile" puts an existing account on the sign-up screens.
      fail,
    ));
  }, [session.user]);

  // Anything left over from a previous account is ignored by uid, so signing
  // out can never briefly show the next person the last person's data.
  const matches = !!session.user && snapshot.uid === session.user.uid;
  const profileLoaded = matches && snapshot.loaded;
  // Until the live profile is in, the saved one stands in: before Auth has
  // answered, and after, provided Auth answered with the same account. Only a
  // profile that could use the app anyway, so a paused account never flashes
  // in. Dropping it the moment Auth answers would bounce the app back to the
  // loading screen for the instant before the live profile arrives.
  const usable = early.profile?.active && !early.profile.mustChangePassword ? early.profile : null;
  const earlyProfile = usable && !profileLoaded
    && (!session.resolved || session.user?.uid === usable.uid)
    ? usable
    : null;
  const profile = profileLoaded ? snapshot.profile : earlyProfile;

  const status: AuthStatus = useMemo(() => {
    if (!isConfigured) return 'unconfigured';
    if (!session.resolved) return earlyProfile ? 'ready' : 'booting';
    if (!session.user) return 'signedOut';
    if (!profileLoaded) return earlyProfile ? 'ready' : 'booting';
    // No profile yet means someone part-way through signing themselves up.
    // Accounts the admin makes always get their profile in the same step.
    if (!profile) return session.user.emailVerified ? 'finishSignup' : 'verifyEmail';
    if (!profile.active) return 'disabled';
    if (profile.mustChangePassword) return 'mustChangePassword';
    return 'ready';
    // session.version stands in for the user's emailVerified, which changes
    // in place on reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.resolved, session.user, session.version, profile, profileLoaded, earlyProfile]);

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
    refreshUser: async () => {
      const u = auth().currentUser;
      if (!u) return;
      await u.reload();
      setSession((s) => ({ ...s, user: auth().currentUser, version: s.version + 1 }));
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
        await clearSnapshot(uid);
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
