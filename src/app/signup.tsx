import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AtSign, UserRound } from 'lucide-react-native';
import { useKeyboardVisible } from '../hooks/useKeyboard';
import { space } from '../theme/tokens';
import { startSignup, SignupError } from '../services/signup';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Banner } from '../components/Banner';
import { Illustration } from '../components/Illustration';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Step one of signing yourself up: who you are and where to reach you.
 *
 * No password here on purpose. The address is proven first, by the link
 * Firebase emails, and the password comes after — see services/signup.ts.
 * Once the account exists the route guard moves on to the "check your email"
 * screen by itself.
 */
export default function SignupScreen() {
  const keyboardUp = useKeyboardVisible();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ name: false, email: false });

  const nameError = touched.name && !name.trim() ? 'Enter your name.' : null;
  const emailError = touched.email && !EMAIL.test(email.trim())
    ? 'Enter a working email address — you will need to open a link sent to it.'
    : null;
  const canSubmit = !!name.trim() && EMAIL.test(email.trim()) && !busy;

  const submit = async () => {
    setTouched({ name: true, email: true });
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await startSignup(name, email);
    } catch (e) {
      setError(e instanceof SignupError ? e.message : 'Could not create the account. Try again.');
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
            {keyboardUp ? null : <Illustration name="people" size={120} />}
            <Text variant="title" center style={styles.title}>Create your account</Text>
            {keyboardUp ? null : (
              <Text variant="small" tone="muted" center style={styles.tagline}>
                We will email you a link to confirm the address is yours. After that
                you choose your password.
              </Text>
            )}
          </View>

          {error ? <Banner tone="error" title="Account not created" message={error} /> : null}

          <View style={styles.form}>
            <Input
              label="Your name"
              value={name}
              onChangeText={setName}
              onBlur={() => setTouched((s) => ({ ...s, name: true }))}
              error={nameError}
              icon={UserRound}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              placeholder="What your friends call you"
              returnKeyType="next"
              maxLength={60}
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
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
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            <Button label="Send me the link" onPress={submit} loading={busy} full />
            <Button
              label="I already have an account"
              variant="ghost"
              onPress={() => router.replace('/login')}
              full
            />
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
  title: { marginTop: space.md },
  tagline: { marginTop: space.xs, maxWidth: 320 },
  form: { gap: space.lg },
});
