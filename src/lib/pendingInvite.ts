import AsyncStorage from '@react-native-async-storage/async-storage';
import { isInviteCode } from './links';

/**
 * An invite opened before its reader could act on it — signed out, or not
 * signed up yet. Held on the phone so that signing in, or all three steps of
 * signing up, does not lose the link somebody tapped to get here.
 */
const KEY = 'sharewallet.pendingInvite';

export async function savePendingInvite(code: string): Promise<void> {
  if (!isInviteCode(code)) return;
  await AsyncStorage.setItem(KEY, code).catch(() => {});
}

/** Returns the code once, and forgets it. */
export async function takePendingInvite(): Promise<string | null> {
  try {
    const code = await AsyncStorage.getItem(KEY);
    if (code) await AsyncStorage.removeItem(KEY);
    return isInviteCode(code) ? code : null;
  } catch {
    return null;
  }
}
