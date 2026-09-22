import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  children: React.ReactNode;
  /** Which safe-area edges to pad. Screens with a bottom bar drop 'bottom'. */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, edges = ['top', 'left', 'right'], style }: Props) {
  const { c } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.inner, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
});
