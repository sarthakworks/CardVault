import { createContext, useContext, type PropsWithChildren } from 'react';
import { palettes, type ThemeColors } from './colors';
import { useSettingsStore } from '../../features/settings/settingsStore';

const ThemeContext = createContext<{ colors: ThemeColors; dark: boolean } | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const theme = useSettingsStore((state) => state.theme);
  return <ThemeContext.Provider value={{ colors: palettes[theme], dark: theme === 'dark' }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeProvider is missing.');
  return theme;
}
