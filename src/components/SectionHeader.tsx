import React from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../theme/tokens';
import { Text } from './Text';

interface Props {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, hint, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text variant="label" tone="muted" style={styles.title}>{title.toUpperCase()}</Text>
        {hint ? <Text variant="caption" tone="faint" style={styles.hint}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginBottom: space.sm,
  },
  text: { flex: 1 },
  title: { letterSpacing: 0.6 },
  hint: { marginTop: 2 },
});
