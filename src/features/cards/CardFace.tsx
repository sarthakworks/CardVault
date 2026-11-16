import {useMemo} from 'react';
import {PanResponder, Pressable, StyleSheet, Text, View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import type {CardInput} from '../../core/vault/models';
import {copySecret} from '../../core/security/clipboardGuard';
import {notify, reportError} from '../../core/errors/noticeStore';
import {
  formatCardExpiry,
  formatCardNumber,
} from '../../shared/utils/formatters';
import {typography} from '../../shared/theme/typography';
import {CardNetworkLogo} from './CardNetworkLogo';
import {bankGradient, bankWatermark} from './bankThemes';
import {cardDescriptor} from './cardPresentation';

export type CardActionDirection = -1 | 1;

interface Props {
  card: CardInput;
  onActions?: (direction: CardActionDirection) => void;
  reserveActionSpace?: boolean;
}

function createCardSwipeResponder(
  onActions: (direction: CardActionDirection) => void
) {
  let cancelled = false;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, {dx, dy, numberActiveTouches}) =>
      numberActiveTouches === 1 &&
      Math.abs(dx) >= 24 &&
      Math.abs(dy) <= 18 &&
      Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderGrant: () => {
      cancelled = false;
    },
    onPanResponderStart: (_, {numberActiveTouches}) => {
      if (numberActiveTouches > 1) cancelled = true;
    },
    onPanResponderMove: (_, {numberActiveTouches}) => {
      if (numberActiveTouches > 1) cancelled = true;
    },
    onPanResponderRelease: (_, {dx, dy}) => {
      if (!cancelled && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5)
        onActions(dx < 0 ? -1 : 1);
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => {
      cancelled = true;
    },
  });
}

