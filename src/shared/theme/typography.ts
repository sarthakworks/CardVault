import { StyleSheet } from 'react-native';

export const typography = StyleSheet.create({
  hero: { fontSize: 36, fontWeight: '700', letterSpacing: -1.5, lineHeight: 42 },
  title: { fontSize: 27, fontWeight: '700', letterSpacing: -0.8, lineHeight: 34 },
  heading: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 23 },
  small: { fontSize: 12, lineHeight: 18 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2.2 },
  number: { fontFamily: 'monospace', fontSize: 18, letterSpacing: 1.2 },
});
