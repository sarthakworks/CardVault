import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSessionStore } from '../../core/security/sessionStore';
import type { VaultCard } from '../../core/vault/models';
import { Screen } from '../../shared/components/Screen';
import { PageHeader } from '../../shared/components/PageHeader';
import { EmptyState } from '../../shared/components/EmptyState';
import { Button } from '../../shared/components/Button';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { CardFace } from './CardFace';
import { CardFilters } from './CardFilters';
import { CardDetailSheet } from './CardDetailSheet';
import { CardEditorSheet } from './CardEditorSheet';
import { initialCardFilter, selectCards } from './cardSelectors';

const emptyCards: VaultCard[] = [];

export function CardsScreen() {
  const { colors } = useTheme();
  const cards = useSessionStore((state) => state.snapshot?.cards ?? emptyCards);
  const [filter, setFilter] = useState(initialCardFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<VaultCard | null>(null);
  const filtered = useMemo(() => selectCards(cards, filter), [cards, filter]);
  const selected = cards.find((card) => card.id === selectedId);
  const filterKey = `${filter.owner}:${filter.bank}:${filter.network}:${filter.sort}`;
  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(card) => `${card.id}:${filterKey}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        ListHeaderComponent={<View>
          <PageHeader title={'All your cards.\nOne quiet place.'} subtitle="Offline. Encrypted. Entirely yours." />
          <View style={styles.collection}>
            <View style={{ gap: 5 }}><Text style={[typography.eyebrow, { color: colors.textSecondary }]}>YOUR COLLECTION</Text><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{cards.length} {cards.length === 1 ? 'card' : 'cards'}, safely kept</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Add a card" onPress={() => { setEditing(null); setEditorOpen(true); }} style={[styles.add, { backgroundColor: colors.textPrimary }]}><Feather name="plus" size={21} color={colors.background} /></Pressable>
          </View>
          {cards.length ? <CardFilters cards={cards} filter={filter} onChange={setFilter} /> : null}
        </View>}
        ListEmptyComponent={<View style={{ paddingHorizontal: 24 }}>
          <EmptyState icon="credit-card" title={cards.length ? 'Nothing in this corner.' : 'Your first card belongs here.'} description={cards.length ? 'Try another bank, network, or owner.' : 'Keep the details you reach for, without carrying the worry.'} />
          <Button title={cards.length ? 'Clear filters' : 'Add your first card'} icon={cards.length ? 'filter' : 'plus'} onPress={() => { if (cards.length) setFilter(initialCardFilter); else setEditorOpen(true); }} />
        </View>}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 5) * 45).duration(280).reduceMotion(ReduceMotion.System)} style={styles.cardItem}>
            <CardFace card={item} onPress={() => setSelectedId(item.id)} />
            <View style={styles.cardCaption}><Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.network} / {item.owner}</Text><Text style={{ color: colors.textSecondary, fontSize: 11 }}>Tap to view details <Feather name="arrow-up-right" size={11} /></Text></View>
          </Animated.View>
        )}
        ListFooterComponent={cards.length ? <View style={styles.footer}><Feather name="lock" size={12} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontSize: 10 }}>No servers. No tracking. Just your vault.</Text></View> : undefined}
      />
      {selected ? <CardDetailSheet key={selected.id} card={selected} onClose={() => setSelectedId(null)} onEdit={() => { setEditing(selected); setSelectedId(null); setEditorOpen(true); }} /> : null}
      {editorOpen ? <CardEditorSheet key={editing?.id ?? 'new'} card={editing} onClose={() => { setEditorOpen(false); setEditing(null); }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  collection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 24, paddingTop: 8, paddingBottom: 22 },
  add: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  cardItem: { paddingHorizontal: 24, paddingBottom: 21, gap: 11 },
  cardCaption: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  footer: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingTop: 14 },
});
