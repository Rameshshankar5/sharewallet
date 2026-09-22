import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, Home, UserCircle2, Users } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { font, space } from '../../../theme/tokens';

/** Height of the tabs themselves, before any system inset is added. */
const TAB_CONTENT_HEIGHT = 60;

/**
 * Four destinations — under the five-item ceiling, and each one is a place
 * rather than an action. Adding an expense is a task, so it lives on a floating
 * button that opens a sheet instead of stealing a tab.
 */
export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textFaint,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          // Android draws edge to edge, so the gesture bar sits on top of the
          // tabs unless we reserve its height. Hardcoding a value gets this
          // wrong on every device that isn't the one it was tuned on.
          height: TAB_CONTENT_HEIGHT + insets.bottom,
          paddingTop: space.sm,
          paddingBottom: Math.max(insets.bottom, space.sm),
        },
        // Icon + label, always. An icon on its own is a guessing game.
        tabBarLabelStyle: { ...font.caption, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Balances',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={2.2} />,
          tabBarAccessibilityLabel: 'Balances',
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Rooms',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} strokeWidth={2.2} />,
          tabBarAccessibilityLabel: 'Rooms',
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <Activity size={size} color={color} strokeWidth={2.2} />,
          tabBarAccessibilityLabel: 'Activity log',
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <UserCircle2 size={size} color={color} strokeWidth={2.2} />,
          tabBarAccessibilityLabel: 'Account',
        }}
      />
    </Tabs>
  );
}
