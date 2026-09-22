import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImageKind } from '../lib/cloudinary';
import { presetFor, uploadEndpoint } from '../lib/cloudinaryConfig';

/** How wide an image is allowed to arrive at Cloudinary, per kind. */
const MAX_WIDTH: Record<ImageKind, number> = {
  // Square and small; the preset caps it again at 512.
  avatar: 768,
  // A receipt is only useful if the printed text survives. 1600 keeps it
  // readable and still lands a few hundred KB.
  receipt: 1600,
};

const QUALITY: Record<ImageKind, number> = { avatar: 0.7, receipt: 0.75 };

export type PickSource = 'camera' | 'library';

export class ImageError extends Error {}

/**
 * Put a photo in front of the person and hand back a local file URI.
 *
 * Returns null when they backed out, which is not an error and must not be
 * reported as one.
 */
export async function pickImage(source: PickSource): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new ImageError(
        'Camera access is off for this app. Turn it on in your phone settings to photograph a receipt.',
      );
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1, // Compressed below, after resizing — compressing twice is lossy for nothing.
    exif: false,
  };

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

/**
 * Shrink and compress before upload.
 *
 * Cloudinary's incoming transformation would resize this anyway, but that
 * happens *after* the bytes cross the network. Sending a 12 MP phone photo
 * over mobile data to have it thrown away at the other end is the difference
 * between a receipt that attaches in a second and one that times out.
 */
async function compress(uri: string, kind: ImageKind): Promise<{ uri: string }> {
  const context = ImageManipulator.manipulate(uri).resize({ width: MAX_WIDTH[kind] });
  const image = await context.renderAsync();
  return image.saveAsync({ compress: QUALITY[kind], format: SaveFormat.JPEG });
}

interface CloudinaryResponse {
  secure_url?: string;
  error?: { message?: string };
}

/**
 * Upload to Cloudinary with the unsigned preset for this kind of image and
 * return the delivery URL to store.
 *
 * The preset decides the folder and the size cap; the app cannot widen either,
 * which is the point — nothing secret has to ship in the APK for this to work.
 */
export async function uploadImage(localUri: string, kind: ImageKind): Promise<string> {
  const preset = presetFor(kind);
  if (!preset) throw new ImageError('Image uploads are not configured in this build.');

  const { uri } = await compress(localUri, kind);

  const form = new FormData();
  // React Native's FormData takes this shape for a file; it is not a Blob.
  form.append('file', {
    uri,
    name: `${kind}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('upload_preset', preset);

  let response: Response;
  try {
    response = await fetch(uploadEndpoint(), { method: 'POST', body: form });
  } catch {
    throw new ImageError('Could not reach Cloudinary. Check your connection and try again.');
  }

  let body: CloudinaryResponse;
  try {
    body = (await response.json()) as CloudinaryResponse;
  } catch {
    throw new ImageError('Cloudinary sent back something unreadable. Try again.');
  }

  if (!response.ok || !body.secure_url) {
    // Cloudinary's own message is the useful one here — a preset that is
    // signed, renamed or missing says so precisely, and guessing would send
    // someone hunting in the wrong place.
    throw new ImageError(body.error?.message ?? 'Cloudinary rejected the upload.');
  }

  return body.secure_url;
}

/** Pick and upload in one go. Null means they cancelled the picker. */
export async function pickAndUpload(source: PickSource, kind: ImageKind): Promise<string | null> {
  const local = await pickImage(source);
  if (!local) return null;
  return uploadImage(local, kind);
}
