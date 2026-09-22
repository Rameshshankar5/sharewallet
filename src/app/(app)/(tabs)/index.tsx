import React, { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { formatMoney } from '../../../lib/money';
import { Screen } from '../../../components/Screen';
import { TAB_BAR_CLEARANCE } from '../../../components/TabBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Money } from '../../../components/Money';
import { Avatar } from '../../../components/Avatar';
import { ListRow } from '../../../components/ListRow';
import { SectionHeader } from '../../../components/SectionHeader';
import { EmptyState } from '../../../components/EmptyState';
import { Button } from '../../../components/Button';
import { Fab } from '../../../components/Fab';
import { Loading } from '../../../components/Loading';

export default function BalancesScreen() {
  const { profile } = useAuth();
  const { ledger, nameOf, loading, friends } = useData();
  const { c } = useTheme();

  const me = profile!.uid;

  const { rows, owedToYou, youOwe, net } = useMemo(() => {
    const all = ledger.counterpartiesFor(me);
    return {
      rows: all,
      owedToYou: all.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0),
      youOwe: all.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0),
      net: all.reduce((s, r) => s + r.amount, 0),
    };
  }, [ledger, me]);

  if (loading) return <Loading label="Loading your balances…" />;

  const firstName = (profile?.displayName ?? '').split(' ')[0];

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="small" tone="muted">Hi {firstName}</Text>

            <Card style={styles.hero}>
              <Text variant="label" tone="muted">
                {net > 0 ? 'OVERALL, YOU ARE OWED' : net < 0 ? 'OVERALL, YOU OWE' : 'OVERALL'}
              </Text>
              <Money cents={Math.abs(net)} variant="display" signed={false} style={{
                color: net > 0 ? c.positive : net < 0 ? c.negative : c.text,
                marginTop: space.xs,
              }} />

              <View style={[styles.splitRow, { borderTopColor: c.border }]}>
                <View style={styles.splitCell}>
                  <View style={styles.splitLabel}>
                    <ArrowDownLeft size={15} color={c.positive} strokeWidth={2.5} />
                    <Text variant="caption" tone="muted">You are owed</Text>
                  </View>
                  <Money cents={owedToYou} variant="subheading" style={{ color: c.positive }} />
                </View>

                <View style={[styles.divider, { backgroundColor: c.border }]} />

                <View style={styles.splitCell}>
                  <View style={styles.splitLabel}>
                    <ArrowUpRight size={15} color={c.negative} strokeWidth={2.5} />
                    <Text variant="caption" tone="muted">You owe</Text>
                  </View>
                  <Money cents={youOwe} variant="subheading" style={{ color: c.negative }} />
                </View>
              </View>
            </Card>

            {rows.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="People"
                  hint="Tap anyone to see every expense between you two"
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const owesYou = item.amount > 0;
          return (
            <Card flush style={[styles.rowCard, index === 0 && { marginTop: 0 }]}>
              <ListRow
                leading={<Avatar uid={item.uid} name={nameOf(item.uid)} size={42} />}
                title={nameOf(item.uid)}
                subtitle={owesYou ? 'owes you' : 'you owe'}
                trailing={
                  <Money
                    cents={Math.abs(item.amount)}
                    variant="subheading"
                    style={{ color: owesYou ? c.positive : c.negative }}
                  />
                }
                chevron
                accessibilityLabel={`${nameOf(item.uid)} ${owesYou ? 'owes you' : ''}${!owesYou ? 'is owed by you' : ''} ${formatMoney(Math.abs(item.amount))}`}
                onPress={() => router.push(`/friend/${item.uid}`)}
              />
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            illo={friends.length === 0 ? 'people' : 'settled'}
            title={friends.length === 0 ? 'No friends yet' : 'All settled up'}
            message={
              friends.length === 0
                ? 'Your group admin needs to create accounts for your friends before you can split anything.'
                : 'Nobody owes anybody right now. Add an expense and it will show up here.'
            }
            action={
              friends.length > 0 ? (
                <Button label="Add an expense" onPress={() => router.push('/expense/new')} />
              ) : undefined
            }
          />
        }
      />

      {friends.length > 0 ? (
        <Fab label="Add expense" onPress={() => router.push('/expense/new')} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: TAB_BAR_CLEARANCE + 72 },
  header: { gap: space.md },
  hero: { marginTop: space.xs },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  splitCell: { flex: 1, gap: space.xs },
  splitLabel: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  divider: { width: StyleSheet.hairlineWidth, marginHorizontal: space.lg },
  section: { marginTop: space.lg },
  rowCard: { marginBottom: space.sm, borderRadius: radius.md, overflow: 'hidden' },
});
