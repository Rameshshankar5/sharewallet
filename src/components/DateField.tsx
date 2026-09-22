import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, HIT } from '../theme/tokens';
import { formatDate } from '../lib/time';
import { Text } from './Text';

interface Props {
  label: string;
  value: number;
  onChange: (ms: number) => void;
}

export function DateField({ label, value, onChange }: Props) {
  const { c, isDark } = useTheme();
  const [open, setOpen] = useState(false);

  // Android shows a modal dialog and fires once; iOS renders inline and fires
  // on every scroll, so it needs its own "Done" affordance.
  const handleChange = (_: unknown, picked?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (picked) onChange(picked.getTime());
  };

  return (
    <View>
      <Text variant="label" tone="muted" style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value)}. Tap to change.`}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: c.card, borderColor: open ? c.primary : c.border, borderWidth: open ? 2 : StyleSheet.hairlineWidth, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <CalendarDays size={20} color={c.textMuted} strokeWidth={2} />
        <Text variant="body">{formatDate(value)}</Text>
      </Pressable>

      {open ? (
        <View style={styles.picker}>
          <DateTimePicker
            value={new Date(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={new Date()}
            themeVariant={isDark ? 'dark' : 'light'}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Done choosing date"
              style={styles.done}
            >
              <Text variant="bodyStrong" tone="primary">Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: space.xs },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    minHeight: HIT, paddingHorizontal: space.md, borderRadius: radius.md,
  },
  picker: { marginTop: space.sm },
  done: { alignSelf: 'flex-end', padding: space.sm },
});
