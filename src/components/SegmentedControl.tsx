import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { Text } from './Text';

/** Optional semantic colouring — money in is green, money out is red. */
export type SegmentTone = 'default' | 'positive' | 'negative';

export interface Segment<T extends string> {
  value: T;
  label: string;
  Icon?: LucideIcon;
  tone?: SegmentTone;
}

interface Props<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}

export function SegmentedControl<T extends string>({ segments, value, onChange, label }: Props<T>) {
  const { c } = useTheme();

  const toneColor: Record<SegmentTone, string> = {
    default: c.text,
    positive: c.positive,
    negative: c.negative,
  };
  const toneFill: Record<SegmentTone, string> = {
    default: c.card,
    positive: c.positiveSoft,
    negative: c.negativeSoft,
  };

  return (
    <View>
      {label ? <Text variant="label" tone="muted" style={styles.label}>{label}</Text> : null}
      <View style={[styles.track, { backgroundColor: c.elevated, borderColor: c.border }]}>
        {segments.map((s) => {
          const active = s.value === value;
          const tone = s.tone ?? 'default';
          const Icon = s.Icon;

          // Toned segments keep their colour even when unselected, just dimmer:
          // the direction of the money should be readable at a glance, while
          // selection is carried by the fill and border.
          const fg = tone === 'default'
            ? (active ? c.text : c.textMuted)
            : toneColor[tone];

          return (
            <Pressable
              key={s.value}
              onPress={() => onChange(s.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={s.label}
              style={({ pressed }) => [
                styles.seg,
                {
                  backgroundColor: active ? toneFill[tone] : 'transparent',
                  borderColor: active
                    ? (tone === 'default' ? c.borderStrong : toneColor[tone])
                    : 'transparent',
                  opacity: active ? 1 : pressed ? 0.5 : tone === 'default' ? 1 : 0.6,
                },
              ]}
            >
              {Icon ? <Icon size={16} color={fg} strokeWidth={2.4} /> : null}
              <Text
                variant={active ? 'smallStrong' : 'small'}
                style={{ color: fg }}
                numberOfLines={1}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: space.xs },
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  seg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xs,
  },
});
