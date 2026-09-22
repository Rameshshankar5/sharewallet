import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AtSign, Copy, RefreshCw, User, UserPlus } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { space } from '../../../theme/tokens';
import { APP_NAME } from '../../../lib/app';
import { createMemberAccount } from '../../../services/users';
import { Screen } from '../../../components/Screen';
import { AppBar } from '../../../components/AppBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { SegmentedControl } from '../../../components/SegmentedControl';

/**
 * Readable temporary password — no look-alike characters (0/O, 1/l/I), because
 * this gets read aloud or typed from a message before it's ever copy-pasted.
 */
function generatePassword(): string {
  const words = ['mango', 'kandy', 'river', 'lotus', 'amber', 'cinnamon', 'harbour', 'ginger', 'silver', 'monsoon'];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(Math.random() * 9000) + 1000);
  return `${word}-${digits}`;
}

export default function NewUserScreen() {
  const { profile } = useAuth();
  const { c } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generatePassword);
  const [role, setRole] = useState<'member' | 'superadmin'>('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameError = showErrors && !displayName.trim() ? "Enter your friend's name." : null;
  const emailError = showErrors && !emailValid ? 'Enter a valid email address.' : null;
  const passwordError = showErrors && password.length < 8 ? 'Use at least 8 characters.' : null;

  const canSave = !!displayName.trim() && emailValid && password.length >= 8 && !saving;

  const submit = async () => {
    setShowErrors(true);
    setError(null);
    if (!canSave) return;
    setSaving(true);
    try {
      await createMemberAccount(
        { email, password, displayName, role },
        profile!,
      );
      setCreated({ name: displayName.trim(), email: email.trim(), password });
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code === 'auth/email-already-in-use'
          ? 'An account already uses that email address.'
          : code === 'auth/invalid-email'
            ? 'That email address is not valid.'
            : code === 'auth/weak-password'
              ? 'Firebase rejected that password. Try a longer one.'
              : 'Could not create the account. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    const message =
      `Hi ${created.name}, here is your ${APP_NAME} login.\n` +
      `Email: ${created.email}\n` +
      `Temporary password: ${created.password}\n` +
      `You'll be asked to choose your own password when you first sign in.`;

    return (
      <Screen edges={['top', 'left', 'right']}>
        <AppBar title="Account created" leading="close" onLeadingPress={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content}>
          <Banner
            tone="success"
            title={`${created.name} can sign in now`}
            message="Send them these details. They'll be forced to pick their own password on first sign-in, so this temporary one stops working."
          />

          <Card style={styles.credCard}>
            <View>
              <Text variant="label" tone="muted">EMAIL</Text>
              <Text variant="bodyStrong" selectable>{created.email}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <View>
              <Text variant="label" tone="muted">TEMPORARY PASSWORD</Text>
              <Text variant="bodyStrong" selectable tabular>{created.password}</Text>
            </View>
          </Card>

          <Button
            label="Copy the whole message"
            icon={Copy}
            onPress={() => Clipboard.setStringAsync(message)}
            full
          />
          <Button
            label="Create another account"
            variant="secondary"
            icon={UserPlus}
            onPress={() => {
              setCreated(null);
              setDisplayName('');
              setEmail('');
              setPassword(generatePassword());
              setShowErrors(false);
            }}
            full
          />
          <Button label="Done" variant="ghost" onPress={() => router.back()} full />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppBar title="Create an account" leading="close" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <Banner tone="error" title="Not created" message={error} /> : null}

          <Card style={styles.block}>
            <Input
              label="Name"
              value={displayName}
              onChangeText={setDisplayName}
              error={nameError}
              icon={User}
              placeholder="Kasun Perera"
              autoCapitalize="words"
              required
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              error={emailError}
              helper="They sign in with this. It doesn't need to be verified."
              icon={AtSign}
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              required
            />
            <Input
              label="Temporary password"
              value={password}
              onChangeText={setPassword}
              error={passwordError}
              helper="They must replace this the first time they sign in."
              required
            />
            <Button
              label="Generate a new one"
              variant="ghost"
              icon={RefreshCw}
              onPress={() => setPassword(generatePassword())}
            />

            <SegmentedControl<'member' | 'superadmin'>
              label="Role"
              value={role}
              onChange={setRole}
              segments={[
                { value: 'member', label: 'Member' },
                { value: 'superadmin', label: 'Admin' },
              ]}
            />
            <Text variant="caption" tone="faint">
              {role === 'member'
                ? 'Can add expenses, create rooms, and see everything they are part of.'
                : 'Can also create and pause accounts. Only give this to someone you fully trust.'}
            </Text>
          </Card>

          <Banner
            tone="info"
            title="You stay signed in"
            message="Creating an account here does not sign you out — the app uses a separate, temporary connection to make it."
          />
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <Button
            label="Create account"
            icon={UserPlus}
            onPress={submit}
            loading={saving}
            disabled={!canSave}
            full
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  block: { gap: space.lg },
  credCard: { gap: space.md },
  divider: { height: StyleSheet.hairlineWidth },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: Platform.OS === 'ios' ? space.xxl : space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
