import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CardInput } from '../../core/vault/models';
import { typography } from '../../shared/theme/typography';
import { CardNetworkLogo } from './CardNetworkLogo';
import { bankGradient } from './bankThemes';

export function CardEditorPreview({ values }: { values: Pick<CardInput, 'number' | 'bank' | 'network' | 'type' | 'tier' | 'country'> }) {
  const { fontScale } = useWindowDimensions();
  const digits = values.number.replace(/\D/g, '');
  const ending = digits.length >= 13 ? digits.slice(-4) : '\u2022\u2022\u2022\u2022';
  return (
    <LinearGradient colors={bankGradient(values.bank)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { minHeight: 184 * fontScale }]}>
      <View style={styles.top}>
        <Text numberOfLines={2} style={styles.bank}>{values.bank || 'Your bank'}</Text>
        <View style={styles.network}>
          <CardNetworkLogo network={values.network} variant="card" />
          {values.tier ? <Text numberOfLines={2} style={styles.tier}>{values.tier}</Text> : null}
        </View>
      </View>
      <Text accessibilityLabel={digits.length >= 13 ? `Card ending ${ending}` : 'Masked card number preview'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.number}>{`\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  ${ending}`}</Text>
      <View style={styles.bottom}>
        <Text numberOfLines={1} style={styles.type}>{values.type || 'CARD TYPE'}</Text>
        <Text numberOfLines={1} style={styles.country}>{values.country || 'COUNTRY'}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: '100%', minWidth: 0, aspectRatio: 1.9, borderRadius: 22, padding: 22, justifyContent: 'space-between', overflow: 'hidden', gap: 18 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  bank: { flex: 1, minWidth: 0, color: '#F6F8FF', fontSize: 18, lineHeight: 25, fontWeight: '600' },
  network: { maxWidth: 112, alignItems: 'center', gap: 4 },
  tier: { color: '#D4DEED', fontSize: 11, lineHeight: 15, letterSpacing: 0.6, textAlign: 'center' },
  number: { ...typography.number, color: '#F6F8FF' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  type: { ...typography.caption, flex: 1, color: '#D4DEED', letterSpacing: 0.5, textTransform: 'uppercase' },
  country: { ...typography.caption, flex: 1, color: '#D4DEED', textAlign: 'right' },
});
