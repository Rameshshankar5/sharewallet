import React from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../theme/tokens';
import { Illustration, type IlloName } from './Illustration';
import { Text } from './Text';

interface Props {
  illo: IlloName;
  title: string;
  message: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({ illo, title, message, action, compact }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Illustration name={illo} size={compact ? 108 : 150} />
      <Text variant="heading" center style={styles.title}>{title}</Text>
      <Text variant="small" tone="muted" center style={styles.message}>{message}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  compact: { paddingVertical: space.xl },
  title: { marginTop: space.lg },
  message: { marginTop: space.xs, maxWidth: 300 },
  action: { marginTop: space.xl },
});
