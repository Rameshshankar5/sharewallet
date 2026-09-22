import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { changeOwnPassword } from '../services/users';
import { space } from '../theme/tokens';
import { Text } from './Text';
import { Input } from './Input';
import { Button } from './Button';
import { Banner } from './Banner';
import { Illustration } from './Illustration';

const MIN_LENGTH = 8;

interface Props {
  /**
   * True on the first-run gate nobody can skip, where the password being
   * replaced is the temporary one the admin handed over. False when someone
   * opened this from Settings of their own accord — a different screen with
   * the same form, because the two cannot share a route: the route guard
   * exists to push people off the gate, and would push them off this too.
   */
  forced: boolean;
  /** Run once the change has succeeded and been acknowledged. */
  onDone: () => void;
}

export function ChangePasswordForm({ forced, onDone }: Props) {
  const { profile, signOut } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ next: false, confirm: false });

  const nextError = touched.next && next.length > 0 && next.length < MIN_LENGTH
    ? `Use at least ${MIN_LENGTH} characters.`
    : null;
  const confirmError = touched.confirm && confirm && confirm !== next
    ? 'The two passwords do not match.'
    : null;
  const sameAsOld = touched.next && next.length > 0 && next === current
    ? 'That is the password you already have.'
    : null;

  const canSubmit =
    !!current && next.length >= MIN_LENGTH && next === confirm && next !== current && !busy;

  const submit = async () => {
    setTouched({ next: true, confirm: true });
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await changeOwnPassword(auth(), current, next);
      if (forced) {
        // The profile listener flips `mustChangePassword`, and the route guard
        // moves us into the app — no manual navigation needed.
        return;
      }
      // Opened from Settings: nothing is watching for this, so say it worked
      // and let them leave on their own terms.
      setDone(true);
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? forced
            ? 'That temporary password is not correct.'
            : 'That current password is not correct.'
          : code === 'auth/weak-password'
            ? 'Firebase rejected that password. Try a longer one.'
            : code === 'auth/too-many-requests'
              ? 'Too many attempts. Wait a minute and try again.'
              : 'Could not change the password. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={styles.doneWrap}>
        <Illustration name="locked" size={116} />
        <Text variant="title" center style={styles.title}>Password changed</Text>
        <Text variant="small" tone="muted" center style={styles.sub}>
          Use your new password next time you sign in. Anyone signed in as you
          elsewhere will have to sign in again.
        </Text>
        <View style={styles.doneAction}>
          <Button label="Done" onPress={onDone} full />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {forced ? (
          <View style={styles.hero}>
            <Illustration name="locked" size={116} />
            <Text variant="title" center style={styles.title}>Choose your password</Text>
            <Text variant="small" tone="muted" center style={styles.sub}>
              Hi {profile?.displayName ?? 'there'} — replace the temporary password your admin gave you before you continue.
            </Text>
          </View>
        ) : null}

        {error ? <Banner tone="error" title="Could not update" message={error} /> : null}

        <View style={styles.form}>
          <Input
            label={forced ? 'Temporary password' : 'Current password'}
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
            error={nextError ?? sameAsOld}
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
          <Button
            label={forced ? 'Save and continue' : 'Change password'}
            onPress={submit}
            loading={busy}
            disabled={!canSubmit}
            full
          />
          {/* On the gate this is the only way out. From Settings there is a */}
          {/* close button, and offering sign-out here would just be a trap. */}
          {forced ? <Button label="Sign out" variant="ghost" onPress={signOut} full /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  hero: { alignItems: 'center' },
  title: { marginTop: space.md },
  sub: { marginTop: space.xs, maxWidth: 320 },
  form: { gap: space.lg },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  doneAction: { marginTop: space.xxl, alignSelf: 'stretch' },
});
