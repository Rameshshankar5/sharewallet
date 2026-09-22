import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Removes inner padding when the card holds a full-bleed list. */
  flush?: boolean;
}

export function Card({ children, style, flush }: Props) {
  const { c } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.card, borderColor: c.border, padding: flush ? 0 : space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
