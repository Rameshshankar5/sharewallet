import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { Glyph } from './Glyph';
import { roomIcon } from './icons';
import { Text } from './Text';

interface Props {
  name: string;
  /** The room's own icon key, so the mark matches the room's card. */
  icon?: string | null;
  /** Dimmed to sit correctly on a deleted row. */
  muted?: boolean;
}

/**
 * Marks a line as belonging to a room rather than to a direct debt.
 *
 * A room expense counts towards your one-to-one balance exactly like any other
 * — the fan you split with three flatmates is still money between you and each
 * of them. That is the right behaviour, but it leaves the friend screen showing
 * room lines and direct lines with nothing to tell them apart. This is that
 * mark: icon plus the room's name, never colour on its own.
 */
export function RoomTag({ name, icon, muted }: Props) {
  const { c } = useTheme();

  return (
    <View
      style={[styles.tag, { backgroundColor: c.primarySoft, opacity: muted ? 0.6 : 1 }]}
      accessibilityLabel={`From the room ${name}`}
    >
      <Glyph icon={roomIcon(icon ?? 'home')} size={11} color={c.primary} strokeWidth={2.6} />
      <Text variant="caption" style={{ color: c.primary }} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    maxWidth: 160,
  },
});
