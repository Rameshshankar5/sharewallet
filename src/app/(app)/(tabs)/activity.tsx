import React, { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '../../../context/DataContext';
import { space } from '../../../theme/tokens';
import { groupByDay } from '../../../lib/time';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { AuditCard } from '../../../components/AuditCard';
import { EmptyState } from '../../../components/EmptyState';
import { SegmentedControl } from '../../../components/SegmentedControl';
import type { AuditEntry } from '../../../types';

type Filter = 'all' | 'edits' | 'money';

/**
 * The shared record of who changed what. Everything that touches money or
 * membership lands here, visible to everyone who can see the thing that
 * changed — so an edit to someone's own share can't pass unnoticed.
 */
export default function ActivityScreen() {
  const { audit } = useData();
  const [filter, setFilter] = useState<Filter>('all');

  const sections = useMemo(() => {
    const filtered = audit.filter((e) => {
      if (filter === 'edits') return e.action === 'expense.update' || e.action === 'room.members' || e.action === 'room.update';
      if (filter === 'money') return e.action.startsWith('expense.') || e.action.startsWith('settlement.');
      return true;
    });
    return groupByDay(filtered, (e) => e.at).map((g) => ({ title: g.label, data: g.items }));
  }, [audit, filter]);

  const openTarget = (entry: AuditEntry) => {
    if (entry.action.startsWith('expense.')) router.push(`/expense/${entry.targetId}`);
    else if (entry.action.startsWith('room.')) router.push(`/room/${entry.targetId}`);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Activity</Text>
        <Text variant="small" tone="muted" style={styles.sub}>
          Every change is recorded with who made it and what moved. This log cannot be edited or deleted by anyone.
        </Text>
        <View style={styles.filter}>
          <SegmentedControl<Filter>
            value={filter}
            onChange={setFilter}
            segments={[
              { value: 'all', label: 'Everything' },
              { value: 'edits', label: 'Edits only' },
              { value: 'money', label: 'Money' },
            ]}
          />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text variant="label" tone="muted" style={styles.dayLabel}>
            {section.title.toUpperCase()}
          </Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <AuditCard entry={item} compact onPress={() => openTarget(item)} />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            illo="activity"
            title={filter === 'all' ? 'Nothing has happened yet' : 'Nothing matches this filter'}
            message={
              filter === 'all'
                ? 'Once you or your friends add an expense, every change shows up here with a full before-and-after.'
                : 'Try a different filter to see more of the history.'
            }
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        SectionSeparatorComponent={() => <View style={{ height: space.xs }} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  sub: { marginTop: space.xs },
  filter: { marginTop: space.lg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  dayLabel: { marginTop: space.lg, marginBottom: space.sm, letterSpacing: 0.6 },
  item: {},
});
