import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AtSign, MailCheck, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { requestPasswordReset, ResetError } from '../services/resetRequests';
import { Text } from './Text';
import { Input } from './Input';
import { Button } from './Button';
import { Banner } from './Banner';

interface Props {
  visible: boolean;
  /** Prefilled from whatever they already typed on the login screen. */
  initialEmail: string;
  onClose: () => void;
}

/**
 * "I've forgotten my password."
 *
 * Nobody can set another person's Firebase password from a phone — that needs
 * the Admin SDK, which needs a server. So this does not reset anything. It
 * raises a request the superadmin sees, and approving it has Firebase send a
 * reset link to that address.
 *
 * The confirmation is deliberately the same whether or not an account exists.
 * Saying "no such account" would make this screen a way for anyone holding the
 * APK to find out who is in the group.
 */
export function ForgotPasswordSheet({ visible, initialEmail, onClose }: Props) {
  const { c } = useTheme();
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    onClose();
    // Reset after the modal is gone, so the content does not visibly change
    // as it animates out.
    setTimeout(() => { setSent(false); setError(null); }, 250);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof ResetError ? e.message : 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />

      <View style={styles.dock} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.head}>
                <Text variant="heading">
                  {sent ? 'Request sent' : 'Forgotten your password?'}
                </Text>
                <Pressable
                  onPress={close}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X size={22} color={c.textMuted} strokeWidth={2.2} />
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" style={styles.body}>
                {sent ? (
                  <View style={styles.doneWrap}>
                    <View style={[styles.doneIcon, { backgroundColor: c.positiveSoft }]}>
                      <MailCheck size={26} color={c.positive} strokeWidth={2.2} />
                    </View>
                    <Text variant="small" tone="muted">
                      If that address belongs to an account, your group admin will
                      see the request. Once they approve it you will get an email
                      with a link to choose a new password.
                    </Text>
                    <Text variant="caption" tone="faint">
                      Nothing has changed yet, so your current password still works
                      if you remember it.
                    </Text>
                    <Button label="Done" onPress={close} full />
                  </View>
                ) : (
                  <View style={styles.form}>
                    {error ? <Banner tone="error" title="Not sent" message={error} /> : null}

                    <Text variant="small" tone="muted">
                      Your admin has to approve this. They cannot see or choose your
                      password — approving just asks Firebase to email you a link so
                      you can set a new one yourself.
                    </Text>

                    <Input
                      label="Your email address"
                      value={email}
                      onChangeText={setEmail}
                      icon={AtSign}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      inputMode="email"
                      placeholder="you@example.com"
                      required
                    />

                    <Button
                      label="Ask my admin to reset it"
                      onPress={submit}
                      loading={busy}
                      disabled={!email.trim() || busy}
                      full
                    />
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  dock: { flex: 1, justifyContent: 'flex-end', padding: space.md },
  sheet: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    maxHeight: '90%',
    gap: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { flexGrow: 0 },
  form: { gap: space.lg },
  doneWrap: { gap: space.md, alignItems: 'flex-start' },
  doneIcon: {
    width: 52, height: 52, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
});
