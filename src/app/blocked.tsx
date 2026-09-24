import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { missingKeys } from '../firebase/config';
import { space } from '../theme/tokens';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Banner } from '../components/Banner';
import { EmptyState } from '../components/EmptyState';

/**
 * Both dead-ends share this screen, because each one needs the same thing:
 * a plain explanation and a way out, rather than a blank page or a crash.
 */
export default function BlockedScreen() {
  const { status, signOut, user } = useAuth();

  if (status === 'unconfigured') {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <EmptyState
            illo="locked"
            title="Firebase isn't connected yet"
            message="Copy .env.example to .env and paste your Firebase web config, then restart with `npx expo start -c`."
          />
          <View style={styles.banner}>
            <Banner
              tone="warning"
              title="Missing values"
              message={missingKeys.map((k) => `EXPO_PUBLIC_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`).join('\n')}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <EmptyState
          illo="locked"
          title="Your access is paused"
          message={`The admin has switched ${user?.email ?? 'this account'} off. Ask them to turn it back on.`}
          action={<Button label="Sign out" variant="secondary" onPress={signOut} />}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  banner: { marginTop: space.lg },
});
