import { arrayRemove, arrayUnion, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { roomsCol, roomDoc, expensesCol } from './collections';
import { writeAudit } from './audit';
import type { Room, UserProfile } from '../types';

export interface RoomInput {
  name: string;
  icon: string;
  memberIds: string[];
}

/**
 * Add one person to a room.
 *
 * One write each, because the rules check every addition against a
 * connection and rules cannot loop over a list. That is what stops anybody
 * putting a stranger in a room to get sight of them.
 */
async function addMember(roomId: string, uid: string) {
  await updateDoc(roomDoc(roomId), {
    memberIds: arrayUnion(uid),
    addedId: uid,
    updatedAt: Date.now(),
  });
}

export async function createRoom(input: RoomInput, actor: UserProfile): Promise<string> {
  const ref = doc(roomsCol());
  const now = Date.now();
  const memberIds = Array.from(new Set([...input.memberIds, actor.uid])).sort();

  // Created with just its creator, then filled one person at a time.
  const room: Omit<Room, 'id'> = {
    name: input.name.trim(),
    icon: input.icon,
    memberIds: [actor.uid],
    createdBy: actor.uid,
    createdAt: now,
    updatedAt: now,
    archived: false,
    addedId: null,
    joinInviteId: null,
  };

  const batch = writeBatch(db());
  batch.set(ref, room);
  writeAudit(batch, {
    action: 'room.create',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: ref.id,
    targetLabel: room.name,
    roomId: ref.id,
    viewerIds: memberIds,
    changes: [{
      field: 'room', kind: 'added',
      label: `Created room "${room.name}" with ${memberIds.length} members`,
      before: null, after: room.name,
    }],
  });
  await batch.commit();

  for (const uid of memberIds) {
    if (uid !== actor.uid) await addMember(ref.id, uid);
  }
  return ref.id;
}

/**
 * Renaming is cheap; changing who is in a room is not. Room membership is
 * denormalised onto every expense as `viewerIds` (that's what makes reads a
 * single indexed query instead of a permission lookup per row), so a membership
 * change has to be pushed down to the room's expenses too.
 */
export async function updateRoom(
  room: Room,
  input: RoomInput,
  actor: UserProfile,
  nameOf: (uid: string) => string,
) {
  const name = input.name.trim();
  const memberIds = Array.from(new Set([...input.memberIds])).sort();

  const added = memberIds.filter((m) => !room.memberIds.includes(m));
  const removed = room.memberIds.filter((m) => !memberIds.includes(m));
  const renamed = name !== room.name;
  const reIcon = input.icon !== room.icon;

  if (!added.length && !removed.length && !renamed && !reIcon) return;

  // Additions first, each on its own. If one is refused, nothing else about
  // the room has changed yet, and the ones already added are real members.
  for (const uid of added) await addMember(room.id, uid);

  const batch = writeBatch(db());
  // Removals only, as a removal: writing the whole list back would also drop
  // anybody who joined by link while this screen was open.
  batch.update(roomDoc(room.id), {
    name,
    icon: input.icon,
    ...(removed.length ? { memberIds: arrayRemove(...removed) } : {}),
    updatedAt: Date.now(),
  });

  if (added.length || removed.length) {
    // Security rules are not filters: a list query must itself carry the
    // constraint the rule checks, or Firestore rejects the whole query. The
    // rule on expenses is `uid in viewerIds`, so filtering by roomId alone
    // fails — which is why saving a room used to error. Every room member is
    // in viewerIds of that room's expenses, so this narrows nothing.
    const snap = await getDocs(query(
      expensesCol(),
      where('roomId', '==', room.id),
      where('viewerIds', 'array-contains', actor.uid),
    ));
    snap.forEach((d) => {
      const data = d.data() as { participantIds?: string[] };
      const participants = data.participantIds ?? [];
      // A member who leaves keeps visibility only if they're actually in the
      // expense — otherwise they'd lose sight of money they still owe.
      const viewers = Array.from(new Set([...participants, ...memberIds])).sort();
      batch.update(d.ref, { viewerIds: viewers });
    });
  }

  const changes = [];
  if (renamed) {
    changes.push({ field: 'name', kind: 'changed' as const, label: 'Room name', before: room.name, after: name });
  }
  if (reIcon) {
    changes.push({ field: 'icon', kind: 'changed' as const, label: 'Room icon', before: room.icon, after: input.icon });
  }
  added.forEach((uid) => changes.push({
    field: `member:${uid}`, kind: 'added' as const,
    label: `${nameOf(uid)} added to the room`, before: null, after: nameOf(uid),
  }));
  removed.forEach((uid) => changes.push({
    field: `member:${uid}`, kind: 'removed' as const,
    label: `${nameOf(uid)} removed from the room`, before: nameOf(uid), after: null,
  }));

  writeAudit(batch, {
    action: added.length || removed.length ? 'room.members' : 'room.update',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: room.id,
    targetLabel: name,
    roomId: room.id,
    viewerIds: Array.from(new Set([...memberIds, ...room.memberIds])).sort(),
    changes,
  });

  await batch.commit();
}

export async function setRoomArchived(room: Room, archived: boolean, actor: UserProfile) {
  const batch = writeBatch(db());
  batch.update(roomDoc(room.id), { archived, updatedAt: Date.now() });
  writeAudit(batch, {
    action: 'room.update',
    byUid: actor.uid,
    byName: actor.displayName,
    targetId: room.id,
    targetLabel: room.name,
    roomId: room.id,
    viewerIds: room.memberIds,
    changes: [{
      field: 'archived', kind: 'changed', label: 'Room status',
      before: room.archived ? 'Archived' : 'Active',
      after: archived ? 'Archived' : 'Active',
    }],
  });
  await batch.commit();
}
