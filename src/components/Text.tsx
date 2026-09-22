import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';

type Variant = keyof typeof font;
type Tone = 'default' | 'muted' | 'faint' | 'primary' | 'positive' | 'negative' | 'warning' | 'onPrimary';

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  /** Monospaced digits — use for every money figure so columns stop jittering. */
  tabular?: boolean;
  center?: boolean;
}

export function Text({
  variant = 'body', tone = 'default', tabular, center, style, ...rest
}: Props) {
  const { c } = useTheme();

  const color: Record<Tone, string> = {
    default: c.text,
    muted: c.textMuted,
    faint: c.textFaint,
    primary: c.primary,
    positive: c.positive,
    negative: c.negative,
    warning: c.warning,
    onPrimary: c.onPrimary,
  };

  const extra: TextStyle = {
    color: color[tone],
    ...(tabular ? { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] } : null),
    ...(center ? { textAlign: 'center' } : null),
  };

  return <RNText {...rest} style={[font[variant], extra, style]} />;
}
