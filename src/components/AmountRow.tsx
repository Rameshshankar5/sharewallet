import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Lock, RotateCcw } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space, HIT } from '../theme/tokens';
import { CURRENCY_SYMBOL } from '../lib/money';
import { Avatar } from './Avatar';
import { Text } from './Text';
import { CalculatorButton } from './CalculatorButton';

interface Props {
  uid: string;
  name: string;
  isYou?: boolean;
  /** Raw text, so a half-typed "12." doesn't get clobbered on every keystroke. */
  value: string;
  onChangeText: (text: string) => void;
  /** True once the user has hand-typed this row; it stops auto-recalculating. */
  locked?: boolean;
  onUnlock?: () => void;
  hint?: string;
  /** Shows a calculator key beside the amount. */
  onCalculator?: () => void;
}

/**
 * One editable money row. Hand-editing a row "locks" it: the app then spreads
 * the remainder over the untouched rows only, so correcting one person's share
 * never silently rewrites the number someone else already agreed.
 */
export function AmountRow({
  uid, name, isYou, value, onChangeText, locked, onUnlock, hint, onCalculator,
}: Props) {
  const { c } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: c.border }]}>
      <Avatar uid={uid} name={name} size={34} highlighted={isYou} />

      <View style={styles.nameWrap}>
        <Text variant="smallStrong" numberOfLines={1}>
          {name}{isYou ? ' (you)' : ''}
        </Text>
        {hint ? <Text variant="caption" tone="faint" numberOfLines={1}>{hint}</Text> : null}
      </View>

      {locked && onUnlock ? (
        <Pressable
          onPress={onUnlock}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Reset ${name}'s amount to automatic`}
          style={({ pressed }) => [styles.lockBtn, { opacity: pressed ? 0.5 : 1 }]}
        >
          <RotateCcw size={16} color={c.textMuted} strokeWidth={2.2} />
        </Pressable>
      ) : null}

      <View
        style={[
          styles.field,
          {
            backgroundColor: c.background,
            borderColor: locked ? c.primary : c.border,
            borderWidth: locked ? 2 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        {locked ? <Lock size={13} color={c.primary} strokeWidth={2.4} /> : null}
        <Text variant="caption" tone="faint">{CURRENCY_SYMBOL}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0.00"
          placeholderTextColor={c.textFaint}
          selectTextOnFocus
          accessibilityLabel={`Amount for ${name}`}
          style={[
            styles.input,
            font.smallStrong,
            { color: c.text, fontVariant: ['tabular-nums'] },
          ]}
        />
      </View>

      {onCalculator ? (
        <CalculatorButton onPress={onCalculator} label={`Calculate ${name}'s amount`} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: HIT + 4,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameWrap: { flex: 1 },
  lockBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    width: 116,
    height: 42,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  input: { flex: 1, textAlign: 'right', padding: 0 },
});