export function CardFace({card, onActions, reserveActionSpace = false}: Props) {
  const colors = bankGradient(card.bank);
  const descriptor = cardDescriptor(card);
  const swipe = useMemo(
    () => (onActions ? createCardSwipeResponder(onActions) : undefined),
    [onActions]
  );
  async function copyNumber() {
    try {
      await copySecret(card.number);
      notify('Card number copied securely. Clears within 30 seconds.');
    } catch (error) {
      reportError(error);
    }
  }
  const moreIcon = (
    <Feather
      name="more-horizontal"
      size={18}
      color="#F5F7FD"
      accessible={false}
    />
  );
  const copyIcon = (
    <Feather name="copy" size={17} color="#F5F7FD" accessible={false} />
  );
  const artwork = (
    <LinearGradient
      colors={colors}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.gradient}>
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.watermarkLayer}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.2}
          style={styles.watermark}>
          {bankWatermark(card.bank)}
        </Text>
      </View>
      <View
        style={[
          styles.top,
          !onActions && reserveActionSpace && styles.previewActionSpace,
        ]}>
        <View style={styles.bankBlock}>
          <Text numberOfLines={2} style={styles.bank}>
            {card.bank}
          </Text>
          {descriptor ? (
            <Text style={styles.descriptor}>{descriptor.toUpperCase()}</Text>
          ) : null}
        </View>
        {onActions ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${card.bank} card ending ${card.number.slice(-4)}`}
            hitSlop={6}
            onPress={() => onActions(-1)}
            style={({pressed}) => [
              styles.more,
              {backgroundColor: pressed ? '#FFFFFF30' : '#FFFFFF12'},
            ]}>
            {moreIcon}
          </Pressable>
        ) : null}
      </View>
      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <View style={styles.chipVertical} />
          <View style={styles.chipHorizontal} />
          <View style={[styles.chipHorizontal, {top: 17}]} />
        </View>
        <Feather
          name="wifi"
          color="#D6E0EDB3"
          size={22}
          style={{transform: [{rotate: '90deg'}]}}
        />
        <Text numberOfLines={2} style={[styles.holder, styles.name]}>
          {card.holder.toUpperCase()}
        </Text>
      </View>
      <View style={styles.numberRow}>
        <Text
          accessibilityLabel={
            onActions
              ? `Card number ending ${card.number.slice(-4)}`
              : 'Card number preview'
          }
          style={[typography.number, styles.pan]}>
          {formatCardNumber(card.number)}
        </Text>
        {onActions ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copy ${card.bank} card number ending ${card.number.slice(-4)}`}
            onPress={() => void copyNumber()}
            style={({pressed}) => [
              styles.copy,
              {backgroundColor: pressed ? '#FFFFFF30' : '#FFFFFF12'},
            ]}>
            {copyIcon}
          </Pressable>
        ) : null}
      </View>
      <View style={styles.bottom}>
        <View style={styles.expiryBlock}>
          <Text style={styles.micro}>VALID THRU</Text>
          <Text numberOfLines={1} style={styles.holder}>
            {formatCardExpiry(card.expiry)}
          </Text>
        </View>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.cvvBlock}>
          <Text style={styles.micro}>CVV</Text>
          <Text accessible={false} style={styles.holder}>
            {card.cvv}
          </Text>
        </View>
        <View style={styles.networkBlock}>
          <CardNetworkLogo network={card.network} variant="card" />
          {card.tier?.trim() ? (
            <Text numberOfLines={1} style={styles.tier}>
              {card.tier.trim().toUpperCase()}
            </Text>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
  return (
    <View
      collapsable={false}
      {...swipe?.panHandlers}
      pointerEvents={onActions ? undefined : 'none'}
      accessible={false}
      accessibilityLabel={
        onActions
          ? `${card.bank} ${card.network} card ending ${card.number.slice(-4)}${card.tier?.trim() ? `, ${card.tier.trim()}` : ''}`
          : 'Card preview'
      }
      style={[styles.container, {backgroundColor: colors[1]}]}>
      {onActions ? (
        <Pressable
          accessible={false}
          onLongPress={() => onActions(-1)}
          delayLongPress={450}>
          {artwork}
        </Pressable>
      ) : (
        artwork
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 3,
  },
  gradient: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#FFFFFF20',
    borderRadius: 20,
    gap: 6,
  },
  watermarkLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
  },
  watermark: {
    color: '#FFFFFF',
    opacity: 0.06,
    fontSize: 104,
    fontWeight: '900',
    letterSpacing: -4,
    textAlign: 'right',
    transform: [{rotate: '-22deg'}],
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  previewActionSpace: {paddingRight: 44, minHeight: 36},
  bankBlock: {flex: 1, minWidth: 0, gap: 4},
  bank: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  descriptor: {
    color: '#D5DFEC',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  chipRow: {flexDirection: 'row', gap: 12, alignItems: 'center'},
  name: {flex: 1, minWidth: 0, textAlign: 'right'},
  chip: {
    width: 34,
    height: 25,
    borderRadius: 6,
    backgroundColor: '#D1BD89',
    borderWidth: 1,
    borderColor: '#F6E4B4',
    overflow: 'hidden',
  },
  chipVertical: {
    position: 'absolute',
    height: 25,
    width: 12,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#93825C',
    left: 10,
  },
  chipHorizontal: {
    position: 'absolute',
    width: 34,
    borderTopWidth: 1,
    borderColor: '#93825C',
    top: 8,
  },
  numberRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  pan: {
    flex: 1,
    minWidth: 0,
    color: '#F5F7FD',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.6,
  },
  more: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF16',
  },
  copy: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF16',
  },
  bottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: 18,
    rowGap: 12,
  },
  expiryBlock: {gap: 5, maxWidth: '100%'},
  cvvBlock: {gap: 5, maxWidth: '100%'},
  micro: {
    color: '#D5DFEC',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  networkBlock: {
    alignItems: 'flex-end',
    gap: 3,
    maxWidth: 96,
    marginLeft: 'auto',
  },
  tier: {color: '#D5DFEC', fontSize: 9, fontWeight: '600', letterSpacing: 0.8},
  holder: {
    color: '#F4F7FC',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
