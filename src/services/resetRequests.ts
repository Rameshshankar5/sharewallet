import { sendPasswordResetEmail } from 'firebase/auth';
import { setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { resetRequestDoc } from './collections';
import { writeAudit } from './audit';
import type { ResetRequest, UserProfile } from '../types';

/** Matches what Firebase will accept, and what the security rule enforces. */
const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export class ResetError extends Error {}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Ask the admin for a password reset. Called while signed out — that is the
 * whole point, since the person asking cannot get in.
 *
 * It deliberately does not check whether an account exists, and the caller
 * must not say either way. Firestore rules keep this collection unreadable to
 * everyone but the superadmin, and a screen that answered "no such account"
 * would turn the login page into a way to find out who is in the group.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL.test(email)) throw new ResetError('Enter a valid email address.');

  try {
    await setDoc(resetRequestDoc(email), {
      email,
      requestedAt: Date.now(),
      status: 'pending',
      handledBy: null,
      handledAt: null,
    });
  } catch {
    throw new ResetError('Could not send the request. Check your connection and try again.');
  }
}

/**
 * Approve it: Firebase emails a reset link, and only then is the request
 * marked handled.
 *
 * The order matters. Marking it approved first and failing to send would leave
 * the admin believing they had helped, with the request gone from the list and
 * the friend still locked out.
 */
export async function approveReset(
  request: ResetRequest,
  actor: UserProfile,
): Promise<void> {
  try {
    await sendPasswordResetEmail(auth(), request.email);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    throw new ResetError(
      code === 'auth/user-not-found'
        ? `No account uses ${request.email}. Nothing was sent — dismiss this request.`
        : code === 'auth/invalid-email'
          ? 'That address is not a valid email, so no link could be sent.'
          : code === 'auth/too-many-requests'
            ? 'Firebase is rate-limiting reset emails. Wait a few minutes and try again.'
            : 'Could not send the reset email. Check your connection and try again.',
    );
  }

  const batch = writeBatch(db());
  batch.update(resetRequestDoc(request.id), {
    status: 'approved',
    handledBy: actor.uid,
    handledAt: Date.now(),
  });
  writeAudit(batch, {
    action: 'user.update',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: request.id,
    targetLabel: request.email,
    roomId: null,
    viewerIds: [actor.uid],
    changes: [{
      field: 'passwordReset', kind: 'changed', label: 'Password reset approved',
      before: 'Requested', after: 'Reset link sent',
    }],
  });
  await batch.commit();
}

/** Turn it down — a request for an address nobody recognises, or a mistake. */
export async function dismissReset(
  request: ResetRequest,
  actor: UserProfile,
): Promise<void> {
  const batch = writeBatch(db());
  batch.update(resetRequestDoc(request.id), {
    status: 'dismissed',
    handledBy: actor.uid,
    handledAt: Date.now(),
  });
  writeAudit(batch, {
    action: 'user.update',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: request.id,
    targetLabel: request.email,
    roomId: null,
    viewerIds: [actor.uid],
    changes: [{
      field: 'passwordReset', kind: 'changed', label: 'Password reset dismissed',
      before: 'Requested', after: 'No link sent',
    }],
  });
  await batch.commit();
}
