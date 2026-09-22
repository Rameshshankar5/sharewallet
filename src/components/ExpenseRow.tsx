import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { formatMoney } from '../lib/money';
import { formatDate } from '../lib/time';
import { Card } from './Card';
import { ListRow } from './ListRow';
import { Text } from './Text';
import { Glyph } from './Glyph';
import { categoryIcon } from './icons';
import type { Expense } from '../types';

interface Props {
  expense: Expense;
  /** The viewing user, so the row can say what it means for them. */
  meUid: string;
  nameOf: (uid: string) => string;
  onPress: () => void;
  /** Show which room it belongs to — useful outside a room screen. */
  showRoom?: string | null;
}

export function ExpenseRow({ expense, meUid, nameOf, onPress, showRoom }: Props) {
  const { c } = useTheme();

  const paid = expense.payers[meUid] ?? 0;
  const share = expense.splits[meUid] ?? 0;
  const net = paid - share;

  const payerIds = Object.keys(expense.payers).filter((k) => expense.payers[k] > 0);
  const paidBy = payerIds.length === 1
    ? (payerIds[0] === meUid ? 'You paid' : `${nameOf(payerIds[0])} paid`)
    : `${payerIds.length} people paid`;

  return (
    <Card flush style={styles.card}>
      <ListRow
        leading={
          <View style={[styles.icon, { backgroundColor: c.elevated }]}>
            <Glyph icon={categoryIcon(expense.category)} size={19} color={expense.deleted ? c.textFaint : c.textMuted} />
          </View>
        }
        title={expense.deleted ? `${expense.description} (deleted)` : expense.description}
        subtitle={[
          `${paidBy} ${formatMoney(expense.totalCents)}`,
          showRoom ? showRoom : null,
          formatDate(expense.date),
        ].filter(Boolean).join(' · ')}
        trailing={
          expense.deleted ? (
            <Text variant="caption" tone="faint">removed</Text>
          ) : (
            <View style={styles.trailing}>
              <Text variant="caption" tone="muted">
                {net > 0 ? 'you lent' : net < 0 ? 'you borrowed' : 'no effect'}
              </Text>
              {net !== 0 ? (
                <Text
                  variant="smallStrong"
                  tabular
                  style={{ color: net > 0 ? c.positive : c.negative }}
                >
                  {formatMoney(Math.abs(net))}
                </Text>
              ) : null}
            </View>
          )
        }
        chevron
        onPress={onPress}
        style={expense.deleted ? { opacity: 0.55 } : undefined}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, overflow: 'hidden' },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  trailing: { alignItems: 'flex-end' },
});
