import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { changeOwnPassword } from '../services/users';
import { space } from '../theme/tokens';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Banner } from '../components/Banner';
import { Illustration } from '../components/Illustration';

const MIN_LENGTH = 8;

/**
 * Shown once, right after the admin hands over a temporary password. It can't
 * be skipped: the route guard keeps sending people back here until
 * `mustChangePassword` is cleared, so no shared starter password stays live.
 */
export default function ChangePasswordScreen() {
  const { profile, signOut } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ next: false, confirm: false });

  const nextError = touched.next && next.length > 0 && next.length < MIN_LENGTH
    ? `Use at least ${MIN_LENGTH} characters.`
    : null;
  const confirmError = touched.confirm && confirm && confirm !== next
    ? 'The two passwords do not match.'
    : null;

  const canSubmit =
    !!current && next.length >= MIN_LENGTH && next === confirm && !busy;

  const submit = async () => {
    setTouched({ next: true, confirm: true });
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await changeOwnPassword(auth(), current, next);
      // The profile listener flips `mustChangePassword`, and the route guard
      // moves us into the app — no manual navigation needed.
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? 'That temporary password is not correct.'
          : code === 'auth/weak-password'
            ? 'Firebase rejected that password. Try a longer one.'
            : 'Could not change the password. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Illustration name="locked" size={116} />
            <Text variant="title" center style={styles.title}>Choose your password</Text>
            <Text variant="small" tone="muted" center style={styles.sub}>
              Hi {profile?.displayName ?? 'there'} — replace the temporary password your admin gave you before you continue.
            </Text>
          </View>

          {error ? <Banner tone="error" title="Could not update" message={error} /> : null}

          <View style={styles.form}>
            <Input
              label="Temporary password"
              value={current}
              onChangeText={setCurrent}
              icon={KeyRound}
              password
              autoComplete="current-password"
              textContentType="password"
              required
            />
            <Input
              label="New password"
              value={next}
              onChangeText={setNext}
              onBlur={() => setTouched((s) => ({ ...s, next: true }))}
              error={nextError}
              helper={`At least ${MIN_LENGTH} characters.`}
              icon={ShieldCheck}
              password
              autoComplete="new-password"
              textContentType="newPassword"
              required
            />
            <Input
              label="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              onBlur={() => setTouched((s) => ({ ...s, confirm: true }))}
              error={confirmError}
              icon={ShieldCheck}
              password
              autoComplete="new-password"
              textContentType="newPassword"
              required
            />
            <Button label="Save and continue" onPress={submit} loading={busy} disabled={!canSubmit} full />
            <Button label="Sign out" variant="ghost" onPress={signOut} full />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  hero: { alignItems: 'center' },
  title: { marginTop: space.md },
  sub: { marginTop: space.xs, maxWidth: 320 },
  form: { gap: space.lg },
});
