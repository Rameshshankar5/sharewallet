import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, UploadType } from 'expo-file-system';
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
 * The OS crop step, which differs by what the picture is for.
 *
 * A face wants a square, and the system editor gives exactly that on both
 * platforms. A receipt does not: iOS forces the crop rectangle to a square and
 * offers no way to change it, and a squared receipt loses the total off the
 * bottom — the one line anybody opens it for. So receipts get the editor on
 * Android, where the shape can be set, and are left whole on iOS.
 */
function editorFor(kind: ImageKind): Partial<ImagePicker.ImagePickerOptions> {
  if (kind === 'avatar') return { allowsEditing: true, aspect: [1, 1] };
  return Platform.OS === 'android'
    ? { allowsEditing: true, aspect: [3, 4] }
    : { allowsEditing: false };
}

/**
 * Put a photo in front of the person and hand back a local file URI.
 *
 * Returns null when they backed out, which is not an error and must not be
 * reported as one.
 */
export async function pickImage(source: PickSource, kind: ImageKind): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new ImageError(
        `Camera access is off for this app. Turn it on in your phone settings to ${
          kind === 'avatar' ? 'take a profile picture' : 'photograph a receipt'
        }.`,
      );
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1, // Compressed below, after resizing — compressing twice is lossy for nothing.
    exif: false,
    ...editorFor(kind),
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
 * Sent by expo-file-system's native uploader rather than `fetch` with a
 * FormData file. The fetch route builds the multipart body in JavaScript and
 * failed on device with nothing but "Network request failed" — no status, no
 * response — while the same endpoint and preset accepted a plain curl. The
 * native path streams the file from disk and reports a real status.
 *
 * The preset decides the folder and the size cap; the app cannot widen either,
 * which is the point — nothing secret has to ship in the APK for this to work.
 */
export async function uploadImage(localUri: string, kind: ImageKind): Promise<string> {
  const preset = presetFor(kind);
  if (!preset) throw new ImageError('Image uploads are not configured in this build.');

  const { uri } = await compress(localUri, kind);

  let result: { body: string; status: number };
  try {
    result = await new File(uri).upload(uploadEndpoint(), {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'image/jpeg',
      parameters: { upload_preset: preset },
    });
  } catch (e) {
    // Carry the underlying reason. "Check your connection" sent someone
    // hunting a network fault when the request was never the problem.
    const detail = e instanceof Error && e.message ? ` (${e.message})` : '';
    throw new ImageError(`Could not reach Cloudinary${detail}.`);
  }

  let body: CloudinaryResponse;
  try {
    body = JSON.parse(result.body) as CloudinaryResponse;
  } catch {
    throw new ImageError(`Cloudinary replied ${result.status} with something unreadable.`);
  }

  if (result.status < 200 || result.status >= 300 || !body.secure_url) {
    // Cloudinary's own message is the useful one here — a preset that is
    // signed, renamed or missing says so precisely, and guessing would send
    // someone hunting in the wrong place.
    throw new ImageError(body.error?.message ?? `Cloudinary rejected the upload (${result.status}).`);
  }

  return body.secure_url;
}

/** Pick and upload in one go. Null means they cancelled the picker. */
export async function pickAndUpload(source: PickSource, kind: ImageKind): Promise<string | null> {
  const local = await pickImage(source, kind);
  if (!local) return null;
  return uploadImage(local, kind);
}
