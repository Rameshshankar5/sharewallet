import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, HIT } from '../theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}

export function Button({
  label, onPress, variant = 'primary', icon: Icon,
  loading, disabled, full, style, haptic = true,
}: Props) {
  const { c } = useTheme();
  const isDisabled = disabled || loading;

  const skin: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary, border: 'transparent' },
    secondary: { bg: c.elevated, fg: c.text, border: c.border },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
    danger: { bg: c.negativeSoft, fg: c.negative, border: 'transparent' },
  };
  const s = skin[variant];

  return (
    <Pressable
      onPress={() => {
        if (isDisabled) return;
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: s.bg,
          borderColor: s.border,
          // Opacity only — never scale or shift layout, which makes rows jump.
          opacity: isDisabled ? 0.45 : pressed ? 0.75 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={s.fg} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={18} color={s.fg} strokeWidth={2.2} /> : null}
          <Text variant="bodyStrong" style={{ color: s.fg }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: HIT,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
