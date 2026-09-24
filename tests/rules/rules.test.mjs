/**
 * Tests for firestore.rules — the app's only backend, so the part where a
 * mistake exposes someone's data rather than just showing a wrong number.
 *
 * Run with:  npm run test:rules
 *
 * Runs against the local Firestore emulator (started and stopped for you), so
 * it needs the Firebase CLI and Java 21 or newer, but no Firebase project and
 * no network. Run it before every `firebase deploy --only firestore:rules`.
 */
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, arrayUnion,
} from 'firebase/firestore';

let env;
const NOW = Date.now();
const DAY = 86400000;

const profile = (uid, role = 'member') => ({
  uid, email: `${uid}@x.com`, displayName: uid, role, photoUrl: null, pushTokens: [],
  active: true, mustChangePassword: false, createdAt: NOW, createdBy: null,
});
const invite = (by, extra = {}) => ({
  kind: 'friend', createdBy: by, createdByName: by, createdByPhoto: null,
  roomId: null, roomName: null, roomIcon: null, createdAt: NOW, expiresAt: NOW + DAY, revoked: false, ...extra,
});
const conn = (a, b, by, extra = {}) => ({
  memberIds: [a, b].sort(), via: 'invite', inviteId: null, roomId: null, createdBy: by, createdAt: NOW, ...extra,
});
const pair = (a, b) => [a, b].sort().join('_');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sharewallet',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin'), profile('admin', 'superadmin'));
    for (const u of ['alice', 'bob', 'carol', 'erin']) await setDoc(doc(db, `users/${u}`), profile(u));
    await setDoc(doc(db, 'rooms/R1'), {
      name: 'Trip', icon: 'home', memberIds: ['alice'], createdBy: 'alice', createdAt: NOW, updatedAt: NOW, archived: false,
    });
    await setDoc(doc(db, 'invites/FRIENDaaaaaa'), invite('alice'));
    await setDoc(doc(db, 'invites/EXPIREDaaaaa'), invite('alice', { expiresAt: NOW - 1 }));
    await setDoc(doc(db, 'invites/REVOKEDaaaaa'), invite('alice', { revoked: true }));
    await setDoc(doc(db, 'invites/ROOMaaaaaaaa'), invite('alice', { kind: 'room', roomId: 'R1', roomName: 'Trip' }));
  });
});

after(async () => { await env.cleanup(); });

const as = (uid, token = {}) => env.authenticatedContext(uid, { email: `${uid}@x.com`, email_verified: false, ...token }).firestore();

test('strangers cannot read each other', async () => {
  await assertFails(getDoc(doc(as('bob'), 'users/alice')));
  await assertFails(getDocs(collection(as('bob'), 'users')));
  await assertSucceeds(getDocs(collection(as('admin'), 'users')));
  await assertSucceeds(getDoc(doc(as('bob'), 'users/bob')));
});

test('a new sign-up can read its own missing profile', async () => {
  await assertSucceeds(getDoc(doc(as('dave'), 'users/dave')));
  await assertFails(getDoc(doc(as('dave'), 'users/alice')));
});

test('friend invite: wrong, expired and revoked links are refused', async () => {
  await assertFails(setDoc(doc(as('carol'), `connections/${pair('bob', 'carol')}`),
    conn('bob', 'carol', 'carol', { inviteId: 'FRIENDaaaaaa' })));
  await assertFails(setDoc(doc(as('carol'), `connections/${pair('alice', 'carol')}`),
    conn('alice', 'carol', 'carol', { inviteId: 'EXPIREDaaaaa' })));
  await assertFails(setDoc(doc(as('carol'), `connections/${pair('alice', 'carol')}`),
    conn('alice', 'carol', 'carol', { inviteId: 'REVOKEDaaaaa' })));
  // Alice cannot accept her own link.
  await assertFails(setDoc(doc(as('alice'), `connections/${pair('alice', 'alice')}`),
    { ...conn('alice', 'alice', 'alice', { inviteId: 'FRIENDaaaaaa' }), memberIds: ['alice', 'alice'] }));
  // Nobody writes a connection they are not part of.
  await assertFails(setDoc(doc(as('carol'), `connections/${pair('alice', 'bob')}`),
    conn('alice', 'bob', 'carol', { inviteId: 'FRIENDaaaaaa' })));
});

