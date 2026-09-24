import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Calculator } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

/** The small calculator key that sits beside an amount. */
export function CalculatorButton({ onPress, label }: { onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: c.primarySoft, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Calculator size={18} color={c.primary} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34, height: 34, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
});
