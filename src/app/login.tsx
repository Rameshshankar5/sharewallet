import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AtSign, KeyRound } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useKeyboardVisible } from '../hooks/useKeyboard';
import { APP_NAME } from '../lib/app';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Banner } from '../components/Banner';
import { Illustration } from '../components/Illustration';
import { ForgotPasswordSheet } from '../components/ForgotPasswordSheet';

export default function LoginScreen() {
  const { signIn, error, clearError } = useAuth();
  const { c } = useTheme();
  const keyboardUp = useKeyboardVisible();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [forgotOpen, setForgotOpen] = useState(false);

  const emailError = touched.email && !email.trim() ? 'Enter your email address.' : null;
  const passwordError = touched.password && !password ? 'Enter your password.' : null;
  const canSubmit = !!email.trim() && !!password && !busy;

  const submit = async () => {
    setTouched({ email: true, password: true });
    if (!canSubmit) return;
    setBusy(true);
    try {
      await signIn(email, password);
    } catch {
      // The banner below renders the message from AuthContext.
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
        <ScrollView
          contentContainerStyle={[styles.scroll, keyboardUp && styles.scrollTyping]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            {/* The illustration is the first thing to go when space is tight — */}
            {/* the fields matter more than the decoration. */}
            {keyboardUp ? null : <Illustration name="balance" size={132} />}
            <Text variant={keyboardUp ? 'title' : 'display'} center style={styles.title}>
              {APP_NAME}
            </Text>
            {keyboardUp ? null : (
              <Text variant="small" tone="muted" center style={styles.tagline}>
                Split what you spend with your friends, and always know who owes what.
              </Text>
            )}
          </View>

          {error ? (
            <View style={styles.banner}>
              <Banner tone="error" title="Sign-in failed" message={error} />
            </View>
          ) : null}

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={(t) => { setEmail(t); if (error) clearError(); }}
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              error={emailError}
              icon={AtSign}
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="you@example.com"
              returnKeyType="next"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); if (error) clearError(); }}
              onBlur={() => setTouched((s) => ({ ...s, password: true }))}
              error={passwordError}
              icon={KeyRound}
              password
              autoComplete="current-password"
              textContentType="password"
              placeholder="Your password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            <Button label="Sign in" onPress={submit} loading={busy} full />

            <Button
              label="Forgotten your password?"
              variant="ghost"
              onPress={() => setForgotOpen(true)}
              full
            />
          </View>

          <View style={[styles.note, { borderTopColor: c.border }, keyboardUp && styles.hidden]}>
            <Text variant="caption" tone="faint" center>
              New here? You need an email address you can open.
            </Text>
            <Button
              label="Create an account"
              variant="secondary"
              onPress={() => router.replace('/signup')}
              full
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ForgotPasswordSheet
        visible={forgotOpen}
        initialEmail={email}
        onClose={() => setForgotOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  // Typing: start at the top so nothing is pushed under the keyboard.
  scrollTyping: { justifyContent: 'flex-start', gap: space.lg },
  hero: { alignItems: 'center' },
  title: { marginTop: space.md },
  tagline: { marginTop: space.xs, maxWidth: 300 },
  banner: {},
  form: { gap: space.lg },
  note: { paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: space.md },
  hidden: { display: 'none' },
});
