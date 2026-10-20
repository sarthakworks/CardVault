import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { VaultCard } from '../../core/vault/models';
import { formatCardNumber } from '../../shared/utils/formatters';
import { typography } from '../../shared/theme/typography';

function cardMaterial(bank: string): readonly [string, string, string] {
  const normalized = bank.toLowerCase();
  if (normalized.includes('axis')) return ['#6D344E', '#492536', '#2A1D29'];
  if (normalized.includes('icici')) return ['#65564B', '#3D342E', '#262623'];
  if (normalized.includes('sbi')) return ['#365B6C', '#234052', '#172D40'];
  if (normalized.includes('hsbc')) return ['#4B5863', '#303B46', '#1B2731'];
  return ['#3F5E91', '#263E65', '#162A49'];
}

function NetworkMark({ network }: { network: VaultCard['network'] }) {
  if (network === 'Mastercard') return (
    <View accessibilityLabel="Mastercard" style={styles.mastercard}>
      <View style={[styles.networkCircle, { backgroundColor: '#F2574F' }]} />
      <View style={[styles.networkCircle, { backgroundColor: '#FFBD58', marginLeft: -13, opacity: 0.9 }]} />
    </View>
  );
  return <Text style={[styles.network, network === 'Visa' && { fontSize: 25, fontStyle: 'italic' }]}>{network === 'Visa' ? 'VISA' : network === 'Amex' ? 'AMEX' : network}</Text>;
}

interface Props {
  card: VaultCard;
  onPress?: () => void;
  flipped?: boolean;
  showNumber?: boolean;
}

export function CardFace({ card, onPress, flipped = false, showNumber = false }: Props) {
  const rotation = useSharedValue(flipped ? 180 : 0);
  useEffect(() => { rotation.set(withTiming(flipped ? 180 : 0, { duration: 480 })); }, [flipped, rotation]);
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 1100 }, { rotateY: `${rotation.get()}deg` }] }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 1100 }, { rotateY: `${rotation.get() + 180}deg` }] }));
  const colors = cardMaterial(card.bank);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${card.bank} ${card.network} card ending ${card.number.slice(-4)}, ${card.owner}`}
      style={styles.container}
    >
      <Animated.View style={[styles.face, front]} importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          <View style={styles.orbitOne} /><View style={styles.orbitTwo} />
          <View style={styles.top}><Text numberOfLines={1} style={styles.bank}>{card.bank}</Text><View style={styles.owner}><Text numberOfLines={1} style={styles.ownerText}>{card.owner}</Text></View></View>
          <View style={styles.chipRow}>
            <View style={styles.chip}><View style={styles.chipVertical} /><View style={styles.chipHorizontal} /><View style={[styles.chipHorizontal, { top: 21 }]} /></View>
            <Feather name="wifi" color="#D6E0EDB3" size={22} style={{ transform: [{ rotate: '90deg' }] }} />
          </View>
          <Text numberOfLines={1} style={[typography.number, styles.pan]}>{showNumber ? formatCardNumber(card.number) : `\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  ${card.number.slice(-4)}`}</Text>
          <View style={styles.bottom}>
            <View style={styles.holderBlock}><Text style={styles.micro}>CARDHOLDER</Text><Text numberOfLines={1} style={styles.holder}>{card.holder.toUpperCase()}</Text></View>
            <View style={styles.expiryBlock}><Text style={styles.micro}>VALID THRU</Text><Text numberOfLines={1} style={styles.holder}>{card.expiry}</Text></View>
            <NetworkMark network={card.network} />
          </View>
        </LinearGradient>
      </Animated.View>
      <Animated.View style={[styles.face, back]} importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}>
        <LinearGradient colors={colors} style={styles.backGradient}>
          <View style={styles.magneticStripe} />
          <View style={styles.signature}><Text style={styles.signatureText}>Authorized signature</Text><Text numberOfLines={1} style={styles.cvv}>{flipped ? card.cvv : '\u2022\u2022\u2022'}</Text></View>
          <Text style={styles.backHint}>Your security code. For your eyes only.</Text>
          <View style={styles.backFooter}><Feather name="shield" size={17} color="#D5E0F0" /><Text style={styles.backFooterText}>ENCRYPTED IN YOUR VAULT</Text><NetworkMark network={card.network} /></View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { height: 218, width: '100%' },
  face: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 23, backfaceVisibility: 'hidden', overflow: 'hidden', elevation: 5, backgroundColor: '#263E65' },
  gradient: { flex: 1, padding: 23, justifyContent: 'space-between', borderWidth: 1, borderColor: '#FFFFFF20', borderRadius: 23 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  bank: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.4, flex: 1 },
  owner: { backgroundColor: '#FFFFFF16', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, maxWidth: 100, borderWidth: 1, borderColor: '#FFFFFF26' },
  ownerText: { color: '#E4EBF5', fontSize: 10, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 13, alignItems: 'center' },
  chip: { width: 40, height: 31, borderRadius: 7, backgroundColor: '#D1BD89', borderWidth: 1, borderColor: '#F6E4B4', overflow: 'hidden' },
  chipVertical: { position: 'absolute', height: 31, width: 15, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#93825C', left: 12 },
  chipHorizontal: { position: 'absolute', width: 40, borderTopWidth: 1, borderColor: '#93825C', top: 9 },
  pan: { color: '#F5F7FD', fontSize: 16, letterSpacing: 1.1 },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 15 },
  holderBlock: { flex: 1, gap: 5 },
  expiryBlock: { gap: 5, maxWidth: 70 },
  micro: { color: '#BFCEE1', fontSize: 7, fontWeight: '600', letterSpacing: 1.5 },
  holder: { color: '#F4F7FC', fontSize: 10, fontWeight: '600', letterSpacing: 0.9 },
  network: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.7 },
  mastercard: { flexDirection: 'row', paddingBottom: 1 },
  networkCircle: { height: 26, width: 26, borderRadius: 15 },
  orbitOne: { position: 'absolute', width: 340, height: 340, borderWidth: 1, borderColor: '#FFFFFF0D', borderRadius: 170, top: -110, right: -180 },
  orbitTwo: { position: 'absolute', width: 320, height: 320, borderWidth: 32, borderColor: '#FFFFFF04', borderRadius: 160, bottom: -250, left: -60 },
  backGradient: { flex: 1, paddingTop: 28 },
  magneticStripe: { height: 40, backgroundColor: '#111720' },
  signature: { marginHorizontal: 23, marginTop: 18, backgroundColor: '#E7E5DB', flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 4, gap: 12 },
  signatureText: { fontSize: 11, fontStyle: 'italic', color: '#555B65' },
  cvv: { fontFamily: 'monospace', fontWeight: '700', fontSize: 16, color: '#142033', flexShrink: 1 },
  backHint: { color: '#C4D0E2', fontSize: 9, marginHorizontal: 23, marginTop: 8 },
  backFooter: { marginHorizontal: 23, marginTop: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backFooterText: { fontSize: 7, color: '#C4D0E2', letterSpacing: 1.5, flex: 1 },
});
