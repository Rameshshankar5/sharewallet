import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Pencil, RotateCcw, Trash2 } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { formatMoney } from '../../../lib/money';
import { formatDateTime, formatDate } from '../../../lib/time';
import { pairwiseFromExpense } from '../../../lib/balance';
import { auditCol } from '../../../services/collections';
import { setExpenseDeleted } from '../../../services/expenses';
import { Screen } from '../../../components/Screen';
import { AppBar } from '../../../components/AppBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Money } from '../../../components/Money';
import { Avatar } from '../../../components/Avatar';
import { ListRow } from '../../../components/ListRow';
import { SectionHeader } from '../../../components/SectionHeader';
import { ReceiptViewer, ReceiptCaption } from '../../../components/ReceiptViewer';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { AuditCard } from '../../../components/AuditCard';
import { EmptyState } from '../../../components/EmptyState';
import { Loading } from '../../../components/Loading';
import { Glyph } from '../../../components/Glyph';
import { categoryIcon, categoryLabel } from '../../../components/icons';
import type { AuditEntry } from '../../../types';

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { expenses, nameOf, roomNameOf, loading } = useData();
  const { c } = useTheme();

  const expense = expenses.find((e) => e.id === id);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(false);

  // The full history for this one expense, not just the slice held in the
  // global activity feed — an old expense should still show its whole story.
  useEffect(() => {
    if (!id || !profile) return;
    return onSnapshot(
      query(
        auditCol(),
        where('targetId', '==', id),
        // Security rules are not filters — a list query has to carry the same
        // constraint the rule checks, or Firestore rejects the whole query.
        where('viewerIds', 'array-contains', profile.uid),
        orderBy('at', 'desc'),
      ),
      (snap) => setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditEntry))),
      () => setHistory([]),
    );
  }, [id, profile]);

  const edges = useMemo(
    () => (expense ? pairwiseFromExpense(expense.payers, expense.splits) : []),
    [expense],
  );

  if (loading) return <Loading />;

  if (!expense) {
    return (
      <Screen>
        <AppBar title="Expense" />
        <EmptyState
          illo="activity"
          title="Expense not found"
          message="It may have been removed, or you may no longer have access to it."
        />
      </Screen>
    );
  }

  const payers = Object.keys(expense.payers).filter((k) => expense.payers[k] > 0);
  const parts = Object.keys(expense.splits);
  const myShare = expense.splits[profile!.uid] ?? 0;
  const myPaid = expense.payers[profile!.uid] ?? 0;
  const myNet = myPaid - myShare;

  const confirmDelete = () => {
    Alert.alert(
      'Delete this expense?',
      'Balances will update for everyone. The expense and its full history stay in the activity log, and any member can restore it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await setExpenseDeleted(expense, true, profile!);
              router.back();
            } catch {
              Alert.alert('Could not delete', 'Check your connection and try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const restore = async () => {
    setBusy(true);
    try { await setExpenseDeleted(expense, false, profile!); }
    catch { Alert.alert('Could not restore', 'Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <AppBar
        title={expense.description}
        subtitle={`${roomNameOf(expense.roomId)} · ${formatDate(expense.date)}`}
        right={
          !expense.deleted ? (
            <Pressable
              onPress={() => router.push(`/expense/new?id=${expense.id}`)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Edit this expense"
              style={({ pressed }) => [styles.action, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Pencil size={20} color={c.primary} strokeWidth={2.2} />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {expense.deleted ? (
          <Banner
            tone="warning"
            title="This expense was deleted"
            message="It no longer counts towards anybody's balance."
            right={<Button label="Restore" variant="ghost" onPress={restore} loading={busy} />}
          />
        ) : null}

        <Card style={styles.hero}>
          <View style={[styles.iconWrap, { backgroundColor: c.primarySoft }]}>
            <Glyph icon={categoryIcon(expense.category)} size={24} color={c.primary} />
          </View>
          <Money cents={expense.totalCents} variant="display" />
          <Text variant="small" tone="muted">
            {categoryLabel(expense.category)} · added by {nameOf(expense.createdBy)}
          </Text>

          <View style={[styles.myBox, { backgroundColor: c.elevated }]}>
            <Text variant="caption" tone="muted">Your position on this expense</Text>
            <Text
              variant="subheading"
              style={{ color: myNet > 0 ? c.positive : myNet < 0 ? c.negative : c.text }}
              tabular
            >
              {myNet > 0
                ? `You get back ${formatMoney(myNet)}`
                : myNet < 0
                  ? `You owe ${formatMoney(-myNet)}`
                  : 'You are square on this'}
            </Text>
            <Text variant="caption" tone="faint" tabular>
              You paid {formatMoney(myPaid)} · your share is {formatMoney(myShare)}
            </Text>
          </View>
        </Card>

        {expense.receiptUrl ? (
          <Card style={styles.receipt}>
            <Text variant="label" tone="muted">RECEIPT</Text>
            <ReceiptViewer url={expense.receiptUrl} />
            <ReceiptCaption />
          </Card>
        ) : null}

        {expense.note ? (
          <Card>
            <Text variant="label" tone="muted">NOTE</Text>
            <Text variant="body" style={styles.note}>{expense.note}</Text>
          </Card>
        ) : null}

        <View>
          <SectionHeader title={payers.length > 1 ? 'Who paid' : 'Paid by'} />
          <Card flush>
            {payers.map((uid, i) => (
              <ListRow
                key={uid}
                leading={<Avatar uid={uid} name={nameOf(uid)} size={36} />}
                title={uid === profile!.uid ? 'You' : nameOf(uid)}
                trailing={<Money cents={expense.payers[uid]} variant="smallStrong" />}
                divider={i < payers.length - 1}
              />
            ))}
          </Card>
        </View>

        <View>
          <SectionHeader
            title="Split between"
            hint={expense.splitMode === 'equal' ? 'Equally' : 'Exact amounts'}
          />
          <Card flush>
            {parts.map((uid, i) => (
              <ListRow
                key={uid}
                leading={<Avatar uid={uid} name={nameOf(uid)} size={36} />}
                title={uid === profile!.uid ? 'You' : nameOf(uid)}
                trailing={<Money cents={expense.splits[uid]} variant="smallStrong" />}
                divider={i < parts.length - 1}
              />
            ))}
          </Card>
        </View>

        {edges.length > 0 ? (
          <View>
            <SectionHeader title="Settles as" hint="What this expense means person to person" />
            <Card flush>
              {edges.map((edge, i) => (
                <ListRow
                  key={`${edge.from}-${edge.to}`}
                  leading={<Avatar uid={edge.from} name={nameOf(edge.from)} size={32} />}
                  title={`${edge.from === profile!.uid ? 'You' : nameOf(edge.from)} → ${edge.to === profile!.uid ? 'you' : nameOf(edge.to)}`}
                  trailing={<Money cents={edge.amount} variant="smallStrong" />}
                  divider={i < edges.length - 1}
                />
              ))}
            </Card>
          </View>
        ) : null}

        <View>
          <SectionHeader
            title="History"
            hint="Every change, who made it, and what it was before"
          />
          <View style={styles.history}>
            {history.length === 0 ? (
              <Card>
                <Text variant="small" tone="muted">
                  Created {formatDateTime(expense.createdAt)} by {nameOf(expense.createdBy)}.
                </Text>
              </Card>
            ) : (
              history.map((entry) => <AuditCard key={entry.id} entry={entry} />)
            )}
          </View>
        </View>

        {!expense.deleted ? (
          <View style={styles.danger}>
            <Button
              label="Delete expense"
              variant="danger"
              icon={Trash2}
              onPress={confirmDelete}
              loading={busy}
              full
            />
          </View>
        ) : (
          <View style={styles.danger}>
            <Button label="Restore expense" variant="secondary" icon={RotateCcw} onPress={restore} loading={busy} full />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.huge, gap: space.lg },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: space.xs },
  iconWrap: {
    width: 52, height: 52, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.xs,
  },
  myBox: {
    alignSelf: 'stretch', alignItems: 'center', gap: 2,
    marginTop: space.lg, padding: space.md, borderRadius: radius.md,
  },
  receipt: { gap: space.sm },
  note: { marginTop: space.xs },
  history: { gap: space.sm },
  danger: { marginTop: space.lg },
});
