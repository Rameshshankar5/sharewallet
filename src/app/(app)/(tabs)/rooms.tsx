import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { buildRoomLedger } from '../../../lib/balance';
import { Screen } from '../../../components/Screen';
import { TAB_BAR_CLEARANCE } from '../../../components/TabBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Money } from '../../../components/Money';
import { ListRow } from '../../../components/ListRow';
import { EmptyState } from '../../../components/EmptyState';
import { Button } from '../../../components/Button';
import { Fab } from '../../../components/Fab';
import { Loading } from '../../../components/Loading';
import { Glyph } from '../../../components/Glyph';
import { roomIcon } from '../../../components/icons';
import { SearchBar, matches } from '../../../components/SearchBar';

export default function RoomsScreen() {
  const { profile } = useAuth();
  const { rooms, expenses, settlements, loading, nameOf } = useData();
  const { c } = useTheme();
  const me = profile!.uid;
  const [search, setSearch] = useState('');

  /**
   * Each room's ledger is built from that room's expenses and that room's
   * payments. Both are scoped, so the figure answers "where do I stand here"
   * and one room's spending never moves another's — which is the whole point
   * of having rooms. Your balance with a person stays a single number: it is
   * on the Balances tab, built from everything at once.
   */
  const summaries = useMemo(() => {
    const map: Record<string, { net: number; count: number }> = {};
    rooms.forEach((room) => {
      const ledger = buildRoomLedger(expenses, settlements, room.id);
      const count = expenses.filter((e) => !e.deleted && e.roomId === room.id).length;
      map[room.id] = { net: ledger.netFor(me), count };
    });
    return map;
  }, [rooms, expenses, settlements, me]);

  const searching = search.trim().length > 0;
  // A room is as often remembered by who was in it as by its name.
  const shown = searching
    ? rooms.filter((r) => matches(search, r.name, ...r.memberIds.filter((id) => id !== me).map(nameOf)))
    : rooms;

  if (loading) return <Loading label="Loading rooms…" />;

  return (
    <Screen>
      <FlatList
        data={shown}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="title">Rooms</Text>
            <Text variant="small" tone="muted">
              A room is a fixed group of friends. Everyone in a room can see every expense inside it, and picking a room pre-selects everybody.
            </Text>
            {rooms.length > 0 ? (
              <View style={styles.search}>
                <SearchBar value={search} onChange={setSearch} placeholder="Search rooms or people in them" />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const summary = summaries[item.id] ?? { net: 0, count: 0 };
          const memberNames = item.memberIds
            .filter((id) => id !== me)
            .map(nameOf)
            .slice(0, 3)
            .join(', ');
          const extra = Math.max(0, item.memberIds.length - 1 - 3);

          return (
            <Card flush style={styles.roomCard}>
              <ListRow
                leading={
                  <View style={[styles.iconWrap, { backgroundColor: c.primarySoft }]}>
                    <Glyph icon={roomIcon(item.icon)} size={22} color={c.primary} />
                  </View>
                }
                title={item.archived ? `${item.name} (archived)` : item.name}
                subtitle={
                  item.memberIds.length <= 1
                    ? 'Just you so far'
                    : `You, ${memberNames}${extra > 0 ? ` +${extra}` : ''} · ${summary.count} ${summary.count === 1 ? 'expense' : 'expenses'}`
                }
                trailing={
                  summary.net === 0 ? (
                    <Text variant="caption" tone="muted">settled</Text>
                  ) : (
                    <View style={styles.trailing}>
                      <Text variant="caption" tone="muted">
                        {summary.net > 0 ? 'you get' : 'you owe'}
                      </Text>
                      <Money
                        cents={Math.abs(summary.net)}
                        variant="smallStrong"
                        style={{ color: summary.net > 0 ? c.positive : c.negative }}
                      />
                    </View>
                  )
                }
                chevron
                onPress={() => router.push(`/room/${item.id}`)}
              />
            </Card>
          );
        }}
        ListEmptyComponent={searching ? (
          <EmptyState
            compact
            illo="rooms"
            title="No rooms match"
            message={`No room is called "${search.trim()}" or has anyone by that name in it.`}
          />
        ) : (
          <EmptyState
            illo="rooms"
            title="No rooms yet"
            message="Make a room for the people you split with often — a trip, a flat, a regular dinner crowd. Everyone in it sees the room's expenses."
            action={<Button label="Create a room" onPress={() => router.push('/room/new')} />}
          />
        )}
      />

      {rooms.length > 0 ? (
        <Fab label="New room" onPress={() => router.push('/room/new')} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: TAB_BAR_CLEARANCE + 72, gap: space.sm },
  header: { gap: space.xs, marginBottom: space.md },
  roomCard: { borderRadius: radius.md, overflow: 'hidden' },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  trailing: { alignItems: 'flex-end' },
  search: { marginTop: space.md },
});
