import React, { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { MailCheck, RotateCw } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { space } from '../theme/tokens';
import { abandonSignup, resendVerification, SignupError } from '../services/signup';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { Banner } from '../components/Banner';
import { Illustration } from '../components/Illustration';

/** Firebase throttles verification emails; this keeps people off that limit. */
const RESEND_WAIT_S = 60;

/**
 * Step two: waiting for the link in the email to be tapped.
 *
 * The link opens in a browser, not the app, so there is no callback to wait
 * for. Instead the account is re-checked whenever the app comes back to the
 * foreground — which is exactly what happens after tapping the link and
 * switching back — and on the button, for anyone who does it the other way
 * round.
 */
export default function VerifyEmailScreen() {
  const { user, refreshUser, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [wait, setWait] = useState(RESEND_WAIT_S);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const check = useCallback(async (quiet: boolean) => {
    if (!quiet) setChecking(true);
    setError(null);
    try {
      await refreshUser();
      // The route guard moves on by itself once the address is verified; if
      // we are still here, it isn't.
      if (!quiet) setNotYet(true);
    } catch {
      if (!quiet) setError('Could not check. Make sure you are online and try again.');
    } finally {
      if (!quiet) setChecking(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check(true);
    });
    return () => sub.remove();
  }, [check]);

  const resend = async () => {
    if (!user) return;
    setError(null);
    try {
      await resendVerification(user);
      setSent(true);
      setWait(RESEND_WAIT_S);
    } catch (e) {
      setError(e instanceof SignupError ? e.message : 'Could not send the email.');
    }
  };

  const startOver = async () => {
    // Deleting signs them out. If it fails, signing out still gets them back
    // to the start; the leftover account is harmless, just untidy.
    if (user) await abandonSignup(user).catch(() => {});
    await signOut();
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Illustration name="locked" size={120} />
          <Text variant="title" center style={styles.title}>Check your email</Text>
          <Text variant="body" tone="muted" center style={styles.body}>
            We sent a link to{'\n'}
            <Text variant="bodyStrong">{user?.email ?? 'your address'}</Text>
            {'\n'}Open it to confirm the address is yours, then come back here.
          </Text>
        </View>

        {error ? <Banner tone="error" title="Something went wrong" message={error} /> : null}
        {notYet && !error ? (
          <Banner
            tone="warning"
            title="Not confirmed yet"
            message="Tap the link in the email first. It can take a minute to arrive — check your spam folder too."
          />
        ) : null}
        {sent && !notYet && !error ? (
          <Banner tone="success" title="Sent again" message="Use the newest email; older links stop working." />
        ) : null}

        <View style={styles.actions}>
          <Button
            label="I've opened the link"
            icon={MailCheck}
            onPress={() => { void check(false); }}
            loading={checking}
            full
          />
          <Button
            label={wait > 0 ? `Send it again (${wait}s)` : 'Send it again'}
            icon={RotateCw}
            variant="secondary"
            onPress={resend}
            disabled={wait > 0}
            full
          />
          <Button label="Use a different email" variant="ghost" onPress={startOver} full />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  hero: { alignItems: 'center' },
  title: { marginTop: space.md },
  body: { marginTop: space.sm, maxWidth: 320 },
  actions: { gap: space.md },
});
