import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
 * Set when somebody switches notifications off on this phone.
 *
 * Kept on the device rather than the profile because the choice is per phone:
 * turning them off on an old tablet should not silence the phone in your
 * pocket. Without it, the automatic registration on every launch would quietly
 * undo the switch the next time the app opened.
 */
const OPT_OUT_KEY = 'sharewallet.push.optedOut';

/**
 * This phone's token, remembered from the last registration so the Account
 * screen can tell "on for this phone" from "on for some other phone of yours"
 * without a network round trip to Expo.
 */
const TOKEN_KEY = 'sharewallet.push.token';

export async function readDeviceToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function optedOut(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OPT_OUT_KEY)) === '1';
  } catch {
    return false;
  }
}

async function currentToken(): Promise<string | null> {
  const id = projectId();
  if (!id) return null;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  return isExpoPushToken(token) ? token : null;
}

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

  const token = await currentToken();
  if (!token) return 'unsupported';

  await updateDoc(userDoc(uid), { pushTokens: arrayUnion(token) });
  await AsyncStorage.removeItem(OPT_OUT_KEY).catch(() => {});
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
  return 'granted';
}

/**
 * The launch-time registration: the same as `registerForPush`, except that it
 * respects somebody having switched notifications off on this phone.
 */
export async function autoRegisterForPush(uid: string): Promise<void> {
  if (await optedOut()) return;
  await registerForPush(uid);
}

/**
 * Switch notifications off for this phone only.
 *
 * Unlike sign-out this lets a failure through, so the switch can flip back
 * instead of claiming to be off while the token is still on the profile.
 */
export async function disablePush(uid: string): Promise<void> {
  if (!pushConfigured || !Device.isDevice) return;
  const token = (await readDeviceToken()) ?? (await currentToken());
  if (token) {
    await updateDoc(userDoc(uid), { pushTokens: arrayRemove(token) });
  }
  await AsyncStorage.setItem(OPT_OUT_KEY, '1');
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
    const token = (await readDeviceToken()) ?? (await currentToken());
    if (token) {
      await updateDoc(userDoc(uid), { pushTokens: arrayRemove(token) });
    }
  } catch {
    // Signing out must never fail because a token could not be cleaned up.
  }
  // Whoever signs in next makes their own choice; they should not inherit
  // the last person's switch.
  await AsyncStorage.multiRemove([OPT_OUT_KEY, TOKEN_KEY]).catch(() => {});
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
