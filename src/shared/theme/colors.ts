const light = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F7',
  textPrimary: '#142033',
  textSecondary: '#59677C',
  border: '#DFE5EF',
  accent: '#365CCB',
  accentMuted: '#EAF0FF',
  onAccent: '#FFFFFF',
  danger: '#B4233D',
  dangerMuted: '#FFF0F2',
  success: '#16754F',
  successMuted: '#E7F5ED',
  scrim: '#101828B8',
} as const;

export type ThemeColors = { [Key in keyof typeof light]: string };

const dark: ThemeColors = {
  background: '#0B111B',
  surface: '#141D2B',
  surfaceMuted: '#1D2939',
  textPrimary: '#F3F6FC',
  textSecondary: '#ACB9CC',
  border: '#2B3A4F',
  accent: '#A8BCFF',
  accentMuted: '#263558',
  onAccent: '#101C35',
  danger: '#FF9AA9',
  dangerMuted: '#42212D',
  success: '#82D8AF',
  successMuted: '#193A31',
  scrim: '#000000CC',
};

export const palettes = { light, dark };
