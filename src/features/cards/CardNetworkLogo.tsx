import { StyleSheet, Text, View } from 'react-native';
import { cardNetworkIdentity, cardNetworkLabel } from '../../core/validation/cardRules';
import { useTheme } from '../../shared/theme/ThemeProvider';

export function CardNetworkLogo({ network, variant = 'input' }: { network?: string; variant?: 'input' | 'card' }) {
  const { colors, dark } = useTheme();
  const key = cardNetworkIdentity(network ?? '');
  const onCard = variant === 'card';
  const foreground = onCard ? '#F6F8FF' : colors.textPrimary;
  let mark;
  if (key === 'visa') {
    mark = <Text allowFontScaling={false} style={[styles.visa, { color: onCard ? '#FFFFFF' : dark ? '#C3D0FF' : '#1434CB' }]}>VISA</Text>;
  } else if (key === 'mastercard' || key === 'maestro') {
    mark = <View style={styles.circles}>
      <View style={[styles.circle, styles.leftCircle, { backgroundColor: '#EB001B' }]} />
      <View style={[styles.circle, styles.rightCircle, { backgroundColor: key === 'mastercard' ? '#F79E1B' : '#0099DF' }]} />
      <View style={[styles.circle, styles.overlapClip]}><View style={[styles.circle, styles.overlap, { backgroundColor: key === 'mastercard' ? '#FF5F00' : '#6C6BBD' }]} /></View>
    </View>;
  } else if (key === 'amex') {
    mark = <View style={styles.amex}><Text allowFontScaling={false} style={styles.amexTop}>AMERICAN</Text><Text allowFontScaling={false} style={styles.amexBottom}>EXPRESS</Text></View>;
  } else if (key === 'jcb') {
    mark = <View style={styles.jcb}>{(['J', 'C', 'B'] as const).map((letter, index) => <View key={letter} style={[styles.jcbBlock, { backgroundColor: ['#174992', '#C72136', '#27874C'][index] }]}><Text allowFontScaling={false} style={styles.jcbLetter}>{letter}</Text></View>)}</View>;
  } else {
    const known = ['rupay', 'discover', 'unionpay', 'diners'].includes(key);
    if (!known && !onCard) return null;
    mark = <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.wordmark, { color: foreground }]}>{network ? cardNetworkLabel(network) : 'CARD'}</Text>;
  }
  return <View accessible accessibilityRole="image" accessibilityLabel={network ? cardNetworkLabel(network) : 'Network not provided'} style={styles.logo}>{mark}</View>;
}

const styles = StyleSheet.create({
  logo: { width: 58, height: 35, alignItems: 'center', justifyContent: 'center' },
  visa: { fontSize: 26, lineHeight: 33, fontStyle: 'italic', fontWeight: '900', letterSpacing: -1.7 },
  wordmark: { maxWidth: 58, fontSize: 14, fontWeight: '800', letterSpacing: -0.5 },
  circles: { width: 52, height: 31 },
  circle: { position: 'absolute', width: 27, height: 27, borderRadius: 14 },
  leftCircle: { left: 3, top: 2 },
  rightCircle: { left: 21, top: 2 },
  overlapClip: { left: 3, top: 2, overflow: 'hidden' },
  overlap: { left: 18, top: 0 },
  amex: { width: 54, height: 32, borderRadius: 3, backgroundColor: '#2675BA', alignItems: 'center', justifyContent: 'center' },
  amexTop: { color: '#FFFFFF', fontSize: 7.5, lineHeight: 10, fontWeight: '900', letterSpacing: -0.3 },
  amexBottom: { color: '#FFFFFF', fontSize: 8.5, lineHeight: 10, fontWeight: '900', letterSpacing: -0.3 },
  jcb: { flexDirection: 'row', gap: 2 },
  jcbBlock: { width: 16, height: 25, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  jcbLetter: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
