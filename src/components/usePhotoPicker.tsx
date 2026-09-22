import React, { useCallback, useMemo, useState } from 'react';
import { pickAndUpload, ImageError } from '../services/images';
import type { ImageKind } from '../lib/cloudinary';
import { PhotoSourceSheet } from './PhotoSourceSheet';

interface Options {
  kind: ImageKind;
  /** The current picture, so the sheet knows whether to offer "Remove". */
  value: string | null;
  onChange: (url: string | null) => void;
  onError: (message: string) => void;
}

interface Picker {
  /** Show the sheet. */
  open: () => void;
  /** Render this somewhere in the screen for the sheet to exist. */
  sheet: React.ReactElement;
  busy: boolean;
  /** 0–1 while uploading, null when there is nothing to report yet. */
  progress: number | null;
}

/**
 * The whole picture-changing interaction: choose a source, crop, upload,
 * report progress, hand back a URL.
 *
 * Progress is worth the wiring. A receipt is a few hundred kilobytes over
 * mobile data, which is seconds — and seconds with no feedback read as a
 * frozen app, so people tap again or back out of a working upload.
 */
export function usePhotoPicker({ kind, value, onChange, onError }: Options): Picker {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const run = useCallback(async (source: 'camera' | 'library') => {
    setBusy(true);
    setProgress(null);
    try {
      const url = await pickAndUpload(source, kind, (fraction) => setProgress(fraction));
      // Null means they backed out of the picker or the crop. Not a failure,
      // and not something to show an error about.
      if (url) onChange(url);
    } catch (e) {
      onError(e instanceof ImageError ? e.message : 'Could not upload that photo.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [kind, onChange, onError]);

  const sheet = useMemo(() => (
    <PhotoSourceSheet
      visible={visible}
      title={value ? 'Change the photo' : 'Add a photo'}
      onRemove={value ? () => onChange(null) : undefined}
      onPick={(source) => { void run(source); }}
      onClose={() => setVisible(false)}
    />
  ), [visible, value, onChange, run]);

  return { open: () => setVisible(true), sheet, busy, progress };
}
