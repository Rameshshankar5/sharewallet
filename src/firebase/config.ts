/**
 * Firebase credentials come from EXPO_PUBLIC_* env vars (see .env.example).
 *
 * These values are not secrets — they ship inside every Firebase web/mobile app
 * and are safe to expose. What actually protects your data is firestore.rules,
 * which is why those rules are written strictly: a stranger holding this config
 * still cannot read or write anything without a profile document that only the
 * superadmin can create.
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const raw: FirebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

export const missingKeys = (Object.keys(raw) as (keyof FirebaseConfig)[])
  .filter((k) => !raw[k]);

export const isConfigured = missingKeys.length === 0;

export const firebaseConfig = raw;
