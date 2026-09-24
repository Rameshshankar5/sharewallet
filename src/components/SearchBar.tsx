import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space, HIT } from '../theme/tokens';

interface Props {
  value: string;
  onChange: (text: string) => void;
  /** Also the accessibility label, so it says what is being searched. */
  placeholder: string;
}

/**
 * A search field for the top of a list. No visible label, unlike `Input`:
 * the magnifier and the placeholder say what it is, and a label above every
 * list would push the content down for something most visits never use.
 */
export function SearchBar({ value, onChange, placeholder }: Props) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: c.card,
          borderColor: focused ? c.primary : c.border,
          borderWidth: focused ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Search size={18} color={c.textMuted} strokeWidth={2.2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, font.body, { color: c.text }]}
      />
      {value ? (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <X size={18} color={c.textMuted} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Case- and accent-insensitive "does any of these contain the query". */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(query.trim());
  if (!q) return true;
  return fields.some((f) => f && norm(f).includes(q));
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: HIT,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  input: { flex: 1, paddingVertical: space.sm },
});
