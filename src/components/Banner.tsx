import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { Text } from './Text';

type Tone = 'info' | 'success' | 'warning' | 'error';

interface Props {
  tone: Tone;
  title: string;
  message?: string;
  right?: React.ReactNode;
}

/**
 * Status messages always pair a colour with an icon and words. Colour alone
 * fails for anyone who can't distinguish red from green — which, in a money
 * app, is the difference between owing and being owed.
 */
export function Banner({ tone, title, message, right }: Props) {
  const { c } = useTheme();

  const map = {
    info: { bg: c.primarySoft, fg: c.primary, Icon: Info },
    success: { bg: c.positiveSoft, fg: c.positive, Icon: CheckCircle2 },
    warning: { bg: c.warningSoft, fg: c.warning, Icon: AlertTriangle },
    error: { bg: c.negativeSoft, fg: c.negative, Icon: XCircle },
  } as const;

  const { bg, fg, Icon } = map[tone];

  return (
    <View
      style={[styles.row, { backgroundColor: bg }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Icon size={20} color={fg} strokeWidth={2.2} />
      <View style={styles.body}>
        <Text variant="smallStrong" style={{ color: fg }}>{title}</Text>
        {message ? (
          <Text variant="caption" style={{ color: fg, marginTop: 2 }}>{message}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
  },
  body: { flex: 1 },
});
