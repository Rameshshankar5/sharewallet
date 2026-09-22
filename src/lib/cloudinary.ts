/**
 * Cloudinary configuration and URL building.
 *
 * Images live on Cloudinary rather than Firebase Storage, which now needs a
 * billing-enabled project. The phone uploads straight to Cloudinary using an
 * UNSIGNED upload preset, so there is no server and no API secret in the app.
 *
 * What that costs, stated plainly: an unsigned preset is a public write
 * endpoint. Anyone who unpacks the APK can upload into these folders, and
 * anyone holding a delivered URL can fetch that image — Firestore rules guard
 * the expense row, not the picture. The presets cap dimensions and pin the
 * folder, so the damage is wasted quota rather than exposure, but closing it
 * properly would need a signing server.
 *
 * This half is pure URL arithmetic and is exercised by the test suite.
 * Reading the environment lives in `cloudinaryConfig.ts`, which cannot be
 * compiled without Expo's types.
 */

export type ImageKind = 'avatar' | 'receipt';

/**
 * Insert a transformation into a Cloudinary delivery URL.
 *
 * Every stored URL is the plain `secure_url` from the upload, so the app asks
 * for the size it actually needs at display time instead of storing several
 * copies. A URL that isn't a Cloudinary delivery URL comes back untouched
 * rather than mangled — worth caring about because these strings are also what
 * older rows hold.
 */
export function withTransform(url: string | null | undefined, transform: string): string | null {
  if (!url) return null;
  const marker = '/upload/';
  const at = url.indexOf(marker);
  if (at === -1) return url;

  const head = url.slice(0, at + marker.length);
  const tail = url.slice(at + marker.length);
  return `${head}${transform}/${tail}`;
}

/**
 * A square avatar at the size it will be drawn.
 *
 * `g_face` keeps the face in frame when a square crop has to lose something,
 * and falls back to the middle of the image when it cannot find one.
 */
export function avatarUrl(url: string | null | undefined, size: number): string | null {
  const px = Math.max(32, Math.round(size * 3)); // Retina, capped by the preset.
  return withTransform(url, `f_auto,q_auto,c_fill,g_face,w_${px},h_${px}`);
}

/** A receipt scaled to fit a thumbnail without cropping anything away. */
export function receiptThumbUrl(url: string | null | undefined, size: number): string | null {
  const px = Math.max(64, Math.round(size * 3));
  return withTransform(url, `f_auto,q_auto,c_fit,w_${px},h_${px}`);
}

/** The full receipt, still format- and quality-optimised for the device. */
export function receiptFullUrl(url: string | null | undefined): string | null {
  return withTransform(url, 'f_auto,q_auto');
}
