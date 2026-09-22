import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ImageIcon, Trash2, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, HIT } from '../theme/tokens';
import { Text } from './Text';

export interface PhotoSourceSheetProps {
  visible: boolean;
  title: string;
  /** Offered only when there is already a picture to remove. */
  onRemove?: () => void;
  onPick: (source: 'camera' | 'library') => void;
  onClose: () => void;
}

interface RowProps {
  icon: LucideIcon;
  label: string;
  hint: string;
  danger?: boolean;
  divider: boolean;
  onPress: () => void;
}

function Row({ icon: Icon, label, hint, danger, divider, onPress }: RowProps) {
  const { c } = useTheme();
  const tint = danger ? c.negative : c.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? c.negativeSoft : c.primarySoft }]}>
        <Icon size={20} color={danger ? c.negative : c.primary} strokeWidth={2.2} />
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyStrong" style={{ color: tint }}>{label}</Text>
        <Text variant="caption" tone="muted">{hint}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Where a picture should come from.
 *
 * This replaces a stock `Alert`, which on Android draws a grey box with the
 * choices as shouty right-aligned capitals in whatever order it likes — no
 * icons, no theme, Cancel sitting above the things people actually came to
 * tap. This is the app's own surface: the two real choices first, each saying
 * what it does, Cancel last where it belongs.
 *
 * Camera leads because the common case is photographing a receipt at the till,
 * not hunting for it in an album afterwards.
 */
export function PhotoSourceSheet({
  visible, title, onRemove, onPick, onClose,
}: PhotoSourceSheetProps) {
  const { c } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Tapping the dimmed area behind is the gesture people try first. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

      <View style={styles.dock} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']}>
          <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.grabber, { backgroundColor: c.border }]} />
            <Text variant="label" tone="muted" style={styles.title}>{title.toUpperCase()}</Text>

            <Row
              icon={Camera}
              label="Take a photo"
              hint="Use the camera now"
              divider
              onPress={() => { onClose(); onPick('camera'); }}
            />
            <Row
              icon={ImageIcon}
              label="Choose from gallery"
              hint="Pick one you already have"
              divider={!!onRemove}
              onPress={() => { onClose(); onPick('library'); }}
            />
            {onRemove ? (
              <Row
                icon={Trash2}
                label="Remove"
                hint="Go back to no picture"
                danger
                divider={false}
                onPress={() => { onClose(); onRemove(); }}
              />
            ) : null}
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cancel,
              { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text variant="bodyStrong">Cancel</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  dock: { flex: 1, justifyContent: 'flex-end', padding: space.md, gap: space.sm },
  sheet: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: space.sm,
  },
  grabber: {
    alignSelf: 'center', width: 36, height: 4,
    borderRadius: radius.pill, marginBottom: space.sm,
  },
  title: { paddingHorizontal: space.lg, paddingBottom: space.sm, letterSpacing: 0.6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    minHeight: HIT + 12, paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 1 },
  cancel: {
    minHeight: HIT + 4,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
