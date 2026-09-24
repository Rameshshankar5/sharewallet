import { getRandomBytes } from 'expo-crypto';
import {
  getDoc, getDocs, query, setDoc, where, writeBatch, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { connectionDoc, inviteDoc, invitesCol, roomDoc, userDoc } from './collections';
import { writeAudit } from './audit';
import { sendPushMessages } from './push';
import { isExpoPushToken } from '../lib/pushMessages';
import { isInviteCode } from '../lib/links';
import type { Invite, InviteKind, Room, UserProfile } from '../types';

/** Long enough to cover a trip being planned, short enough to go stale. */
const LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A link is reused for as long as it has this much life left. Sharing the
 * same link twice is expected; minting a fresh document every tap is not.
 */
const REUSE_MARGIN_MS = 7 * 24 * 60 * 60 * 1000;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Twelve base62 characters from the platform's secure random source: about
 * 71 bits. The code is the only thing standing between a stranger and your
 * invite, so it must not come from Math.random.
 */
function newCode(): string {
  const bytes = getRandomBytes(24);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < 12; i++) {
    // 248 is the largest multiple of 62 below 256; rejecting the rest keeps
    // every character equally likely.
    if (bytes[i] < 248) out += ALPHABET[bytes[i] % 62];
  }
  return out.length === 12 ? out : newCode();
}

export class InviteError extends Error {}

export function inviteState(invite: Invite, now = Date.now()): 'live' | 'expired' | 'revoked' {
  if (invite.revoked) return 'revoked';
  return invite.expiresAt > now ? 'live' : 'expired';
}

/**
 * Your link for this purpose: the existing one if it is still good for a
 * while, otherwise a fresh one.
 */
export async function getOrCreateInvite(
  kind: InviteKind,
  actor: UserProfile,
  room?: Room,
): Promise<Invite> {
  const snap = await getDocs(query(
    invitesCol(),
    where('createdBy', '==', actor.uid),
    where('kind', '==', kind),
    where('roomId', '==', room?.id ?? null),
  ));
  const now = Date.now();
  const reusable = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Invite))
    .filter((i) => !i.revoked && i.expiresAt - now > REUSE_MARGIN_MS
      // A renamed person or room gets a link that says the new name.
      && i.createdByName === actor.displayName
      && (!room || i.roomName === room.name))
    .sort((a, b) => b.expiresAt - a.expiresAt)[0];
  if (reusable) return reusable;

  const code = newCode();
  const invite: Omit<Invite, 'id'> = {
    kind,
    createdBy: actor.uid,
    createdByName: actor.displayName,
    createdByPhoto: actor.photoUrl ?? null,
    roomId: room?.id ?? null,
    roomName: room?.name ?? null,
    roomIcon: room?.icon ?? null,
    createdAt: now,
    expiresAt: now + LIFETIME_MS,
    revoked: false,
  };
  await setDoc(inviteDoc(code), invite);
  return { id: code, ...invite };
}

/**
 * Switch off every link of this kind you have handed out, for when one has
 * gone somewhere it should not have. The next share mints a new one.
 */
export async function revokeInvites(kind: InviteKind, actor: UserProfile, roomId: string | null) {
  const snap = await getDocs(query(
    invitesCol(),
    where('createdBy', '==', actor.uid),
    where('kind', '==', kind),
    where('roomId', '==', roomId),
  ));
  const batch = writeBatch(db());
  let any = false;
  snap.forEach((d) => {
    if (d.data().revoked === false) {
      batch.update(d.ref, { revoked: true });
      any = true;
    }
  });
  if (any) await batch.commit();
}

export async function loadInvite(code: string): Promise<Invite | null> {
  if (!isInviteCode(code)) return null;
  const snap = await getDoc(inviteDoc(code));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Invite) : null;
}

export async function isConnected(a: string, b: string): Promise<boolean> {
  const snap = await getDoc(connectionDoc(a, b));
  return snap.exists();
}

/** Accept a friend link. Returns the uid of the person you are now connected to. */
export async function acceptFriendInvite(invite: Invite, actor: UserProfile): Promise<string> {
  if (invite.kind !== 'friend') throw new InviteError('This is not a friend invite.');
  if (invite.createdBy === actor.uid) throw new InviteError('This is your own link.');
  if (inviteState(invite) !== 'live') throw new InviteError('This link is no longer active.');

  const other = invite.createdBy;
  if (!(await isConnected(actor.uid, other))) {
    const memberIds = [actor.uid, other].sort();
    await setDoc(connectionDoc(actor.uid, other), {
      memberIds,
      via: 'invite',
      inviteId: invite.id,
      roomId: null,
      createdBy: actor.uid,
      createdAt: Date.now(),
    });
    void tellInviter(other, `${actor.displayName} accepted your invite`,
      'You can now split expenses with each other.', { type: 'friend', uid: actor.uid });
  }
  return other;
}

/** Accept a room link. Returns the room's id. */
export async function acceptRoomInvite(invite: Invite, actor: UserProfile): Promise<string> {
  if (invite.kind !== 'room' || !invite.roomId) throw new InviteError('This is not a room invite.');
  if (inviteState(invite) !== 'live') throw new InviteError('This link is no longer active.');

  const roomId = invite.roomId;
  const batch = writeBatch(db());
  batch.update(roomDoc(roomId), {
    memberIds: arrayUnion(actor.uid),
    addedId: actor.uid,
    joinInviteId: invite.id,
    updatedAt: Date.now(),
  });
  writeAudit(batch, {
    action: 'room.members',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: roomId,
    targetLabel: invite.roomName ?? 'Room',
    roomId,
    // Everyone in the room reads room rows by membership; these two are
    // named so the row also shows in their own activity feeds.
    viewerIds: [actor.uid, invite.createdBy].sort(),
    changes: [{
      field: `member:${actor.uid}`, kind: 'added',
      label: `${actor.displayName} joined with ${invite.createdByName}'s invite link`,
      before: null, after: actor.displayName,
    }],
  });
  await batch.commit();

  // Connected to the inviter straight away, so their name and picture show
  // up the moment the room opens rather than after the background sync.
  if (!(await isConnected(actor.uid, invite.createdBy).catch(() => true))) {
    await setDoc(connectionDoc(actor.uid, invite.createdBy), {
      memberIds: [actor.uid, invite.createdBy].sort(),
      via: 'room',
      inviteId: null,
      roomId,
      createdBy: actor.uid,
      createdAt: Date.now(),
    }).catch(() => {});
  }

  void tellInviter(invite.createdBy, `${actor.displayName} joined ${invite.roomName ?? 'your room'}`,
    'They used your invite link.', { type: 'room', roomId });
  return roomId;
}

/**
 * A heads-up for whoever sent the link. Best effort, like every notification
 * here: the connection is already made whether or not this arrives.
 */
async function tellInviter(uid: string, title: string, body: string, data: Record<string, string>) {
  try {
    const snap = await getDoc(userDoc(uid));
    const tokens = ((snap.data()?.pushTokens ?? []) as string[]).filter(isExpoPushToken);
    await sendPushMessages(tokens.map((to) => ({ to, title, body, data })));
  } catch {
    // Nothing to do; the invite itself worked.
  }
}
