import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { avatarColorFor } from '../theme/tokens';
import { Text } from './Text';

interface Props {
  uid: string;
  name: string;
  size?: number;
  /** Draws a ring — used to mark "you" in a list of people. */
  highlighted?: boolean;
}

/** Initials from the first and last word, e.g. "Kasun Perera" -> "KP". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ uid, name, size = 40, highlighted }: Props) {
  const { c } = useTheme();
  const bg = avatarColorFor(uid);

  return (
    <View
      accessible={false}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderWidth: highlighted ? 2 : 0,
          borderColor: c.text,
        },
      ]}
    >
      <Text
        variant="label"
        style={{ color: '#0B1220', fontSize: Math.round(size * 0.36) }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
