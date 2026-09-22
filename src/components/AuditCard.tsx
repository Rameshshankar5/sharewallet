import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  ArrowRight, DoorOpen, FilePlus2, FileX2, HandCoins,
  PencilLine, RotateCcw, UserPlus, type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { relativeTime } from '../lib/time';
import { Avatar } from './Avatar';
import { Text } from './Text';
import type { AuditAction, AuditEntry } from '../types';

const ACTION_META: Record<AuditAction, { Icon: LucideIcon; verb: string; tone: 'primary' | 'positive' | 'negative' | 'muted' }> = {
  'expense.create': { Icon: FilePlus2, verb: 'added an expense', tone: 'primary' },
  'expense.update': { Icon: PencilLine, verb: 'edited an expense', tone: 'muted' },
  'expense.delete': { Icon: FileX2, verb: 'deleted an expense', tone: 'negative' },
  'expense.restore': { Icon: RotateCcw, verb: 'restored an expense', tone: 'positive' },
  'settlement.create': { Icon: HandCoins, verb: 'recorded a payment', tone: 'positive' },
  'settlement.delete': { Icon: FileX2, verb: 'removed a payment', tone: 'negative' },
  'room.create': { Icon: DoorOpen, verb: 'created a room', tone: 'primary' },
  'room.update': { Icon: PencilLine, verb: 'updated a room', tone: 'muted' },
  'room.members': { Icon: UserPlus, verb: 'changed room members', tone: 'primary' },
  'user.create': { Icon: UserPlus, verb: 'created an account', tone: 'primary' },
  'user.update': { Icon: PencilLine, verb: 'updated an account', tone: 'muted' },
};

interface Props {
  entry: AuditEntry;
  onPress?: () => void;
  /** Collapse to the summary line only — used inside dense lists. */
  compact?: boolean;
}

/**
 * Renders one audit row as "who / what / from -> to".
 *
 * Edits are shown as explicit before -> after pairs rather than a vague
 * "updated", because the whole reason this log exists is so a quiet change to
 * someone's own share is obvious to everyone else.
 */
export function AuditCard({ entry, onPress, compact }: Props) {
  const { c } = useTheme();
  const meta = ACTION_META[entry.action] ?? ACTION_META['expense.update'];
  const { Icon } = meta;

  const toneColor =
    meta.tone === 'primary' ? c.primary :
    meta.tone === 'positive' ? c.positive :
    meta.tone === 'negative' ? c.negative : c.textMuted;

  const visibleChanges = compact ? entry.changes.slice(0, 2) : entry.changes;
  const hidden = entry.changes.length - visibleChanges.length;

  const body = (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.head}>
        <Avatar uid={entry.byUid} name={entry.byName} size={34} />
        <View style={styles.headText}>
          <Text variant="small" numberOfLines={2}>
            <Text variant="smallStrong">{entry.byName}</Text>
            <Text variant="small" tone="muted"> {meta.verb}</Text>
          </Text>
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {entry.targetLabel} · {relativeTime(entry.at)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: c.elevated }]}>
          <Icon size={15} color={toneColor} strokeWidth={2.4} />
        </View>
      </View>

      {visibleChanges.length > 0 ? (
        <View style={[styles.changes, { borderTopColor: c.border }]}>
          {visibleChanges.map((change) => (
            <View key={change.field} style={styles.changeRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      change.kind === 'added' ? c.positive :
                      change.kind === 'removed' ? c.negative : c.textFaint,
                  },
                ]}
              />
              <View style={styles.changeBody}>
                <Text variant="caption" tone="muted" numberOfLines={2}>{change.label}</Text>
                {change.before !== null && change.after !== null ? (
                  <View style={styles.beforeAfter}>
                    <Text variant="smallStrong" tone="faint" tabular style={styles.strike}>
                      {change.before}
                    </Text>
                    <ArrowRight size={13} color={c.textFaint} strokeWidth={2.4} />
                    <Text variant="smallStrong" tabular>{change.after}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
          {hidden > 0 ? (
            <Text variant="caption" tone="primary" style={styles.more}>
              +{hidden} more {hidden === 1 ? 'change' : 'changes'}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.byName} ${meta.verb}: ${entry.targetLabel}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headText: { flex: 1 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  changes: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  changeRow: { flexDirection: 'row', gap: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  changeBody: { flex: 1 },
  beforeAfter: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2, flexWrap: 'wrap' },
  strike: { textDecorationLine: 'line-through' },
  more: { marginTop: space.xs },
});
