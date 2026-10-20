import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { VaultCard } from '../../core/vault/models';
import { networks } from '../../core/validation/cardRules';
import { Chip } from '../../shared/components/Chip';
import { Sheet } from '../../shared/components/Sheet';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import type { CardFilter } from './cardSelectors';

export function CardFilters({ cards, filter, onChange }: { cards: VaultCard[]; filter: CardFilter; onChange: (filter: CardFilter) => void }) {
  const { colors } = useTheme();
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const banks = [...new Set(cards.map((card) => card.bank))].sort();
  const owners = [...new Set(['Myself', 'Spouse', 'Parent', ...cards.map((card) => card.owner)])];
  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Filter by owner" onPress={() => setOwnerOpen(true)} style={[styles.owner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="users" size={15} color={colors.textSecondary} /><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{filter.owner ?? 'All owners'}</Text><Feather name="chevron-down" size={14} color={colors.textSecondary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Sort cards" onPress={() => setSortOpen(true)} style={styles.sort}>
          <Feather name="sliders" size={15} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontSize: 12 }}>Sort</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All banks" selected={filter.bank === null} onPress={() => onChange({ ...filter, bank: null })} />
        {banks.map((bank) => <Chip key={bank} label={bank} selected={filter.bank === bank} onPress={() => onChange({ ...filter, bank })} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All networks" selected={filter.network === null} onPress={() => onChange({ ...filter, network: null })} />
        {networks.map((network) => <Chip key={network} label={network} selected={filter.network === network} onPress={() => onChange({ ...filter, network })} />)}
      </ScrollView>
      <Sheet visible={ownerOpen} onClose={() => setOwnerOpen(false)} title="Whose cards?" subtitle="A place for everyone you keep close.">
        <View style={styles.options}>
          <Chip label="All owners" selected={!filter.owner} onPress={() => { onChange({ ...filter, owner: null }); setOwnerOpen(false); }} />
          {owners.map((owner) => <Chip key={owner} label={owner} selected={filter.owner === owner} onPress={() => { onChange({ ...filter, owner }); setOwnerOpen(false); }} />)}
        </View>
      </Sheet>
      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="A little order.">
        {([{ value: 'newest', label: 'Recently added' }, { value: 'bank', label: 'Bank name' }, { value: 'expiry', label: 'Expiring soon' }] as const).map((option) => (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: filter.sort === option.value }} onPress={() => { onChange({ ...filter, sort: option.value }); setSortOpen(false); }} style={[styles.sortOption, { borderColor: colors.border }]}>
            <Text style={[typography.body, { color: colors.textPrimary }]}>{option.label}</Text>
            <Feather name={filter.sort === option.value ? 'check-circle' : 'circle'} size={20} color={filter.sort === option.value ? colors.accent : colors.border} />
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 22 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 24, alignItems: 'center', marginBottom: 2 },
  owner: { flexDirection: 'row', gap: 9, alignItems: 'center', minHeight: 42, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1 },
  sort: { minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  chips: { gap: 8, paddingHorizontal: 24 },
  options: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1 },
});
