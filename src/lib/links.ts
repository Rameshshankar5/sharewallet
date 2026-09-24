import { firebaseConfig } from '../firebase/config';

/**
 * Where invite links point.
 *
 * Firebase Hosting gives every project a free `<project>.web.app` domain, and
 * that domain is what the Android build claims in its App Links, so a tapped
 * link opens the app rather than the browser. The page served there is only
 * the fallback for a phone without the app.
 */
export const LINK_HOST = `${firebaseConfig.projectId}.web.app`;

export function inviteUrl(code: string): string {
  return `https://${LINK_HOST}/i/${code}`;
}

/** Codes are base62, and long enough that guessing one is hopeless. */
export const INVITE_CODE = /^[A-Za-z0-9]{12}$/;

export function isInviteCode(code: unknown): code is string {
  return typeof code === 'string' && INVITE_CODE.test(code);
}
