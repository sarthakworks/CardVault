import { create } from 'zustand';
import { z } from 'zod';
import { readPreference, writePreference } from '../../core/storage/preferencesRepository';

export type ThemeMode = 'light' | 'dark';
interface SettingsState {
  theme: ThemeMode;
  biometricsEnabled: boolean;
  ready: boolean;
}

export const useSettingsStore = create<SettingsState>(() => ({
  theme: 'light',
  biometricsEnabled: false,
  ready: false,
}));

export async function refreshSettings(): Promise<void> {
  const [theme, biometrics] = await Promise.all([readPreference('theme'), readPreference('biometrics')]);
  useSettingsStore.setState({
    theme: theme === null ? 'light' : z.enum(['light', 'dark']).parse(theme),
    biometricsEnabled: biometrics === null ? false : z.enum(['true', 'false']).parse(biometrics) === 'true',
    ready: true,
  });
}

export async function changeTheme(theme: ThemeMode): Promise<void> {
  await writePreference('theme', theme);
  useSettingsStore.setState({ theme });
}
