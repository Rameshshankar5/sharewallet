import React from 'react';
import { router } from 'expo-router';
import { Screen } from '../../../components/Screen';
import { AppBar } from '../../../components/AppBar';
import { ChangePasswordForm } from '../../../components/ChangePasswordForm';

/**
 * Changing your password because you want to, from Account → Settings.
 *
 * A separate route from the root `/change-password` gate, and deliberately not
 * `(app)/change-password.tsx`: route groups are invisible in URLs, so that file
 * would resolve to `/change-password` too and collide with the gate.
 *
 * The split is the fix for tapping "Change password" and landing on Balances.
 * The root guard's job is to push signed-in people off the gate, and it reads
 * the route, not the intent — so a signed-in person opening the gate on purpose
 * was indistinguishable from one stuck on it, and got bounced into the tabs.
 */
export default function ChangePasswordScreen() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppBar title="Change password" leading="close" />
      <ChangePasswordForm forced={false} onDone={() => router.back()} />
    </Screen>
  );
}
