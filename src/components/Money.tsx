import React from 'react';
import { formatMoney } from '../lib/money';
import { Text } from './Text';
import type { TextStyle } from 'react-native';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'bodyStrong' | 'body' | 'smallStrong' | 'small';

interface Props {
  cents: number;
  variant?: Variant;
  /** Colour by sign: green when owed to you, red when you owe. */
  signed?: boolean;
  /** Drop the minus sign — for "you owe Rs 40" where the word carries the sign. */
  absolute?: boolean;
  style?: TextStyle;
}

export function Money({ cents, variant = 'bodyStrong', signed, absolute, style }: Props) {
  const tone = signed ? (cents > 0 ? 'positive' : cents < 0 ? 'negative' : 'muted') : 'default';
  const value = absolute ? Math.abs(cents) : cents;
  return (
    <Text variant={variant} tone={tone} tabular style={style}>
      {formatMoney(value)}
    </Text>
  );
}
