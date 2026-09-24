import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { autoRegisterForPush, pushConfigured } from '../services/push';

/**
 * Notifications arriving while the app is open are still shown.
 *
 * The default is to stay silent when the app is in the foreground, which is
 * wrong here: somebody reading the Balances tab is exactly the person who
 * wants to know an expense just landed.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device once a profile exists, and makes a tapped
 * notification open the thing it was about.
 *
 * Registration is deliberately silent about failure. Being unable to receive
 * notifications is not a reason to put an error in front of somebody who
 * opened the app to check a balance; the Account screen says plainly whether
 * they are on or off, which is where the question actually gets asked.
 */
export function usePushNotifications(uid: string | null) {
  useEffect(() => {
    if (!uid || !pushConfigured) return;
    void autoRegisterForPush(uid).catch(() => {});
  }, [uid]);

  useEffect(() => {
    if (!pushConfigured) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      // A notification that dumps you on the home screen has wasted the tap.
      if (data?.type === 'expense' && typeof data.expenseId === 'string') {
        router.push(`/expense/${data.expenseId}`);
      } else if (data?.type === 'settlement') {
        router.push('/(app)/(tabs)/activity');
      } else if (data?.type === 'friend' && typeof data.uid === 'string') {
        router.push(`/friend/${data.uid}`);
      } else if (data?.type === 'room' && typeof data.roomId === 'string') {
        router.push(`/room/${data.roomId}`);
      }
    });
    return () => sub.remove();
  }, []);
}
