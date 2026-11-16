import {Pressable, Share, StyleSheet, Text, View} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type {VaultCard} from '../../core/vault/models';
import {activeSession} from '../../core/security/sessionStore';
import {copySecret} from '../../core/security/clipboardGuard';
import {VaultError} from '../../core/errors/VaultError';
import {notify, reportError} from '../../core/errors/noticeStore';
import {useHaptics} from '../../shared/hooks/useHaptics';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {
  formatCardExpiry,
  formatCardNumber,
} from '../../shared/utils/formatters';
import {useCardRemoval} from './useCardRemoval';
import {cardDetailsForClipboard} from './cardPresentation';

export function CardActionTray({
  card,
  onEdit,
  onClose,
}: {
  card: VaultCard;
  onEdit: (value: VaultCard) => void;
  onClose: () => void;
}) {
  const {colors} = useTheme();
  const haptic = useHaptics();
  const removeCard = useCardRemoval();
  function currentCard(): VaultCard {
    const current = activeSession().snapshot.cards.find(
      (value) => value.id === card.id
    );
    if (!current)
      throw new VaultError('conflict', 'This card no longer exists.');
    return current;
  }
  async function copyDetails() {
    try {
      await copySecret(cardDetailsForClipboard(currentCard()));
      notify('Card details copied securely. Clears within 30 seconds.');
    } catch (error) {
      reportError(error);
    }
  }
  async function share() {
    try {
      const current = currentCard();
      await Share.share(
        {
          title: 'Card details',
          message: [
            `Bank: ${current.bank}`,
            ...(current.type ? [`Type: ${current.type}`] : []),
            `Network: ${current.network}`,
            ...(current.tier ? [`Network tier: ${current.tier}`] : []),
            ...(current.country ? [`Country: ${current.country}`] : []),
            `Cardholder: ${current.holder}`,
            `Card number: ${formatCardNumber(current.number)}`,
            `Valid thru: ${formatCardExpiry(current.expiry)}`,
            `CVV / Security code: ${current.cvv}`,
          ].join('\n'),
        },
        {dialogTitle: 'Share card details'}
      );
    } catch (error) {
      reportError(error);
    }
  }
  function confirmRemoval() {
    try {
      removeCard(currentCard());
    } catch (error) {
      reportError(error);
    }
  }
  const actions = [
    {
      title: 'Edit',
      label: 'Edit card',
      icon: 'edit-2',
      run: () => {
        try {
          onEdit(currentCard());
        } catch (error) {
          reportError(error);
        }
      },
      danger: false,
    },
    {
      title: 'Copy details',
      label: 'Copy card details',
      icon: 'copy',
      run: () => void copyDetails(),
      danger: false,
    },
    {
      title: 'Share',
      label: 'Share card details',
      icon: 'share-2',
      run: () => void share(),
      danger: false,
    },
    {
      title: 'Delete',
      label: 'Delete card',
      icon: 'trash-2',
      run: confirmRemoval,
      danger: true,
    },
  ] as const;
  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.title}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => {
            haptic();
            onClose();
            action.run();
          }}
          style={({pressed}) => [
            styles.tile,
            {
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderColor: colors.border,
              transform: [{scale: pressed ? 0.96 : 1}],
            },
          ]}>
          <View
            style={[
              styles.icon,
              {
                backgroundColor: action.danger
                  ? colors.dangerMuted
                  : colors.accentMuted,
              },
            ]}>
            <Feather
              name={action.icon}
              size={18}
              color={action.danger ? colors.danger : colors.accent}
              accessible={false}
            />
          </View>
          <Text
            style={[
              styles.label,
              {color: action.danger ? colors.danger : colors.textPrimary},
            ]}>
            {action.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'stretch',
    gap: 10,
  },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.label,
    fontSize: 13,
    maxWidth: '100%',
    textAlign: 'center',
  },
});
