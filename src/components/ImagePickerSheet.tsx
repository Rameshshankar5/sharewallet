import { Alert } from 'react-native';
import { pickAndUpload, ImageError, type PickSource } from '../services/images';
import type { ImageKind } from '../lib/cloudinary';

interface Options {
  kind: ImageKind;
  title: string;
  /** Offered only when there is already a picture to remove. */
  onRemove?: () => void;
  onPicked: (url: string) => void;
  onError: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
}

/**
 * Camera or gallery, then upload.
 *
 * A native action sheet rather than a custom modal: this is a system choice
 * about the camera, and the OS one is the sheet people already recognise —
 * and the only one that reads correctly to a screen reader on both platforms.
 *
 * Camera comes first because the common case is photographing a receipt at
 * the till, not hunting for it in an album afterwards.
 */
export function chooseAndUploadImage({
  kind, title, onRemove, onPicked, onError, onBusyChange,
}: Options) {
  const run = async (source: PickSource) => {
    onBusyChange(true);
    try {
      const url = await pickAndUpload(source, kind);
      // Null means they backed out of the picker. Not a failure, not an error
      // message — just nothing to do.
      if (url) onPicked(url);
    } catch (e) {
      onError(e instanceof ImageError ? e.message : 'Could not upload that photo.');
    } finally {
      onBusyChange(false);
    }
  };

  Alert.alert(title, undefined, [
    { text: 'Take a photo', onPress: () => { void run('camera'); } },
    { text: 'Choose from gallery', onPress: () => { void run('library'); } },
    ...(onRemove ? [{ text: 'Remove', style: 'destructive' as const, onPress: onRemove }] : []),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
