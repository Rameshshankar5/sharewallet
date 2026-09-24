import { useEffect, useRef } from 'react';
import { linkViaRoom } from '../services/connections';
import type { Room } from '../types';

interface Snapshot {
  rooms: Room[];
  connectedIds: string[];
}

/**
 * Keeps everyone in a room connected to everyone else in it, so they can see
 * each other's names. Whoever joins by link can only connect themselves to
 * the people already there; the people already there connect back here.
 *
 * Each attempt is made once per session and failures are ignored: the other
 * person's app may simply have got there first, which the rules then refuse
 * as a duplicate, and that is fine.
 */
export function useRoomSync(me: string | null, data: Snapshot | null) {
  const tried = useRef(new Set<string>());

  useEffect(() => {
    if (!me || !data) return;
    const connected = new Set(data.connectedIds);
    for (const room of data.rooms) {
      for (const other of room.memberIds) {
        if (other === me || connected.has(other) || tried.current.has(other)) continue;
        tried.current.add(other);
        void linkViaRoom(me, other, room.id).catch(() => {});
      }
    }
  }, [me, data]);
}
