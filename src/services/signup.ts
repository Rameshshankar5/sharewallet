import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getDoc, setDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import { userDoc } from './collections';
import type { UserProfile } from '../types';

/**
 * Signing yourself up, in the order you'd expect: prove the email is yours,
 * then choose a password.
 *
 * Firebase cannot create an account without a password, and cannot email a
 * code without a server. So the account is created with a long random
 * password nobody sees, Firebase emails its own verification link, and once
 * that link has been tapped the person sets the password they will actually
 * use. The random one is kept on this phone only until then, because Firebase
 * wants a recent sign-in before it will change a password, and that could be
 * an hour after the email was sent.
 *
 * Until the profile document exists the account can read and write nothing,
 * and the rules refuse to create that document for an unverified address.
 */

const tempKey = (uid: string) => `sharewallet.signup.${uid}`;

function randomPassword(): string {
  return Array.from(getRandomBytes(24), (b) => b.toString(16).padStart(2, '0')).join('');
}

export class SignupError extends Error {}

function friendly(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email already has an account. Sign in instead, or use "Forgotten your password?".';
    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/weak-password':
      return 'Choose a longer password — at least 8 characters.';
    default:
      return 'Something went wrong. Try again.';
  }
}

async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SignupError) throw e;
    throw new SignupError(friendly((e as { code?: string }).code ?? ''));
  }
}

/** Step 1: create the account and send the verification email. */
export async function startSignup(name: string, email: string): Promise<void> {
  const displayName = name.trim();
  if (!displayName) throw new SignupError('Enter your name.');
  await wrap(async () => {
    const password = randomPassword();
    const cred = await createUserWithEmailAndPassword(auth(), email.trim(), password);
    await AsyncStorage.setItem(tempKey(cred.user.uid), password);
    await updateProfile(cred.user, { displayName });
    await sendEmailVerification(cred.user);
  });
}

export async function resendVerification(user: User): Promise<void> {
  await wrap(() => sendEmailVerification(user));
}

/** Step 2: has the link been tapped yet? */
export async function checkVerified(user: User): Promise<boolean> {
  await wrap(() => user.reload());
  return user.emailVerified;
}

/**
 * Whether this phone still holds the stand-in password, and so whether the
 * last step needs to ask for a real one. Somebody who signed in with a
 * password they already know — after a reset, say — has nothing to replace.
 */
export async function needsPassword(user: User): Promise<boolean> {
  return (await AsyncStorage.getItem(tempKey(user.uid))) !== null;
}

/** Step 3: set the real password and create the profile. */
export async function finishSignup(user: User, name: string, password: string | null): Promise<void> {
  const displayName = name.trim();
  if (!displayName) throw new SignupError('Enter your name.');
  if (!user.email) throw new SignupError('This account has no email address.');

  await wrap(async () => {
    const temp = await AsyncStorage.getItem(tempKey(user.uid));
    if (temp) {
      if (!password || password.length < 8) {
        throw new SignupError('Choose a password of at least 8 characters.');
      }
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, temp));
      await updatePassword(user, password);
    }

    // The rules read `email_verified` from the ID token, which was minted
    // before the link was tapped. Without a fresh one the write is refused.
    await user.getIdToken(true);

    // A retry after a dropped connection may find the profile already made.
    const existing = await getDoc(userDoc(user.uid));
    if (!existing.exists()) {
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email!.toLowerCase(),
        displayName,
        role: 'member',
        photoUrl: null,
        pushTokens: [],
        active: true,
        mustChangePassword: false,
        createdAt: Date.now(),
        createdBy: null,
      };
      await setDoc(userDoc(user.uid), profile);
    }

    if (displayName !== user.displayName) {
      await updateProfile(user, { displayName }).catch(() => {});
    }
    await AsyncStorage.removeItem(tempKey(user.uid)).catch(() => {});
  });
}

/**
 * Give up on a sign-up that has not been verified — a typo in the address,
 * usually. The half-made account is deleted rather than left behind, or the
 * address would stay "already in use" for its real owner.
 */
export async function abandonSignup(user: User): Promise<void> {
  // Only ever an account this phone started signing up, and only one with no
  // profile. Anything else — an existing account shown this screen by
  // mistake, above all an admin's — must never be deleted from here.
  const temp = await AsyncStorage.getItem(tempKey(user.uid));
  if (!temp || !user.email) return;
  const profile = await getDoc(userDoc(user.uid));
  if (profile.exists()) return;

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, temp));
    await user.delete();
  } finally {
    await AsyncStorage.removeItem(tempKey(user.uid)).catch(() => {});
  }
}
