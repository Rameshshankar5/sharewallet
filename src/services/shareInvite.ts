import { Share } from 'react-native';
import { getOrCreateInvite } from './invites';
import { inviteUrl } from '../lib/links';
import type { Room, UserProfile } from '../types';

/**
 * Open the phone's share sheet with an invite link, so it goes out through
 * whatever the person already uses — WhatsApp, Viber, SMS.
 *
 * Resolves to false if they backed out of the sheet, which is not an error.
 */
export async function shareInvite(actor: UserProfile, room?: Room): Promise<boolean> {
  const invite = await getOrCreateInvite(room ? 'room' : 'friend', actor, room);
  const url = inviteUrl(invite.id);
  const message = room
    ? `Join "${room.name}" on ShareWallet so we can split what we spend: ${url}`
    : `Connect with me on ShareWallet so we can split expenses: ${url}`;
  const result = await Share.share({ message }, { dialogTitle: 'Send your invite link' });
  return result.action === Share.sharedAction;
}