test('friend invite: accepting connects, and then profiles are visible', async () => {
  await assertSucceeds(setDoc(doc(as('bob'), `connections/${pair('alice', 'bob')}`),
    conn('alice', 'bob', 'bob', { inviteId: 'FRIENDaaaaaa' })));
  await assertSucceeds(getDoc(doc(as('bob'), 'users/alice')));
  await assertSucceeds(getDoc(doc(as('alice'), 'users/bob')));
  await assertSucceeds(getDocs(query(collection(as('bob'), 'connections'), where('memberIds', 'array-contains', 'bob'))));
  await assertFails(updateDoc(doc(as('bob'), `connections/${pair('alice', 'bob')}`), { via: 'admin' }));
  await assertFails(deleteDoc(doc(as('bob'), `connections/${pair('alice', 'bob')}`)));
});

test('only the admin makes admin connections', async () => {
  await assertFails(setDoc(doc(as('bob'), `connections/${pair('bob', 'erin')}`), conn('bob', 'erin', 'bob', { via: 'admin' })));
  await assertSucceeds(setDoc(doc(as('admin'), `connections/${pair('admin', 'erin')}`), conn('admin', 'erin', 'admin', { via: 'admin' })));
});

test('rooms: nobody puts a stranger in a room', async () => {
  await assertFails(updateDoc(doc(as('alice'), 'rooms/R1'), { memberIds: arrayUnion('carol'), addedId: 'carol' }));
  // Two at once, even if one is a connection.
  await assertFails(updateDoc(doc(as('alice'), 'rooms/R1'), { memberIds: arrayUnion('bob', 'carol'), addedId: 'bob' }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'rooms/R1'), { memberIds: arrayUnion('bob'), addedId: 'bob', updatedAt: NOW }));
  await assertFails(setDoc(doc(as('bob'), 'rooms/R2'), {
    name: 'X', icon: 'home', memberIds: ['bob', 'carol'], createdBy: 'bob', createdAt: NOW, updatedAt: NOW, archived: false,
  }));
  await assertSucceeds(setDoc(doc(as('bob'), 'rooms/R2'), {
    name: 'X', icon: 'home', memberIds: ['bob'], createdBy: 'bob', createdAt: NOW, updatedAt: NOW, archived: false,
  }));
});

test('rooms: joining by link', async () => {
  const join = (extra = {}) => updateDoc(doc(as('carol'), 'rooms/R1'), {
    memberIds: arrayUnion('carol'), addedId: 'carol', joinInviteId: 'ROOMaaaaaaaa', updatedAt: NOW, ...extra,
  });
  await assertFails(join({ joinInviteId: 'FRIENDaaaaaa' }));
  await assertFails(join({ name: 'Hijacked' }));
  await assertFails(updateDoc(doc(as('carol'), 'rooms/R1'), {
    memberIds: arrayUnion('carol', 'erin'), addedId: 'carol', joinInviteId: 'ROOMaaaaaaaa', updatedAt: NOW,
  }));
  await assertSucceeds(join());
  await assertSucceeds(getDoc(doc(as('carol'), 'rooms/R1')));
  // Room-mates may now connect; outsiders still may not.
  await assertSucceeds(setDoc(doc(as('carol'), `connections/${pair('alice', 'carol')}`),
    conn('alice', 'carol', 'carol', { via: 'room', roomId: 'R1' })));
  await assertFails(setDoc(doc(as('erin'), `connections/${pair('alice', 'erin')}`),
    conn('alice', 'erin', 'erin', { via: 'room', roomId: 'R1' })));
});

test('invites: honest names, own rooms, no listing', async () => {
  await assertFails(setDoc(doc(as('bob'), 'invites/BOBxxxxxxxx1'), invite('bob', { createdByName: 'alice' })));
  await assertSucceeds(setDoc(doc(as('bob'), 'invites/BOBxxxxxxxx1'), invite('bob')));
  await assertFails(setDoc(doc(as('erin'), 'invites/ERINxxxxxxx1'), invite('erin', { kind: 'room', roomId: 'R1' })));
  await assertSucceeds(getDoc(doc(as('erin'), 'invites/FRIENDaaaaaa')));
  await assertFails(getDocs(collection(as('erin'), 'invites')));
  await assertSucceeds(getDocs(query(collection(as('bob'), 'invites'), where('createdBy', '==', 'bob'))));
  await assertFails(updateDoc(doc(as('erin'), 'invites/FRIENDaaaaaa'), { revoked: true }));
  await assertFails(updateDoc(doc(as('alice'), 'invites/FRIENDaaaaaa'), { expiresAt: NOW + 99 * DAY }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'invites/REVOKEDaaaaa'), { revoked: true }));
});

