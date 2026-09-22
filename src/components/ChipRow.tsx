import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { Text } from './Text';

export interface ChipItem<T extends string> {
  value: T;
  label: string;
  Icon?: LucideIcon;
}

interface Props<T extends string> {
  items: ChipItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}

/** Horizontally scrolling single-select chips — categories, rooms, payers. */
export function ChipRow<T extends string>({ items, value, onChange, label }: Props<T>) {
  const { c } = useTheme();

  return (
    <View>
      {label ? <Text variant="label" tone="muted" style={styles.label}>{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item) => {
          const active = item.value === value;
          const Icon = item.Icon;
          return (
            <Pressable
              key={item.value}
              onPress={() => onChange(item.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? c.primary : c.card,
                  borderColor: active ? c.primary : c.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {Icon ? (
                <Icon size={16} color={active ? c.onPrimary : c.textMuted} strokeWidth={2.2} />
              ) : null}
              <Text variant="smallStrong" style={{ color: active ? c.onPrimary : c.text }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: space.xs },
  track: { gap: space.sm, paddingRight: space.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
    minHeight: 40, paddingHorizontal: space.md,
    borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
});
