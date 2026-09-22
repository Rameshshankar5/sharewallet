import type { ImageKind } from './cloudinary';

/**
 * Cloudinary credentials from EXPO_PUBLIC_* env vars (see .env.example).
 *
 * The cloud name and the preset names are not secrets: they travel in every
 * upload request the app makes and are readable in any APK. What keeps this
 * safe enough is the presets being unsigned but *narrow* — each pins a folder
 * and caps dimensions, so the worst a stranger can do is waste quota. The API
 * key and secret are never used here and must never be added.
 *
 * Kept apart from `cloudinary.ts` so that file stays free of `process`, and
 * can be compiled bare for the tests.
 */

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';

const PRESETS: Record<ImageKind, string> = {
  avatar: process.env.EXPO_PUBLIC_CLOUDINARY_AVATAR_PRESET ?? '',
  receipt: process.env.EXPO_PUBLIC_CLOUDINARY_RECEIPT_PRESET ?? '',
};

/** False when .env is missing the values — every image control hides itself. */
export const imagesConfigured = !!CLOUD_NAME && !!PRESETS.avatar && !!PRESETS.receipt;

export function uploadEndpoint(): string {
  return `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
}

export function presetFor(kind: ImageKind): string {
  return PRESETS[kind];
}