test('self sign-up needs a verified email and gets nothing extra', async () => {
  const mine = (uid, extra = {}) => ({ ...profile(uid), ...extra });
  await assertFails(setDoc(doc(as('dave'), 'users/dave'), mine('dave')));
  const verified = as('dave', { email_verified: true });
  await assertFails(setDoc(doc(verified, 'users/dave'), mine('dave', { role: 'superadmin' })));
  await assertFails(setDoc(doc(verified, 'users/dave'), mine('dave', { email: 'someone@else.com' })));
  await assertFails(setDoc(doc(verified, 'users/dave'), mine('dave', { pushTokens: ['x'] })));
  await assertFails(setDoc(doc(verified, 'users/dave'), mine('dave', { active: true, extra: 1 })));
  await assertFails(setDoc(doc(verified, 'users/frank'), mine('frank')));
  await assertSucceeds(setDoc(doc(verified, 'users/dave'), mine('dave')));
  // …and then is a stranger to everyone.
  await assertFails(getDoc(doc(verified, 'users/alice')));
});

test('paused accounts can still see that they are paused', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users/erin'), { active: false });
  });
  await assertSucceeds(getDoc(doc(as('erin'), 'users/erin')));
  await assertFails(getDoc(doc(as('erin'), 'invites/FRIENDaaaaaa')));
});

test('rooms: members rename and remove; outsiders cannot', async () => {
  const { arrayRemove } = await import('firebase/firestore');
  await assertSucceeds(updateDoc(doc(as('alice'), 'rooms/R1'), { name: 'Trip 2', updatedAt: NOW }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'rooms/R1'), { memberIds: arrayRemove('bob'), updatedAt: NOW }));
  await assertFails(updateDoc(doc(as('bob'), 'rooms/R1'), { name: 'Mine now' }));
  await assertFails(updateDoc(doc(as('alice'), 'rooms/R1'), { createdBy: 'bob' }));
});

test('room history: current members read all of a room, by query too', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'rooms/H1'), {
      name: 'H', icon: 'home', memberIds: ['alice', 'erin2'], createdBy: 'alice', createdAt: NOW, updatedAt: NOW, archived: false,
    });
    await setDoc(doc(db, 'users/erin2'), profile('erin2'));
    await setDoc(doc(db, 'expenses/OLD'), { roomId: 'H1', viewerIds: ['alice'], totalCents: 100, deleted: false, date: NOW });
    await setDoc(doc(db, 'expenses/DIRECT'), { roomId: null, viewerIds: ['alice'], totalCents: 100, deleted: false, date: NOW });
    await setDoc(doc(db, 'audit/A1'), { roomId: 'H1', viewerIds: ['alice'], at: NOW });
    await setDoc(doc(db, 'settlements/S1'), { roomId: 'H1', viewerIds: ['alice'], amount: 5, deleted: false });
  });
  const e = as('erin2');
  await assertSucceeds(getDoc(doc(e, 'expenses/OLD')));
  await assertSucceeds(getDocs(query(collection(e, 'expenses'), where('roomId', '==', 'H1'))));
  await assertSucceeds(getDocs(query(collection(e, 'audit'), where('roomId', '==', 'H1'))));
  await assertSucceeds(getDocs(query(collection(e, 'settlements'), where('roomId', '==', 'H1'))));
  await assertFails(getDoc(doc(e, 'expenses/DIRECT')));
  await assertFails(getDocs(query(collection(e, 'expenses'), where('roomId', '==', 'R2'))));
  await assertFails(getDocs(collection(e, 'expenses')));
  // Outsiders still see nothing.
  await assertFails(getDocs(query(collection(as('bob'), 'expenses'), where('roomId', '==', 'H1'))));
});

test('room history: a later member can correct an old room expense', async () => {
  const e = as('erin2');
  await assertSucceeds(updateDoc(doc(e, 'settlements/S1'), { deleted: true }));
  await assertFails(updateDoc(doc(as('bob'), 'settlements/S1'), { deleted: false }));
});
