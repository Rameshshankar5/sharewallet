import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dark, light, type ColorScheme, type Palette } from './tokens';

/** What the person chose, which is not the same as what they end up seeing. */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'sharewallet.theme';

interface ThemeValue {
  /** The palette actually in use, once the preference is resolved. */
  scheme: ColorScheme;
  c: Palette;
  isDark: boolean;
  /** What the person picked — 'system' means "whatever the phone says". */
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue>({
  scheme: 'dark', c: dark, isDark: true,
  preference: 'system', setPreference: () => {},
});

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  /**
   * The stored choice has to be in hand before the first paint, or someone who
   * picked Light on a dark phone watches the app flash dark and correct itself.
   * The read is a few milliseconds and happens while the fonts are still
   * loading behind the splash, so nothing is waiting on it in practice.
   */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (isPreference(stored)) setPreferenceState(stored);
      })
      // A device that cannot read its own storage still gets a working app;
      // it just follows the phone until the next time the choice is made.
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    // Applied immediately; the write is only so it survives a restart, and a
    // failed write must not undo the change the person just made.
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const resolved: ColorScheme = preference === 'system'
      ? (system === 'light' ? 'light' : 'dark')
      : preference;
    return {
      scheme: resolved,
      c: resolved === 'dark' ? dark : light,
      isDark: resolved === 'dark',
      preference,
      setPreference,
    };
  }, [preference, system, setPreference]);

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** `const { c } = useTheme()` then `c.text`, `c.positive`, ... */
export function useTheme() {
  return useContext(ThemeContext);
}
