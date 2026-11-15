const light = {
  background: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceMuted: '#ECEEF2',
  textPrimary: '#1D2129',
  textSecondary: '#636A77',
  border: '#DDE1E7',
  accent: '#2864E8',
  accentMuted: '#EDF3FF',
  brandSurface: '#EDF3FF',
  onAccent: '#FFFFFF',
  danger: '#B52E45',
  dangerMuted: '#FCEEF0',
  success: '#23734D',
  successMuted: '#EAF4EE',
  scrim: '#10121699',
} as const;

export type ThemeColors = { [Key in keyof typeof light]: string };

const dark: ThemeColors = {
  background: '#101216',
  surface: '#1B1E24',
  surfaceMuted: '#262A32',
  textPrimary: '#F4F5F7',
  textSecondary: '#ADB3BF',
  border: '#353A44',
  accent: '#8FB4FF',
  accentMuted: '#233354',
  brandSurface: '#1B1E24',
  onAccent: '#122447',
  danger: '#FF9AA9',
  dangerMuted: '#3E252D',
  success: '#91D6AF',
  successMuted: '#20382B',
  scrim: '#000000B3',
};

export const palettes = { light, dark };
