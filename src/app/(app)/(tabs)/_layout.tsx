import React from 'react';
import { Tabs } from 'expo-router';
import { Activity, Home, UserCircle2, Users } from 'lucide-react-native';
import { FloatingTabBar } from '../../../components/FloatingTabBar';

/**
 * Four destinations — under the five-item ceiling, and each one is a place
 * rather than an action. Adding an expense is a task, so it lives on a floating
 * button that opens a sheet instead of stealing a tab.
 *
 * The bar itself is ours (see FloatingTabBar): it floats clear of the screen
 * edge and the selected tab rides above it, which the stock bar cannot do
 * because it clips anything that leaves its bounds.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Balances',
          tabBarIcon: Home as never,
          tabBarAccessibilityLabel: 'Balances',
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Rooms',
          tabBarIcon: Users as never,
          tabBarAccessibilityLabel: 'Rooms',
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: Activity as never,
          tabBarAccessibilityLabel: 'Activity log',
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: UserCircle2 as never,
          tabBarAccessibilityLabel: 'Account',
        }}
      />
    </Tabs>
  );
}
