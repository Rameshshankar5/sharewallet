import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, Delete, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';
import { centsToInput, formatMoney } from '../lib/money';
import { evaluate, hasOperator, OPERATOR_GLYPH, press, prettyExpression } from '../lib/calc';
import { Text } from './Text';
import { Button } from './Button';

interface OpenOptions {
  /** What the answer is for: "Total amount", "Kasun's share". */
  title: string;
  /** Whatever is in the field now, so the sum can build on it. */
  initialText: string;
  onUse: (text: string) => void;
}

type Key = { key: string; label?: string; kind: 'digit' | 'op' | 'fn'; span?: number };

const ROWS: Key[][] = [
  [{ key: 'C', kind: 'fn' }, { key: 'back', kind: 'fn' }, { key: '/', kind: 'op' }, { key: '*', kind: 'op' }],
  [{ key: '7', kind: 'digit' }, { key: '8', kind: 'digit' }, { key: '9', kind: 'digit' }, { key: '-', kind: 'op' }],
  [{ key: '4', kind: 'digit' }, { key: '5', kind: 'digit' }, { key: '6', kind: 'digit' }, { key: '+', kind: 'op' }],
  [{ key: '1', kind: 'digit' }, { key: '2', kind: 'digit' }, { key: '3', kind: 'digit' }, { key: '.', kind: 'digit' }],
  [{ key: '0', kind: 'digit', span: 2 }, { key: '00', kind: 'digit' }, { key: '=', kind: 'fn' }],
];

/** Starting text for the keypad: the field's amount, without trailing ".00". */
function seed(text: string): string {
  const r = evaluate(text.replace(/[^0-9.]/g, ''));
  if (r.kind !== 'ok' || r.cents <= 0) return '';
  return centsToInput(r.cents).replace(/\.00$/, '');
}

/**
 * A calculator for amount fields.
 *
 * Returned as a hook plus one sheet element, like the photo picker: a screen
 * with several amount fields shares one calculator, and each field just says
 * what it is and where the answer goes.
 *
 * The keypad is its own rather than the phone's, because Android's number
 * keyboard has no + or × — which is the whole reason for this.
 */
export function useCalculator() {
  const [opts, setOpts] = useState<OpenOptions | null>(null);
  const [expr, setExpr] = useState('');

  const open = useCallback((next: OpenOptions) => {
    setExpr(seed(next.initialText));
    setOpts(next);
  }, []);

  const sheet = (
    <CalculatorSheet
      options={opts}
      expr={expr}
      setExpr={setExpr}
      onClose={() => setOpts(null)}
    />
  );

  return { open, sheet };
}

function CalculatorSheet({
  options, expr, setExpr, onClose,
}: {
  options: OpenOptions | null;
  expr: string;
  setExpr: (next: string) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const result = evaluate(expr);
  const negative = result.kind === 'ok' && result.cents < 0;
  const usable = result.kind === 'ok' && result.cents > 0;

  const tap = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (key === '=') {
      // Collapse the sum to its answer, so it can be built on.
      if (result.kind === 'ok' && result.cents >= 0) {
        setExpr(centsToInput(result.cents).replace(/\.00$/, '') || '');
      }
      return;
    }
    setExpr(press(expr, key));
  };

  const use = () => {
    if (!options || result.kind !== 'ok' || result.cents <= 0) return;
    options.onUse(centsToInput(result.cents));
    onClose();
  };

  let status: string;
  if (result.kind === 'error') status = result.message;
  else if (negative) status = 'The answer is below zero — an amount cannot be.';
  else if (result.kind === 'ok') status = `= ${formatMoney(result.cents)}`;
  else status = 'Type an amount or a sum';

  return (
    <Modal
      visible={!!options}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={[styles.backdrop, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close calculator" />
      <View style={styles.dock} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']}>
          <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.head}>
              <Text variant="heading" numberOfLines={1} style={styles.title}>
                {options?.title ?? 'Calculator'}
              </Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close calculator">
                <X size={22} color={c.textMuted} strokeWidth={2.2} />
              </Pressable>
            </View>

            <View style={[styles.display, { backgroundColor: c.background, borderColor: c.border }]}>
              <Text
                variant="title"
                numberOfLines={2}
                adjustsFontSizeToFit
                style={styles.expr}
                accessibilityLiveRegion="polite"
              >
                {expr ? prettyExpression(expr) : '0'}
              </Text>
              <Text
                variant={hasOperator(expr) && usable ? 'subheading' : 'small'}
                tone={result.kind === 'error' || negative ? 'negative' : hasOperator(expr) ? 'primary' : 'muted'}
                style={styles.result}
              >
                {status}
              </Text>
            </View>

            <View style={styles.pad}>
              {ROWS.map((row, i) => (
                <View key={i} style={styles.row}>
                  {row.map((k) => {
                    const isOp = k.kind === 'op';
                    const isFn = k.kind === 'fn';
                    const label = isOp ? OPERATOR_GLYPH[k.key as keyof typeof OPERATOR_GLYPH] : k.key;
                    return (
                      <Pressable
                        key={k.key}
                        onPress={() => tap(k.key)}
                        onLongPress={k.key === 'back' ? () => tap('C') : undefined}
                        accessibilityRole="button"
                        accessibilityLabel={
                          k.key === 'back' ? 'Delete' : k.key === 'C' ? 'Clear'
                            : k.key === '*' ? 'Times' : k.key === '/' ? 'Divided by'
                              : k.key === '-' ? 'Minus' : k.key === '+' ? 'Plus'
                                : k.key === '=' ? 'Equals' : k.key === '.' ? 'Point' : k.key
                        }
                        style={({ pressed }) => [
                          styles.key,
                          { flex: k.span ?? 1 },
                          {
                            backgroundColor: isOp ? c.primarySoft : isFn ? c.muted : c.elevated,
                            opacity: pressed ? 0.6 : 1,
                          },
                        ]}
                      >
                        {k.key === 'back' ? (
                          <Delete size={22} color={c.text} strokeWidth={2.2} />
                        ) : (
                          <Text
                            style={[
                              font.heading,
                              { color: isOp ? c.primary : c.text },
                            ]}
                          >
                            {label}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <Button
              label={usable ? `Use ${formatMoney((result as { cents: number }).cents)}` : 'Use this amount'}
              icon={Check}
              onPress={use}
              disabled={!usable}
              full
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  dock: { flex: 1, justifyContent: 'flex-end', padding: space.md },
  sheet: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { flex: 1 },
  display: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    alignItems: 'flex-end',
    minHeight: 96,
    justifyContent: 'center',
  },
  expr: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  result: { marginTop: space.xs, textAlign: 'right' },
  pad: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  key: {
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
