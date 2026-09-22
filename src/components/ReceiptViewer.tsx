import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { receiptFullUrl, receiptThumbUrl } from '../lib/cloudinary';
import { Text } from './Text';

interface Props {
  url: string;
}

const PREVIEW_HEIGHT = 190;

/**
 * The receipt on an expense: a preview you can tap to fill the screen.
 *
 * The preview fits rather than crops — a receipt cropped to a tidy rectangle
 * loses the total off the bottom, which is the one line anybody wanted. Full
 * screen is a plain modal on black, because the picture is the content and
 * anything else drawn over it is in the way.
 */
export function ReceiptViewer({ url }: Props) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);

  const preview = receiptThumbUrl(url, PREVIEW_HEIGHT);
  const full = receiptFullUrl(url);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Receipt photo. Opens full screen."
        style={({ pressed }) => [
          styles.preview,
          { backgroundColor: c.elevated, borderColor: c.border, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Image
          source={{ uri: preview ?? url }}
          style={styles.previewImage}
          contentFit="contain"
          transition={160}
          cachePolicy="memory-disk"
        />
      </Pressable>

      <Modal
        visible={open}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.fullRoot}>
          <Image
            source={{ uri: full ?? url }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={160}
            cachePolicy="memory-disk"
          />
          <SafeAreaView style={styles.closeArea}>
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close the photo"
              style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
            >
              <X size={22} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

/** The label above the preview, kept here so both live and deleted rows match. */
export function ReceiptCaption() {
  return <Text variant="caption" tone="muted">Tap to view full screen</Text>;
}

const styles = StyleSheet.create({
  preview: {
    height: PREVIEW_HEIGHT,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  // Always black, in both themes: it is a lightbox, not a surface.
  fullRoot: { flex: 1, backgroundColor: '#000000' },
  closeArea: { position: 'absolute', top: 0, right: 0, left: 0, alignItems: 'flex-end' },
  close: {
    margin: space.md,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
