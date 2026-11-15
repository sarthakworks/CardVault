import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { useHaptics } from '../../shared/hooks/useHaptics';
import { Dropdown, type DropdownPlacement } from '../../shared/components/Dropdown';
import type { CardMenuKind } from './CardFilters';
import type { CardFilter, CardFilterOption } from './cardSelectors';

export interface CardDropdownState extends DropdownPlacement {
  kind: CardMenuKind;
}

interface Option {
  key: string;
  label: string;
  selected: boolean;
  filter: CardFilter;
}

interface OptionSection {
  title: string;
  data: Option[];
}

const titles: Record<CardMenuKind, string> = {
  holder: 'Name on card', filters: 'Refine your collection', sort: 'Sort your cards',
};

export function CardFilterDropdown({ menu, options, filter, onChange, onClose }: {
  menu: CardDropdownState;
  options: { holders: CardFilterOption[]; banks: CardFilterOption[]; networks: CardFilterOption[] };
  filter: CardFilter;
  onChange: (value: CardFilter) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const haptic = useHaptics();
  const sections = useMemo<OptionSection[]>(() => {
    if (menu.kind === 'holder') {
      return [{
        title: '',
        data: [null, ...options.holders].map((holder) => ({
          key: `holder:${holder?.key ?? ''}`,
          label: holder?.label ?? 'All names',
          selected: filter.holder === (holder?.key ?? null),
          filter: { ...filter, holder: holder?.key ?? null },
        })),
      }];
    }
    if (menu.kind === 'sort') {
      return [{
        title: '',
        data: ([
          { value: 'newest', label: 'Recently added' },
          { value: 'bank', label: 'Bank name' },
          { value: 'expiry', label: 'Expiring soon' },
        ] as const).map(({ value, label }) => ({
          key: `sort:${value}`, label, selected: filter.sort === value, filter: { ...filter, sort: value },
        })),
      }];
    }
    return [
      {
        title: 'BANK',
        data: [null, ...options.banks].map((bank) => ({
          key: `bank:${bank?.key ?? ''}`,
          label: bank?.label ?? 'All banks', selected: filter.bank === (bank?.key ?? null), filter: { ...filter, bank: bank?.key ?? null },
        })),
      },
      {
        title: 'NETWORK',
        data: [null, ...options.networks].map((network) => ({
          key: `network:${network?.key ?? ''}`,
          label: network?.label ?? 'All networks', selected: filter.network === (network?.key ?? null), filter: { ...filter, network: network?.key ?? null },
        })),
      },
    ];
  }, [filter, menu.kind, options]);
  const rows = sections.reduce((total, section) => total + section.data.length, 0);
  const contentHeight = 56 + rows * 48 + (menu.kind === 'filters' ? 104 : 8);
  return (
    <Dropdown placement={menu} title={titles[menu.kind]} contentHeight={contentHeight} width={menu.kind === 'filters' ? 320 : 248} align={menu.kind === 'sort' ? 'right' : 'left'} onClose={onClose}>
        <SectionList
          sections={sections}
          keyExtractor={(option) => option.key}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          initialNumToRender={8}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => section.title
            ? <Text style={[styles.section, { color: colors.textSecondary }]}>{section.title}</Text>
            : null}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: item.selected }}
              accessibilityLabel={item.label}
              onPress={() => {
                haptic();
                onChange(item.filter);
                if (menu.kind !== 'filters') onClose();
              }}
              style={({ pressed }) => [styles.option, { backgroundColor: item.selected ? colors.accentMuted : pressed ? colors.surfaceMuted : 'transparent' }]}
            >
              <Text numberOfLines={2} style={[styles.optionText, { color: item.selected ? colors.accent : colors.textPrimary, fontWeight: item.selected ? '600' : '400' }]}>{item.label}</Text>
              {item.selected ? <Feather name="check" size={17} color={colors.accent} accessible={false} /> : null}
            </Pressable>
          )}
        />
        {menu.kind === 'filters' ? <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.done, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.doneText, { color: colors.accent }]}>Show cards</Text>
          <Feather name="arrow-right" size={15} color={colors.accent} accessible={false} />
        </Pressable> : null}
    </Dropdown>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { padding: 6 },
  section: { ...typography.eyebrow, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 },
  option: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionText: { ...typography.small, flex: 1, minWidth: 0 },
  done: { minHeight: 46, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doneText: { ...typography.label },
});
