import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { TAB_BAR_CLEARANCE } from './TabBar';
import { Text } from './Text';

interface Props {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
}

export function Fab({ label, onPress, icon: Icon = Plus }: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: c.primary,
          shadowColor: '#000',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon size={20} color={c.onPrimary} strokeWidth={2.6} />
      <Text variant="bodyStrong" style={{ color: c.onPrimary }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: space.lg,
    // Sits above the floating tab bar rather than behind it.
    bottom: TAB_BAR_CLEARANCE - space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
