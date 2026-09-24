import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useKeyboardVisible } from '../hooks/useKeyboard';
import { space } from '../theme/tokens';
import { finishSignup, needsPassword, SignupError } from '../services/signup';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Banner } from '../components/Banner';
import { Loading } from '../components/Loading';

const MIN_LENGTH = 8;

/**
 * Step three: the email is proven, so now the password.
 *
 * Creating the profile here is what actually lets somebody into the app; the
 * route guard sees it arrive and moves on. The name is asked again, prefilled,
 * because this is also where somebody lands who signed up on another phone.
 */
export default function FinishSignupScreen() {
  const { user, signOut } = useAuth();
  const keyboardUp = useKeyboardVisible();

  const [askPassword, setAskPassword] = useState<boolean | null>(null);
  const [name, setName] = useState(user?.displayName ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (user) void needsPassword(user).then(setAskPassword);
  }, [user]);

  if (!user || askPassword === null) return <Loading />;

  const nameError = touched && !name.trim() ? 'Enter your name.' : null;
  const passwordError = askPassword && touched && password.length < MIN_LENGTH
    ? `Use at least ${MIN_LENGTH} characters.`
    : null;
  const confirmError = askPassword && touched && confirm !== password
    ? 'The two passwords do not match.'
    : null;
  const valid = !!name.trim()
    && (!askPassword || (password.length >= MIN_LENGTH && password === confirm));

  const submit = async () => {
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await finishSignup(user, name, askPassword ? password : null);
    } catch (e) {
      setError(e instanceof SignupError ? e.message : 'Could not finish. Try again.');
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, keyboardUp && styles.scrollTyping]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text variant="title" center>Email confirmed</Text>
            <Text variant="small" tone="muted" center style={styles.tagline}>
              {askPassword
                ? `Now choose the password you will use to sign in as ${user.email}.`
                : `One last check of your name, and you are in.`}
            </Text>
          </View>

          {error ? <Banner tone="error" title="Not finished" message={error} /> : null}

          <View style={styles.form}>
            <Input
              label="Your name"
              value={name}
              onChangeText={setName}
              error={nameError}
              icon={UserRound}
              autoCapitalize="words"
              autoComplete="name"
              maxLength={60}
            />
            {askPassword ? (
              <>
                <Input
                  label="New password"
                  value={password}
                  onChangeText={setPassword}
                  error={passwordError}
                  icon={KeyRound}
                  password
                  autoComplete="new-password"
                  textContentType="newPassword"
                  helper={`At least ${MIN_LENGTH} characters.`}
                />
                <Input
                  label="Type it again"
                  value={confirm}
                  onChangeText={setConfirm}
                  error={confirmError}
                  icon={KeyRound}
                  password
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
              </>
            ) : null}

            <Button label="Finish" icon={ShieldCheck} onPress={submit} loading={busy} full />
            {/* Signing out before a password is set would leave an account */}
            {/* nobody knows the password to. */}
            {askPassword ? null : (
              <Button label="Sign out" variant="ghost" onPress={signOut} full />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  scrollTyping: { justifyContent: 'flex-start', gap: space.lg },
  hero: { alignItems: 'center' },
  tagline: { marginTop: space.xs, maxWidth: 320 },
  form: { gap: space.lg },
});
