import React from 'react';
import { Screen } from '../components/Screen';
import { ChangePasswordForm } from '../components/ChangePasswordForm';

/**
 * Shown once, right after the admin hands over a temporary password. It can't
 * be skipped: the route guard keeps sending people back here until
 * `mustChangePassword` is cleared, so no shared starter password stays live.
 *
 * Changing your password later, by choice, is a different screen —
 * `(app)/change-password` — because the guard's job here is to push signed-in
 * people off this route, and it cannot tell "stuck on the gate" from "came
 * here deliberately".
 */
export default function ForcedChangePasswordScreen() {
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      {/* Navigation is the route guard's, once the profile listener clears
          `mustChangePassword`. */}
      <ChangePasswordForm forced onDone={() => {}} />
    </Screen>
  );
}
