import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Pencil, Plus, UserPlus } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { buildRoomLedger, simplify } from '../../../lib/balance';
import { formatMoney } from '../../../lib/money';
import { Screen } from '../../../components/Screen';
import { AppBar } from '../../../components/AppBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/Button';
import { SectionHeader } from '../../../components/SectionHeader';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { EmptyState } from '../../../components/EmptyState';
import { ExpenseRow } from '../../../components/ExpenseRow';
import { ListRow } from '../../../components/ListRow';
import { AuditCard } from '../../../components/AuditCard';
import { Loading } from '../../../components/Loading';
import { Fab } from '../../../components/Fab';
import { Glyph } from '../../../components/Glyph';
import { roomIcon } from '../../../components/icons';
import { shareInvite } from '../../../services/shareInvite';

type Tab = 'expenses' | 'balances' | 'activity';

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { rooms, expenses, settlements, audit, nameOf, loading } = useData();
  const { c } = useTheme();
  const [tab, setTab] = useState<Tab>('expenses');
  const [inviting, setInviting] = useState(false);

  const me = profile!.uid;
  const room = rooms.find((r) => r.id === id);

  const roomExpenses = useMemo(
    () => expenses.filter((e) => e.roomId === id).sort((a, b) => b.date - a.date),
    [expenses, id],
  );

  const { myNet, suggestions } = useMemo(() => {
    if (!room) return { myNet: 0, suggestions: [] };
    const ledger = buildRoomLedger(expenses, settlements, room.id);

    const balances: Record<string, number> = {};
    room.memberIds.forEach((uid) => { balances[uid] = ledger.netFor(uid); });

    return { myNet: ledger.netFor(me), suggestions: simplify(balances) };
  }, [room, expenses, settlements, me]);

  const roomAudit = useMemo(
    () => audit.filter((a) => a.roomId === id),
    [audit, id],
  );

  if (loading) return <Loading />;

  const invite = () => {
    if (!room) return;
    setInviting(true);
    void shareInvite(profile!, room)
      .catch(() => Alert.alert('Could not make the invite link', 'Check your connection and try again.'))
      .finally(() => setInviting(false));
  };

  if (!room) {
    return (
      <Screen>
        <AppBar title="Room" />
        <EmptyState
          illo="rooms"
          title="Room not found"
          message="You may have been removed from this room, or it no longer exists."
        />
      </Screen>
    );
  }


  return (
    <Screen>
      <AppBar
        title={room.name}
        subtitle={`${room.memberIds.length} members${room.archived ? ' · archived' : ''}`}
        right={
          <Button
            label="Edit"
            variant="ghost"
            icon={Pencil}
            onPress={() => router.push(`/room/new?id=${room.id}`)}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <View style={[styles.iconWrap, { backgroundColor: c.primarySoft }]}>
            <Glyph icon={roomIcon(room.icon)} size={26} color={c.primary} />
          </View>
          <Text variant="label" tone="muted">
            {myNet > 0 ? 'YOU ARE OWED IN THIS ROOM'
              : myNet < 0 ? 'YOU OWE IN THIS ROOM'
              : 'THIS ROOM IS SETTLED'}
          </Text>
          {myNet !== 0 ? (
            <Text variant="display" tabular style={{ color: myNet > 0 ? c.positive : c.negative }}>
              {formatMoney(Math.abs(myNet))}
            </Text>
          ) : (
            <Text variant="title" tone="muted">All square</Text>
          )}

          <View style={styles.members}>
            {room.memberIds.slice(0, 8).map((uid) => (
              <Avatar key={uid} uid={uid} name={nameOf(uid)} size={30} highlighted={uid === me} />
            ))}
            {room.memberIds.length > 8 ? (
              <Text variant="caption" tone="muted">+{room.memberIds.length - 8}</Text>
            ) : null}
          </View>

          {!room.archived ? (
            <View style={styles.invite}>
              <Button
                label="Invite to this room"
                icon={UserPlus}
                variant="secondary"
                loading={inviting}
                onPress={invite}
              />
            </View>
          ) : null}
        </Card>

        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          segments={[
            { value: 'expenses', label: 'Expenses' },
            { value: 'balances', label: 'Settle up' },
            { value: 'activity', label: 'Activity' },
          ]}
        />

        {tab === 'expenses' ? (
          <View style={styles.list}>
            {roomExpenses.length === 0 ? (
              <EmptyState
                compact
                illo="rooms"
                title="No expenses in this room"
                message="Anything added here is visible to everyone in the room."
                action={<Button label="Add the first one" onPress={() => router.push(`/expense/new?roomId=${room.id}`)} />}
              />
            ) : (
              roomExpenses.map((e) => (
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  meUid={me}
                  nameOf={nameOf}
                  onPress={() => router.push(`/expense/${e.id}`)}
                />
              ))
            )}
          </View>
        ) : null}

        {tab === 'balances' ? (
          <View style={styles.list}>
            <SectionHeader
              title="Simplest way to settle"
              hint="The fewest payments that clear everyone in this room"
            />
            {suggestions.length === 0 ? (
              <EmptyState
                compact
                illo="settled"
                title="Nothing to settle"
                message="Everyone in this room is square."
              />
            ) : (
              <Card flush>
                {suggestions.map((edge, i) => (
                  <ListRow
                    key={`${edge.from}-${edge.to}`}
                    leading={<Avatar uid={edge.from} name={nameOf(edge.from)} size={36} highlighted={edge.from === me} />}
                    title={`${edge.from === me ? 'You' : nameOf(edge.from)} → ${edge.to === me ? 'you' : nameOf(edge.to)}`}
                    subtitle={edge.from === me ? 'Tap to record this payment' : undefined}
                    trailing={<Text variant="smallStrong" tabular>{formatMoney(edge.amount)}</Text>}
                    chevron={edge.from === me}
                    divider={i < suggestions.length - 1}
                    onPress={
                      edge.from === me
                        ? () => router.push(
                            `/settle/new?with=${edge.to}&amount=${edge.amount}&roomId=${room.id}&dir=iPaid`,
                          )
                        : undefined
                    }
                  />
                ))}
              </Card>
            )}
          </View>
        ) : null}

        {tab === 'activity' ? (
          <View style={styles.list}>
            {roomAudit.length === 0 ? (
              <EmptyState
                compact
                illo="activity"
                title="No activity yet"
                message="Changes made in this room will be listed here with who made them."
              />
            ) : (
              roomAudit.map((entry) => (
                <AuditCard
                  key={entry.id}
                  entry={entry}
                  compact
                  onPress={
                    entry.action.startsWith('expense.')
                      ? () => router.push(`/expense/${entry.targetId}`)
                      : undefined
                  }
                />
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      {!room.archived ? (
        <Fab label="Add expense" icon={Plus} onPress={() => router.push(`/expense/new?roomId=${room.id}`)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 96, gap: space.lg },
  hero: { alignItems: 'center', gap: space.xs },
  iconWrap: {
    width: 56, height: 56, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.xs,
  },
  members: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.lg, flexWrap: 'wrap', justifyContent: 'center' },
  list: { gap: space.sm },
  invite: { marginTop: space.md },
});
