import { setDoc } from 'firebase/firestore';
import { connectionDoc } from './collections';

/** The other person in a connection. */
export function otherMember(memberIds: string[], me: string): string | null {
  return memberIds.find((m) => m !== me) ?? null;
}

/**
 * Connect two people because they share a room.
 *
 * Either of them may write it, and both apps try, so the second attempt meets
 * an existing row, is refused by the rules (connections are never updated),
 * and that refusal is the expected outcome rather than an error.
 */
export async function linkViaRoom(me: string, other: string, roomId: string): Promise<void> {
  await setDoc(connectionDoc(me, other), {
    memberIds: [me, other].sort(),
    via: 'room',
    inviteId: null,
    roomId,
    createdBy: me,
    createdAt: Date.now(),
  });
}
