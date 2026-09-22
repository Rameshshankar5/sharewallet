import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type Auth,
} from 'firebase/auth';
import { deleteApp } from 'firebase/app';
import { updateDoc, writeBatch } from 'firebase/firestore';
import { adminWorkerAuth, db } from '../firebase';
import { userDoc } from './collections';
import { writeAudit } from './audit';
import type { UserProfile } from '../types';

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role: 'superadmin' | 'member';
}

/**
 * Create an account for a friend, without any backend.
 *
 * The obvious way to do this is the Admin SDK in a Cloud Function — but Cloud
 * Functions now require a billing-enabled project, which you asked to avoid.
 * So instead we spin up a SECOND Firebase Auth instance in the app. Creating a
 * user signs that user in, and using a separate instance means it signs them
 * into the throwaway auth object rather than kicking the superadmin out of
 * their own session. We sign the throwaway out immediately and bin the app.
 *
 * Security still holds: firestore.rules only lets the superadmin create a
 * `users/{uid}` profile, and every other rule requires a profile to exist. Even
 * if someone signs up directly against your Firebase project, they land with no
 * profile and can read and write precisely nothing.
 */
export async function createMemberAccount(
  input: CreateUserInput,
  actor: UserProfile,
): Promise<string> {
  let worker: Auth | null = null;
  try {
    worker = adminWorkerAuth();
    const cred = await createUserWithEmailAndPassword(
      worker,
      input.email.trim(),
      input.password,
    );
    const uid = cred.user.uid;
    await fbSignOut(worker);

    const profile: UserProfile = {
      uid,
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      role: input.role,
      active: true,
      mustChangePassword: true,
      createdAt: Date.now(),
      createdBy: actor.uid,
    };

    const batch = writeBatch(db());
    batch.set(userDoc(uid), profile);
    writeAudit(batch, {
      action: 'user.create',
      byUid: actor.uid,
      byName: actor.displayName,
      targetId: uid,
      targetLabel: profile.displayName,
      roomId: null,
      viewerIds: [actor.uid, uid],
      changes: [{
        field: 'account', kind: 'added',
        label: `Account created for ${profile.displayName}`,
        before: null, after: profile.email,
      }],
    });
    await batch.commit();
    return uid;
  } finally {
    if (worker) {
      try { await deleteApp(worker.app); } catch { /* already gone */ }
    }
  }
}

export async function setUserActive(target: UserProfile, active: boolean, actor: UserProfile) {
  const batch = writeBatch(db());
  batch.update(userDoc(target.uid), { active });
  writeAudit(batch, {
    action: 'user.update',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: target.uid,
    targetLabel: target.displayName,
    roomId: null,
    viewerIds: [actor.uid, target.uid],
    changes: [{
      field: 'active', kind: 'changed', label: 'Account access',
      before: target.active ? 'Enabled' : 'Disabled',
      after: active ? 'Enabled' : 'Disabled',
    }],
  });
  await batch.commit();
}

export async function renameUser(target: UserProfile, displayName: string, actor: UserProfile) {
  const clean = displayName.trim();
  if (!clean || clean === target.displayName) return;
  const batch = writeBatch(db());
  batch.update(userDoc(target.uid), { displayName: clean });
  writeAudit(batch, {
    action: 'user.update',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: target.uid,
    targetLabel: clean,
    roomId: null,
    viewerIds: [actor.uid, target.uid],
    changes: [{
      field: 'displayName', kind: 'changed', label: 'Display name',
      before: target.displayName, after: clean,
    }],
  });
  await batch.commit();
}

/** Used by the forced first-login password change and by Account settings. */
export async function changeOwnPassword(
  auth: Auth,
  currentPassword: string,
  newPassword: string,
) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Not signed in.');
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPassword);
  await updateDoc(userDoc(user.uid), { mustChangePassword: false });
}
