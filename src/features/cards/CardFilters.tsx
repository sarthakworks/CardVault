import { useRef, type ComponentProps, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../../shared/theme/ThemeProvider';
import type { CardFilter } from './cardSelectors';

export type CardMenuKind = 'holder' | 'filters' | 'sort';

export interface CardFiltersProps {
  filter: CardFilter;
  holderLabel: string | null;
  openMenu: CardMenuKind | null;
  onOpen: (kind: CardMenuKind, anchor: ComponentRef<typeof View>) => void;
}

const sortLabels: Record<CardFilter['sort'], string> = {
  newest: 'Newest', bank: 'Bank name', expiry: 'Expiring',
};

function FilterControl({ kind, label, icon, active, count, accessibilityLabel, compact, openMenu, onOpen }: {
  kind: CardMenuKind;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  active: boolean;
  count?: number;
  accessibilityLabel: string;
  compact: boolean;
} & Pick<CardFiltersProps, 'openMenu' | 'onOpen'>) {
  const { colors } = useTheme();
  const reference = useRef<ComponentRef<typeof View>>(null);
  const expanded = openMenu === kind;
  return (
    <Pressable
      ref={reference}
      collapsable={false}
      accessibilityRole={kind === 'filters' ? 'button' : 'combobox'}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: label }}
      accessibilityState={{ expanded }}
      onPress={() => { if (reference.current) onOpen(kind, reference.current); }}
      style={({ pressed }) => [
        styles.control,
        { backgroundColor: active || expanded ? colors.accentMuted : colors.surface, borderColor: expanded ? colors.accent : colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {!compact ? <Feather name={icon} size={16} color={active || expanded ? colors.accent : colors.textSecondary} accessible={false} /> : null}
      <Text numberOfLines={2} style={[styles.label, { color: active || expanded ? colors.accent : colors.textPrimary }]}>{label}</Text>
      {count ? <View style={[styles.count, { backgroundColor: colors.accent }]}><Text style={[styles.countText, { color: colors.onAccent }]}>{count}</Text></View>
        : <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} accessible={false} />}
    </Pressable>
  );
}

export function CardFilters({ filter, holderLabel, openMenu, onOpen }: CardFiltersProps) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 400 || fontScale > 1.2;
  const activeFilters = Number(filter.bank !== null) + Number(filter.network !== null);
  return (
    <View style={styles.toolbar}>
      <FilterControl kind="holder" label={holderLabel ?? 'All names'} icon="user" accessibilityLabel="Filter by name on card" active={filter.holder !== null} compact={compact} openMenu={openMenu} onOpen={onOpen} />
      <FilterControl kind="filters" label="Filters" icon="filter" accessibilityLabel="Filter by bank and network" active={activeFilters > 0} count={activeFilters} compact={compact} openMenu={openMenu} onOpen={onOpen} />
      <FilterControl kind="sort" label={sortLabels[filter.sort]} icon="arrow-down" accessibilityLabel="Sort cards" active={filter.sort !== 'newest'} compact={compact} openMenu={openMenu} onOpen={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: 8 },
  control: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 8, paddingVertical: 11, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '600' },
  count: { minWidth: 17, minHeight: 17, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 9, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
