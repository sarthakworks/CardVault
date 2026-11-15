import { useMemo } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import type { VaultCard } from '../../core/vault/models';
import { copySecret } from '../../core/security/clipboardGuard';
import { notify, reportError } from '../../core/errors/noticeStore';
import { formatCardExpiry } from '../../shared/utils/formatters';
import { typography } from '../../shared/theme/typography';
import { CardNetworkLogo } from './CardNetworkLogo';
import { bankGradient } from './bankThemes';


export type CardActionDirection = -1 | 1;

interface Props {
  card: VaultCard;
  onActions: (direction: CardActionDirection) => void;
}

function createCardSwipeResponder(onActions: (direction: CardActionDirection) => void) {
  let cancelled = false;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, { dx, dy, numberActiveTouches }) => numberActiveTouches === 1
      && Math.abs(dx) >= 24 && Math.abs(dy) <= 18 && Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderGrant: () => { cancelled = false; },
    onPanResponderStart: (_, { numberActiveTouches }) => { if (numberActiveTouches > 1) cancelled = true; },
    onPanResponderMove: (_, { numberActiveTouches }) => { if (numberActiveTouches > 1) cancelled = true; },
    onPanResponderRelease: (_, { dx, dy }) => {
      if (!cancelled && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5) onActions(dx < 0 ? -1 : 1);
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => { cancelled = true; },
  });
}

export function CardFace({ card, onActions }: Props) {
  const colors = bankGradient(card.bank);
  const { fontScale } = useWindowDimensions();
  const swipe = useMemo(() => createCardSwipeResponder(onActions), [onActions]);
  async function copyNumber() {
    try {
      await copySecret(card.number);
      notify('Card number copied securely. Clears within 30 seconds.');
    } catch (error) { reportError(error); }
  }
  return (
    <View
      collapsable={false}
      {...swipe.panHandlers}
      accessible={false}
      accessibilityLabel={`${card.bank} ${card.network} card ending ${card.number.slice(-4)}${card.tier?.trim() ? `, ${card.tier.trim()}` : ''}`}
      style={[styles.container, { backgroundColor: colors[1], minHeight: 218 * Math.max(1, fontScale) }]}
    >
      <Pressable accessible={false} onLongPress={() => onActions(-1)} delayLongPress={450} style={styles.touchTarget}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          <View style={styles.top}>
            <Text numberOfLines={1} style={styles.bank}>{card.bank}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`More actions for ${card.bank} card ending ${card.number.slice(-4)}`}
              hitSlop={6}
              onPress={() => onActions(-1)}
              style={({ pressed }) => [styles.more, { backgroundColor: pressed ? '#FFFFFF30' : '#FFFFFF12' }]}
            >
              <Feather name="more-horizontal" size={18} color="#F5F7FD" accessible={false} />
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <View style={styles.chip}><View style={styles.chipVertical} /><View style={styles.chipHorizontal} /><View style={[styles.chipHorizontal, { top: 21 }]} /></View>
            <Feather name="wifi" color="#D6E0EDB3" size={22} style={{ transform: [{ rotate: '90deg' }] }} />
          </View>
          <View style={styles.numberRow}>
            <Text accessibilityLabel={`Card number ending ${card.number.slice(-4)}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[typography.number, styles.pan]}>{`\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  ${card.number.slice(-4)}`}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copy ${card.bank} card number ending ${card.number.slice(-4)}`}
              onPress={() => void copyNumber()}
              style={({ pressed }) => [styles.copy, { backgroundColor: pressed ? '#FFFFFF30' : '#FFFFFF12' }]}
            >
              <Feather name="copy" size={17} color="#F5F7FD" accessible={false} />
            </Pressable>
          </View>
          <View style={styles.bottom}>
            <View style={styles.holderBlock}><Text style={styles.micro}>CARDHOLDER</Text><Text numberOfLines={1} style={styles.holder}>{card.holder.toUpperCase()}</Text></View>
            <View style={styles.expiryBlock}><Text style={styles.micro}>VALID THRU</Text><Text numberOfLines={1} style={styles.holder}>{formatCardExpiry(card.expiry)}</Text></View>
            <View style={styles.networkBlock}>
              <CardNetworkLogo network={card.network} variant="card" />
              {card.tier?.trim() ? <Text numberOfLines={1} style={styles.tier}>{card.tier.trim().toUpperCase()}</Text> : null}
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', borderRadius: 20, overflow: 'hidden', elevation: 3 },
  touchTarget: { flex: 1 },
  gradient: { flex: 1, padding: 22, justifyContent: 'space-between', borderWidth: 1, borderColor: '#FFFFFF20', borderRadius: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  bank: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.4, flex: 1 },
  chipRow: { flexDirection: 'row', gap: 13, alignItems: 'center' },
  chip: { width: 40, height: 31, borderRadius: 7, backgroundColor: '#D1BD89', borderWidth: 1, borderColor: '#F6E4B4', overflow: 'hidden' },
  chipVertical: { position: 'absolute', height: 31, width: 15, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#93825C', left: 12 },
  chipHorizontal: { position: 'absolute', width: 40, borderTopWidth: 1, borderColor: '#93825C', top: 9 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pan: { flex: 1, minWidth: 0, color: '#F5F7FD', fontSize: 16, letterSpacing: 1.1 },
  more: { width: 36, height: 36, marginTop: -8, marginRight: -8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF16' },
  copy: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF16' },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 15 },
  holderBlock: { flex: 1, gap: 5 },
  expiryBlock: { gap: 5, maxWidth: 70 },
  micro: { color: '#D5DFEC', fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },
  networkBlock: { alignItems: 'flex-end', gap: 3, maxWidth: 96 },
  tier: { color: '#D5DFEC', fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },
  holder: { color: '#F4F7FC', fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
});
