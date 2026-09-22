import React from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import { Loading } from '../../components/Loading';

/**
 * The gate for every signed-in screen.
 *
 * Screens under here read `profile.uid` directly, which is only safe because
 * nothing below this component renders until a profile exists. The root
 * redirect is not enough on its own: redirects happen inside an effect, so a
 * screen would already have rendered once — and read a null profile — before
 * being sent away. Blocking here makes that impossible rather than unlikely.
 *
 * Route groups in parentheses don't appear in URLs, so `/expense/new`,
 * `/room/123` and the rest are unchanged by this wrapper.
 */
export default function AppLayout() {
  const { status, profile } = useAuth();
  const { c } = useTheme();

  if (status !== 'ready' || !profile) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      {/* Sheets slide up from the bottom: they're tasks, not destinations. */}
      <Stack.Screen name="expense/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="settle/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="room/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="admin/new-user" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="settings/password" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
