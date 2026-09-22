import React, { forwardRef, useState } from 'react';
import {
  Pressable, StyleSheet, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space, HIT } from '../theme/tokens';
import { Text } from './Text';

interface Props extends Omit<TextInputProps, 'style'> {
  /** Always visible — a placeholder alone disappears the moment typing starts. */
  label: string;
  /** Persistent guidance. Shown unless an error replaces it. */
  helper?: string;
  error?: string | null;
  icon?: LucideIcon;
  /** Renders a show/hide toggle and sets secureTextEntry. */
  password?: boolean;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /** Fixed text shown inside the field, e.g. the "Rs" on amount inputs. */
  prefix?: string;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, helper, error, icon: Icon, password, required, containerStyle, prefix, ...rest },
  ref,
) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  const borderColor = error ? c.negative : focused ? c.primary : c.border;

  return (
    <View style={containerStyle}>
      <View style={styles.labelRow}>
        <Text variant="label" tone="muted">{label}</Text>
        {required ? <Text variant="label" tone="negative"> *</Text> : null}
      </View>

      <View
        style={[
          styles.field,
          {
            backgroundColor: c.card,
            borderColor,
            // A focus ring, not just a colour change — visible without colour vision.
            borderWidth: focused || error ? 2 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        {Icon ? <Icon size={20} color={c.textMuted} strokeWidth={2} /> : null}
        {prefix ? <Text variant="body" tone="muted">{prefix}</Text> : null}

        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={password && !reveal}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          placeholderTextColor={c.textFaint}
          accessibilityLabel={label}
          style={[styles.input, font.body, { color: c.text }]}
        />

        {password ? (
          <Pressable
            onPress={() => setReveal((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal
              ? <EyeOff size={20} color={c.textMuted} strokeWidth={2} />
              : <Eye size={20} color={c.textMuted} strokeWidth={2} />}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        // Errors sit directly under their own field, never collected at the top.
        <Text variant="caption" tone="negative" style={styles.hint} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" tone="faint" style={styles.hint}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', marginBottom: space.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: HIT,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  input: { flex: 1, paddingVertical: space.md },
  hint: { marginTop: space.xs },
});
