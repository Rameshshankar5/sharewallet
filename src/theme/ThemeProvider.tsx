import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type ColorScheme, type Palette } from './tokens';

interface ThemeValue {
  scheme: ColorScheme;
  c: Palette;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ scheme: 'dark', c: dark, isDark: true });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const value = useMemo<ThemeValue>(() => {
    const scheme: ColorScheme = system === 'light' ? 'light' : 'dark';
    return { scheme, c: scheme === 'dark' ? dark : light, isDark: scheme === 'dark' };
  }, [system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** `const { c } = useTheme()` then `c.text`, `c.positive`, ... */
export function useTheme() {
  return useContext(ThemeContext);
}
