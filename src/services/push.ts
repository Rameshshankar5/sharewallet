import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { arrayRemove, arrayUnion, updateDoc } from 'firebase/firestore';
import { userDoc } from './collections';
import {
  chunkMessages, isExpoPushToken, type PushMessage,
} from '../lib/pushMessages';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * The EAS project this build belongs to. Expo's push service issues tokens
 * against a project, so without it there is nothing to register and the whole
 * feature stays dormant rather than erroring on every launch.
 */
function projectId(): string | null {
  const fromEas = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof fromEas === 'string' && fromEas.length > 0 ? fromEas : null;
}

/** False in a build that has not been linked to an EAS project yet. */
export const pushConfigured = projectId() !== null;

/**
 * Android needs a channel before anything it shows can have a sound, an
 * importance or a colour. Created up front, because a channel registered after
 * the first notification does not retroactively apply to it.
 */
export async function preparePushChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('expenses', {
    name: 'Expenses and payments',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

export type PushPermission = 'granted' | 'denied' | 'unsupported';

/**
 * Ask for permission and register this device's token against the signed-in
 * profile.
 *
 * Tokens are held as an array because one person can be signed in on more than
 * one device, and a notification that only ever reaches whichever phone
 * registered last is worse than none.
 */
export async function registerForPush(uid: string): Promise<PushPermission> {
  // A simulator has no push service to register with, and asking produces a
  // confusing failure rather than a useful one.
  if (!Device.isDevice) return 'unsupported';
  if (!pushConfigured) return 'unsupported';

  await preparePushChannel();

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync();
    granted = asked.granted;
  }
  if (!granted) return 'denied';

  const id = projectId();
  if (!id) return 'unsupported';

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  if (!isExpoPushToken(token)) return 'unsupported';

  await updateDoc(userDoc(uid), { pushTokens: arrayUnion(token) });
  return 'granted';
}

/**
 * Drop this device's token.
 *
 * Called on sign-out: leaving it behind would send the next person's expenses
 * to a phone that is no longer theirs to see.
 */
export async function unregisterFromPush(uid: string): Promise<void> {
  if (!pushConfigured || !Device.isDevice) return;
  try {
    const id = projectId();
    if (!id) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    if (isExpoPushToken(token)) {
      await updateDoc(userDoc(uid), { pushTokens: arrayRemove(token) });
    }
  } catch {
    // Signing out must never fail because a token could not be cleaned up.
  }
}

/**
 * Hand the messages to Expo's push service.
 *
 * Sent from the phone that made the change, which is what lets this work with
 * no server: the Expo push API takes no secret, so nothing has to ship in the
 * APK for it. The cost is that delivery depends on the sender's device staying
 * online long enough to make the request — fine for a tap that already had to
 * reach Firestore.
 *
 * Failures are swallowed on purpose. The expense is already saved; a
 * notification that did not go out must not present itself as a save that did
 * not happen.
 */
export async function sendPushMessages(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  for (const chunk of chunkMessages(messages)) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk.map((m) => ({
          to: m.to,
          title: m.title,
          body: m.body,
          data: m.data,
          sound: 'default',
          channelId: 'expenses',
          priority: 'default',
        }))),
      });

      // Expo answers with a ticket per message. Nothing here can be acted on:
      // a dead token belongs to somebody else's profile, and the rules —
      // rightly — only let a person write their own. Dead tokens therefore
      // linger until that person's own device next signs out, which is a few
      // stale strings rather than a problem worth weakening a rule for.
      await response.json().catch(() => null);
    } catch {
      // Offline, rate-limited, or Expo is down. Nothing here is worth
      // interrupting the person who just saved something.
    }
  }
}
