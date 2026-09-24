import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { DataProvider } from '../context/DataContext';
import { Loading } from '../components/Loading';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Sends people to the right place for their account state, and — just as
 * importantly — keeps them out of the wrong place. A member who is mid
 * password-change cannot navigate around it, and a signed-out user cannot land
 * on a tab by deep link.
 */
function RouteGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'booting') return;

    const top = segments[0];
    // An invite link routes itself once it has put the code somewhere safe.
    if (top === 'i') return;

    const onGateScreen = top !== '(app)' && top !== undefined;

    if (status === 'ready') {
      if (onGateScreen) router.replace('/(app)/(tabs)');
      return;
    }

    // Everything below is a state the person must resolve before using the
    // app, so they're held on the matching screen. Signed out, they may move
    // between signing in and signing up.
    const allowed: Record<string, string[]> = {
      signedOut: ['login', 'signup'],
      mustChangePassword: ['change-password'],
      verifyEmail: ['verify-email'],
      finishSignup: ['finish-signup'],
    };
    const here = allowed[status] ?? ['blocked'];
    if (!here.includes(top ?? '')) router.replace(`/${here[0]}`);
  }, [status, segments, router]);

  if (status === 'booting') return <Loading label="Signing you in…" />;
  return <>{children}</>;
}

function Shell() {
  const { c, isDark } = useTheme();

  // The window behind the app keeps the phone's own colour otherwise, which
  // shows through as a flash of the wrong theme during screen transitions —
  // obvious when someone has forced Light on a dark phone, or the reverse.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.background).catch(() => {});
  }, [c.background]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.background },
          animation: 'fade',
        }}
      >
        {/* Signed-in routes live behind (app), which refuses to render */}
        {/* without a profile. Their URLs are unaffected by the group. */}
        <Stack.Screen name="(app)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="blocked" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="finish-signup" />
        <Stack.Screen name="i/[code]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    // Hide the splash on font error too — a fallback font beats a stuck splash.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <RouteGuard>
              <DataProvider>
                <Shell />
              </DataProvider>
            </RouteGuard>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
