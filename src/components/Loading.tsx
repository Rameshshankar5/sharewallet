import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { Text } from './Text';

export function Loading({ label }: { label?: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: c.background }]}>
      <ActivityIndicator size="large" color={c.primary} />
      {label ? <Text variant="small" tone="muted" style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: space.md },
});
