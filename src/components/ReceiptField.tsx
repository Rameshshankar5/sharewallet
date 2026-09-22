import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera, Receipt } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, HIT } from '../theme/tokens';
import { receiptThumbUrl } from '../lib/cloudinary';
import { chooseAndUploadImage } from './ImagePickerSheet';
import { Text } from './Text';

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  busy: boolean;
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
export function ReceiptField({ value, onChange, busy, onBusyChange, onError }: Props) {
  const { c } = useTheme();
  const thumb = receiptThumbUrl(value, THUMB);

  const open = () => {
    chooseAndUploadImage({
      kind: 'receipt',
      title: value ? 'Change the photo' : 'Add a photo',
      onRemove: value ? () => onChange(null) : undefined,
      onPicked: onChange,
      onError,
      onBusyChange,
    });
  };

  return (
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
          opacity: pressed || busy ? 0.6 : 1,
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
            ? 'This can take a moment on mobile data.'
            : value
              ? 'Tap to replace or remove it.'
              : 'Optional. Handy for remembering what a shared bill was for.'}
        </Text>
      </View>

      {!busy && !value ? <Camera size={20} color={c.textMuted} strokeWidth={2.2} /> : null}
    </Pressable>
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
});
