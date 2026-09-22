import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { space, HIT } from '../theme/tokens';
import { Text } from './Text';

interface Props {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ListRow({
  leading, title, subtitle, trailing, onPress, chevron, divider, style, accessibilityLabel,
}: Props) {
  const { c } = useTheme();

  const body = (
    <View style={[styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, style]}>
      {leading}
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2} style={styles.sub}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <ChevronRight size={20} color={c.textFaint} strokeWidth={2} /> : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: HIT + 8,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  text: { flex: 1 },
  sub: { marginTop: 2 },
});
