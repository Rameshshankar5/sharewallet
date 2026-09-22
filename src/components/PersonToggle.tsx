import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, HIT } from '../theme/tokens';
import { Avatar } from './Avatar';
import { Text } from './Text';

interface Props {
  uid: string;
  name: string;
  subtitle?: string;
  selected: boolean;
  onToggle: () => void;
  isYou?: boolean;
  disabled?: boolean;
}

export function PersonToggle({ uid, name, subtitle, selected, onToggle, isYou, disabled }: Props) {
  const { c } = useTheme();

  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={`${name}${isYou ? ' (you)' : ''}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? c.primarySoft : c.card,
          borderColor: selected ? c.primary : c.border,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Avatar uid={uid} name={name} size={36} highlighted={isYou} />
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {name}{isYou ? ' (you)' : ''}
        </Text>
        {subtitle ? <Text variant="caption" tone="muted" numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      {/* Shape + tick, not colour alone, so the selected state survives */}
      {/* greyscale and colour-blindness. */}
      <View
        style={[
          styles.box,
          {
            borderColor: selected ? c.primary : c.borderStrong,
            backgroundColor: selected ? c.primary : 'transparent',
          },
        ]}
      >
        {selected ? <Check size={15} color={c.onPrimary} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: HIT + 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1 },
  box: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
});
