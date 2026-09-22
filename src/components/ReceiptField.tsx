import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera, Receipt } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, HIT } from '../theme/tokens';
import { receiptThumbUrl } from '../lib/cloudinary';
import { usePhotoPicker } from './usePhotoPicker';
import { Text } from './Text';

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Lifted so the form can refuse to save while an upload is in flight. */
  onBusyChange: (busy: boolean) => void;
  onError: (message: string) => void;
}

const THUMB = 84;

/**
 * Attach a photo of the receipt or the thing that was bought.
 *
 * One photo, not an album: the question people come back to an old expense
 * with is "what was this?", and a single bill answers it. Tapping an attached
 * photo re-opens the same choice, so replacing and removing are where adding
 * was, rather than hidden behind a second control.
 */
export function ReceiptField({ value, onChange, onBusyChange, onError }: Props) {
  const { c } = useTheme();
  const thumb = receiptThumbUrl(value, THUMB);

  const { open, sheet, busy, progress } = usePhotoPicker({
    kind: 'receipt', value, onChange, onError,
  });

  // Reported upwards rather than kept here, because it is the Save button on
  // the form that has to care.
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);

  const percent = progress === null ? null : Math.round(progress * 100);

  return (
    <>
      <Pressable
        onPress={open}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={value ? 'Change the receipt photo' : 'Add a receipt photo'}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: c.elevated,
            borderColor: c.border,
            opacity: pressed || busy ? 0.75 : 1,
          },
        ]}
      >
        <View style={[styles.thumb, { backgroundColor: c.card, borderColor: c.border }]}>
          {busy ? (
            <ActivityIndicator color={c.primary} />
          ) : thumb ? (
            <Image source={{ uri: thumb }} style={styles.image} contentFit="cover" transition={140} />
          ) : (
            <Receipt size={24} color={c.textFaint} strokeWidth={2} />
          )}
        </View>

        <View style={styles.text}>
          <Text variant="bodyStrong">
            {busy ? 'Uploading…' : value ? 'Receipt attached' : 'Add a receipt photo'}
          </Text>
          <Text variant="caption" tone="muted">
            {busy
              ? percent === null ? 'Preparing the photo…' : `${percent}% sent`
              : value
                ? 'Tap to replace or remove it.'
                : 'Optional. Handy for remembering what a shared bill was for.'}
          </Text>

          {/* A number alone reads as stalled between updates; the bar moving is
              what tells someone the upload is alive. */}
          {busy && percent !== null ? (
            <View style={[styles.track, { backgroundColor: c.border }]}>
              <View style={[styles.fill, { backgroundColor: c.primary, width: `${percent}%` }]} />
            </View>
          ) : null}
        </View>

        {!busy && !value ? <Camera size={20} color={c.textMuted} strokeWidth={2.2} /> : null}
      </Pressable>

      {sheet}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: HIT,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  text: { flex: 1, gap: 2 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%' },
});
