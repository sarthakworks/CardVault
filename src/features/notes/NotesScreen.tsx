import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSessionStore } from '../../core/security/sessionStore';
import type { SecureNote } from '../../core/vault/models';
import { Screen } from '../../shared/components/Screen';
import { PageHeader } from '../../shared/components/PageHeader';
import { EmptyState } from '../../shared/components/EmptyState';
import { TextField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';
import { Chip } from '../../shared/components/Chip';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { selectNotes } from './noteSelectors';
import { NotePreview } from './NotePreview';
import { NoteEditorSheet } from './NoteEditorSheet';
import { NoteDetailSheet } from './NoteDetailSheet';

const emptyNotes: SecureNote[] = [];

export function NotesScreen() {
  const { colors } = useTheme();
  const notes = useSessionStore((state) => state.snapshot?.notes ?? emptyNotes);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SecureNote | null>(null);
  const selected = notes.find((note) => note.id === selectedId);
  const filtered = useMemo(() => selectNotes(notes, deferredQuery, category), [notes, deferredQuery, category]);
  const categories = [...new Set(notes.map((note) => note.category))].sort();
  return (
    <Screen>
      <FlatList
        data={filtered}
        numColumns={2}
        keyExtractor={(note) => `${note.id}:${category}:${deferredQuery}`}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 24 }}
        contentContainerStyle={{ paddingBottom: 28, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<View>
          <PageHeader title={'Some things\nare just for you.'} subtitle="Private thoughts. Quietly protected." />
          <View style={styles.collection}><Text style={[typography.eyebrow, { color: colors.textSecondary }]}>{notes.length} SECURE {notes.length === 1 ? 'NOTE' : 'NOTES'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Add a note" onPress={() => { setEditing(null); setEditorOpen(true); }} style={[styles.add, { backgroundColor: colors.textPrimary }]}><Feather name="plus" size={21} color={colors.background} /></Pressable></View>
          <View style={{ marginHorizontal: 24, marginBottom: 16 }}>
            <TextField placeholder="Search your private notes" value={query} onChangeText={setQuery} maxLength={120} style={{ paddingLeft: 42 }} accessibilityLabel="Search secure notes" />
            <Feather name="search" size={17} color={colors.textSecondary} style={{ position: 'absolute', left: 15, top: 18 }} />
          </View>
          {notes.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12, gap: 8 }}><Chip label="All notes" selected={category === null} onPress={() => setCategory(null)} />{categories.map((tag) => <Chip key={tag} label={tag} selected={category === tag} onPress={() => setCategory(tag)} />)}</ScrollView> : null}
        </View>}
        ListEmptyComponent={<View style={{ paddingHorizontal: 24 }}><EmptyState icon="file-text" title={notes.length ? 'No matching notes.' : 'A blank page. All yours.'} description={notes.length ? 'Try a different word or category.' : 'Wi-Fi passwords, little reminders, important details. Give them a private home.'} /><Button title={notes.length ? 'Clear search & filters' : 'Write your first note'} icon={notes.length ? 'search' : 'plus'} onPress={() => { if (notes.length) { setQuery(''); setCategory(null); } else setEditorOpen(true); }} /></View>}
        renderItem={({ item, index }) => <Animated.View entering={FadeInDown.delay(Math.min(index, 5) * 45).duration(280).reduceMotion(ReduceMotion.System)} style={{ flex: 1, maxWidth: '49%' }}><NotePreview note={item} onPress={() => setSelectedId(item.id)} /></Animated.View>}
      />
      {selected ? <NoteDetailSheet key={selected.id} note={selected} onClose={() => setSelectedId(null)} onEdit={() => { setEditing(selected); setSelectedId(null); setEditorOpen(true); }} /> : null}
      {editorOpen ? <NoteEditorSheet key={editing?.id ?? 'new'} note={editing} onClose={() => { setEditorOpen(false); setEditing(null); }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  collection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 24, marginBottom: 20 },
  add: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
});
