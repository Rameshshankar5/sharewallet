import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { HandCoins, Plus } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { formatMoney } from '../../../lib/money';
import { formatDate } from '../../../lib/time';
import { Screen } from '../../../components/Screen';
import { AppBar } from '../../../components/AppBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/Button';
import { SectionHeader } from '../../../components/SectionHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ExpenseRow } from '../../../components/ExpenseRow';
import { RoomTag } from '../../../components/RoomTag';
import { ListRow } from '../../../components/ListRow';
import { Loading } from '../../../components/Loading';

/** The private ledger between you and one other person. */
export default function FriendScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { profile } = useAuth();
  const { ledger, usersById, roomsById, expenses, settlements, nameOf, loading } = useData();
  const { c } = useTheme();
  const [showDeleted, setShowSettled] = useState(false);

  const me = profile!.uid;
  const friend = usersById[uid];
  const balance = ledger.between(me, uid);

  // Only the rows that actually involve both of you.
  const shared = useMemo(
    () => expenses
      .filter((e) => e.participantIds.includes(me) && e.participantIds.includes(uid))
      .sort((a, b) => b.date - a.date),
    [expenses, me, uid],
  );

  const payments = useMemo(
    () => settlements
      .filter((s) => !s.deleted && s.participantIds.includes(me) && s.participantIds.includes(uid))
      .sort((a, b) => b.date - a.date),
    [settlements, me, uid],
  );

  const visible = showDeleted ? shared : shared.filter((e) => !e.deleted);

  if (loading) return <Loading />;

  if (!friend) {
    return (
      <Screen>
        <AppBar title="Person" />
        <EmptyState illo="people" title="Person not found" message="This account may have been removed." />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title={friend.displayName} subtitle={friend.email} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <Avatar uid={friend.uid} name={friend.displayName} size={64} />
          <Text variant="label" tone="muted" style={styles.heroLabel}>
            {balance > 0 ? `${friend.displayName.toUpperCase()} OWES YOU`
              : balance < 0 ? `YOU OWE ${friend.displayName.toUpperCase()}`
              : 'YOU ARE ALL SQUARE'}
          </Text>
          {balance !== 0 ? (
            <Text
              variant="display"
              tabular
              style={{ color: balance > 0 ? c.positive : c.negative }}
            >
              {formatMoney(Math.abs(balance))}
            </Text>
          ) : (
            <Text variant="title" tone="muted">Nothing outstanding</Text>
          )}

          <View style={styles.heroActions}>
            <Button
              label="Add expense"
              icon={Plus}
              onPress={() => router.push(`/expense/new?with=${friend.uid}`)}
            />
            {balance !== 0 ? (
              <Button
                label="Settle up"
                variant="secondary"
                icon={HandCoins}
                onPress={() => router.push(`/settle/new?with=${friend.uid}`)}
              />
            ) : null}
          </View>
        </Card>

        {payments.length > 0 ? (
          <View>
            <SectionHeader title="Payments" hint="Cash that changed hands" />
            <Card flush>
              {payments.map((p, i) => (
                <ListRow
                  key={p.id}
                  leading={
                    <View style={[styles.payIcon, { backgroundColor: c.positiveSoft }]}>
                      <HandCoins size={18} color={c.positive} strokeWidth={2.2} />
                    </View>
                  }
                  title={p.fromUid === me
                    ? `You paid ${friend.displayName}`
                    : `${friend.displayName} paid you`}
                  subtitle={[p.note, formatDate(p.date)].filter(Boolean).join(' · ')}
                  badge={p.roomId ? (
                    <RoomTag
                      name={roomsById[p.roomId]?.name ?? 'A room'}
                      icon={roomsById[p.roomId]?.icon}
                    />
                  ) : null}
                  trailing={<Text variant="smallStrong" tabular>{formatMoney(p.amount)}</Text>}
                  divider={i < payments.length - 1}
                />
              ))}
            </Card>
          </View>
        ) : null}

        <View>
          <SectionHeader
            title="Shared expenses"
            hint={`${visible.length} between you`}
            right={
              shared.some((e) => e.deleted) ? (
                <Text
                  variant="smallStrong"
                  tone="primary"
                  onPress={() => setShowSettled((v) => !v)}
                  accessibilityRole="button"
                >
                  {showDeleted ? 'Hide deleted' : 'Show deleted'}
                </Text>
              ) : undefined
            }
          />
          <View style={styles.list}>
            {visible.length === 0 ? (
              <EmptyState
                compact
                illo="settled"
                title="Nothing shared yet"
                message={`Add an expense with ${friend.displayName} and it will appear here.`}
              />
            ) : (
              visible.map((e) => (
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  meUid={me}
                  nameOf={nameOf}
                  showRoom={e.roomId
                    ? { name: roomsById[e.roomId]?.name ?? 'A room', icon: roomsById[e.roomId]?.icon }
                    : null}
                  onPress={() => router.push(`/expense/${e.id}`)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.huge, gap: space.lg },
  hero: { alignItems: 'center', gap: space.xs },
  heroLabel: { marginTop: space.sm, letterSpacing: 0.6, textAlign: 'center' },
  heroActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, flexWrap: 'wrap', justifyContent: 'center' },
  payIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  list: { gap: space.sm },
});
