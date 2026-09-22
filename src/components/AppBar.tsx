import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { space, HIT } from '../theme/tokens';
import { Text } from './Text';

interface Props {
  title: string;
  subtitle?: string;
  /** 'back' shows a chevron, 'close' an X — modals should use 'close'. */
  leading?: 'back' | 'close' | 'none';
  onLeadingPress?: () => void;
  right?: React.ReactNode;
}

export function AppBar({ title, subtitle, leading = 'back', onLeadingPress, right }: Props) {
  const { c } = useTheme();
  const Icon = leading === 'close' ? X : ChevronLeft;

  const handlePress = () => {
    if (onLeadingPress) return onLeadingPress();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View style={[styles.row, { borderBottomColor: c.border }]}>
      {leading === 'none' ? (
        <View style={styles.slot} />
      ) : (
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [styles.slot, { opacity: pressed ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={leading === 'close' ? 'Close' : 'Go back'}
          hitSlop={8}
        >
          <Icon size={24} color={c.text} strokeWidth={2} />
        </Pressable>
      )}

      <View style={styles.titleWrap}>
        <Text variant="subheading" numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      <View style={[styles.slot, styles.rightSlot]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.xs,
  },
  slot: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  rightSlot: { width: 'auto', minWidth: HIT },
  titleWrap: { flex: 1, paddingHorizontal: space.xs },
});
