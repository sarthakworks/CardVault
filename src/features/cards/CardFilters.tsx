import {useRef, type ComponentProps, type ComponentRef} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import {useTheme} from '../../shared/theme/ThemeProvider';
import type {CardFilter} from './cardSelectors';

export type CardMenuKind = 'holder' | 'bank';

export interface CardFiltersProps {
  filter: CardFilter;
  holderLabel: string | null;
  bankLabel: string | null;
  openMenu: CardMenuKind | null;
  onOpen: (kind: CardMenuKind, anchor: ComponentRef<typeof View>) => void;
}

function FilterControl({
  kind,
  label,
  icon,
  active,
  accessibilityLabel,
  compact,
  openMenu,
  onOpen,
}: {
  kind: CardMenuKind;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  active: boolean;
  accessibilityLabel: string;
  compact: boolean;
} & Pick<CardFiltersProps, 'openMenu' | 'onOpen'>) {
  const {colors} = useTheme();
  const reference = useRef<ComponentRef<typeof View>>(null);
  const expanded = openMenu === kind;
  return (
    <Pressable
      ref={reference}
      collapsable={false}
      accessibilityRole="combobox"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{text: label}}
      accessibilityState={{expanded}}
      onPress={() => {
        if (reference.current) onOpen(kind, reference.current);
      }}
      style={({pressed}) => [
        styles.control,
        {
          backgroundColor:
            active || expanded ? colors.accentMuted : colors.surface,
          borderColor: expanded ? colors.accent : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {!compact ? (
        <Feather
          name={icon}
          size={16}
          color={active || expanded ? colors.accent : colors.textSecondary}
          accessible={false}
        />
      ) : null}
      <Text
        numberOfLines={2}
        style={[
          styles.label,
          {color: active || expanded ? colors.accent : colors.textPrimary},
        ]}>
        {label}
      </Text>
      <Feather
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={14}
        color={colors.textSecondary}
        accessible={false}
      />
    </Pressable>
  );
}

export function CardFilters({
  filter,
  holderLabel,
  bankLabel,
  openMenu,
  onOpen,
}: CardFiltersProps) {
  const {width, fontScale} = useWindowDimensions();
  const compact = width < 400 || fontScale > 1.2;
  return (
    <View style={styles.toolbar}>
      <FilterControl
        kind="holder"
        label={holderLabel ?? 'All names'}
        icon="user"
        accessibilityLabel="Filter by name on card"
        active={filter.holder !== null}
        compact={compact}
        openMenu={openMenu}
        onOpen={onOpen}
      />
      <FilterControl
        kind="bank"
        label={bankLabel ?? 'All banks'}
        icon="filter"
        accessibilityLabel="Filter by bank"
        active={filter.bank !== null}
        compact={compact}
        openMenu={openMenu}
        onOpen={onOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {flexDirection: 'row', gap: 8},
  control: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {flex: 1, minWidth: 0, fontSize: 12, fontWeight: '600'},
});
