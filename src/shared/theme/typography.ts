import {Platform, StyleSheet} from 'react-native';

export const typography = StyleSheet.create({
  hero: {fontSize: 34, fontWeight: '700', letterSpacing: -1, lineHeight: 42},
  title: {fontSize: 28, fontWeight: '600', letterSpacing: -0.7, lineHeight: 36},
  heading: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  body: {fontSize: 16, lineHeight: 24},
  small: {fontSize: 13, lineHeight: 20},
  caption: {fontSize: 12, lineHeight: 18},
  label: {fontSize: 14, fontWeight: '600', lineHeight: 20},
  button: {fontSize: 16, fontWeight: '600', lineHeight: 22},
  eyebrow: {fontSize: 12, fontWeight: '600', letterSpacing: 1, lineHeight: 18},
  number: {
    fontFamily: Platform.OS === 'ios' ? 'ui-monospace' : 'monospace',
    fontSize: 18,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
});
