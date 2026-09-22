/**
 * Design tokens. Every colour in the app comes from here — never hardcode a hex
 * inside a component, or dark mode silently breaks.
 *
 * Palette: "Personal Finance Tracker" (trust blue + profit green), extended with
 * a matching light scheme. Both schemes are contrast-checked: body text >= 4.5:1,
 * secondary text >= 3:1.
 */

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  /** Screen background */
  background: string;
  /** Raised surface (cards, sheets, inputs) */
  card: string;
  /** Surface one step above card (nested rows, selected chips) */
  elevated: string;
  /** Low-emphasis fill behind muted content */
  muted: string;

  /** Primary body text */
  text: string;
  /** Secondary / supporting text */
  textMuted: string;
  /** Tertiary text, timestamps, disabled labels */
  textFaint: string;

  primary: string;
  onPrimary: string;
  primarySoft: string;

  /** Money coming back to you */
  positive: string;
  positiveSoft: string;
  /** Money you owe */
  negative: string;
  negativeSoft: string;
  /** Warnings, unbalanced split state */
  warning: string;
  warningSoft: string;

  border: string;
  borderStrong: string;
  /** Modal / sheet backdrop */
  scrim: string;

  /** Illustration accents */
  illoInk: string;
  illoFill: string;
  illoAccent: string;
}

export const light: Palette = {
  background: '#F5F7FB',
  card: '#FFFFFF',
  elevated: '#EEF2F9',
  muted: '#E6EBF3',

  text: '#0B1220',
  textMuted: '#55607A',
  textFaint: '#7D8698',

  primary: '#1E40AF',
  onPrimary: '#FFFFFF',
  primarySoft: '#E3EAFB',

  positive: '#047857',
  positiveSoft: '#D6F3E6',
  negative: '#C42A2A',
  negativeSoft: '#FBE0E0',
  warning: '#9A5B00',
  warningSoft: '#FCEFD6',

  border: '#DCE3ED',
  borderStrong: '#C3CDDD',
  scrim: 'rgba(11,18,32,0.45)',

  illoInk: '#1E40AF',
  illoFill: '#DCE6FB',
  illoAccent: '#059669',
};

export const dark: Palette = {
  background: '#0F172A',
  card: '#192134',
  elevated: '#222C42',
  muted: '#101A34',

  text: '#F8FAFC',
  textMuted: '#A9B4C8',
  textFaint: '#7C879C',

  primary: '#5B8DEF',
  onPrimary: '#0B1220',
  primarySoft: '#1B2B4D',

  positive: '#34D399',
  positiveSoft: '#123326',
  negative: '#F87171',
  negativeSoft: '#3A1B1B',
  warning: '#FBBF24',
  warningSoft: '#3A2D0C',

  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.18)',
  scrim: 'rgba(0,0,0,0.6)',

  illoInk: '#5B8DEF',
  illoFill: '#22304F',
  illoAccent: '#34D399',
};

/** 4pt rhythm. Use these, not arbitrary numbers. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/** Type scale. `tabular` is applied to every money figure to stop column jitter. */
export const font = {
  display: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 34, lineHeight: 40 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, lineHeight: 25 },
  subheading: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, lineHeight: 22 },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, lineHeight: 24 },
  small: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 16 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, lineHeight: 18 },
} as const;

/** Minimum tap target (Apple HIG 44pt / Material 48dp — we take the larger). */
export const HIT = 48;

/** Motion tokens — one rhythm for the whole app. */
export const motion = {
  fast: 140,
  base: 220,
  slow: 320,
} as const;

/** Deterministic avatar colours, picked by hashing a uid. */
export const avatarColors = [
  '#5B8DEF', '#34D399', '#F59E0B', '#F87171',
  '#A78BFA', '#22D3EE', '#FB7185', '#4ADE80',
  '#FBBF24', '#60A5FA', '#C084FC', '#2DD4BF',
] as const;

export function avatarColorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return avatarColors[h % avatarColors.length];
}
