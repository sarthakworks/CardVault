import { useCallback, useDeferredValue, useMemo, useRef, useState, type ComponentRef } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Feather from '@expo/vector-icons/Feather';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSessionStore } from '../../core/security/sessionStore';
import type { SecureNote } from '../../core/vault/models';
import { vaultService } from '../../core/vault/vaultService';
import { notify } from '../../core/errors/noticeStore';
import { Screen } from '../../shared/components/Screen';
import { TextField } from '../../shared/components/TextField';
import type { DropdownPlacement } from '../../shared/components/Dropdown';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { useHaptics } from '../../shared/hooks/useHaptics';
import { selectNotes } from './noteSelectors';
import { NotePreview } from './NotePreview';
import { NoteActionMenu } from './NoteActionMenu';
import { useNoteRemoval } from './noteActions';

const emptyNotes: SecureNote[] = [];

export function NotesScreen({ onOpenNote }: { onOpenNote: (note: SecureNote | null) => void }) {
  const { colors } = useTheme();
  const haptic = useHaptics();
  const confirmRemoval = useNoteRemoval();
  const notes = useSessionStore((state) => state.snapshot?.notes ?? emptyNotes);
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [menu, setMenu] = useState<{ noteId: string; placement: DropdownPlacement } | null>(null);
  const viewport = useRef<ComponentRef<typeof View>>(null);
  const menuRequest = useRef(0);
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => selectNotes(notes, deferredQuery), [notes, deferredQuery]);
  const selected = menu ? notes.find((note) => note.id === menu.noteId) : undefined;
  const menuVisible = menu !== null && selected !== undefined;
  const closeMenu = useCallback(() => { menuRequest.current++; setMenu(null); }, []);
  useFocusEffect(useCallback(() => closeMenu, [closeMenu]));
  function openNote(note: SecureNote | null) {
    Keyboard.dismiss();
    closeMenu();
    if (!note) setQuery('');
    onOpenNote(note);
  }
  function openOptions(note: SecureNote, anchor: ComponentRef<typeof View>) {
    haptic();
    const request = ++menuRequest.current;
    anchor.measureInWindow((x, y, width, height) => {
      viewport.current?.measureInWindow((screenX, screenY, screenWidth, screenHeight) => {
        if (menuRequest.current !== request || width <= 0 || screenWidth <= 0 || screenHeight <= 0) return;
        setMenu({ noteId: note.id, placement: { anchor: { x: x - screenX, y: y - screenY, width, height }, viewport: { width: screenWidth, height: screenHeight } } });
      });
    });
  }
  return (
    <Screen>
      <View ref={viewport} collapsable={false} style={styles.viewport} onLayout={closeMenu}>
        <View style={styles.viewport} accessibilityElementsHidden={menuVisible} importantForAccessibility={menuVisible ? 'no-hide-descendants' : 'auto'}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.heading}><Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Notes</Text><Text style={[styles.total, { color: colors.textSecondary }]}>{notes.length.toLocaleString()}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={layout === 'grid' ? 'Switch to list view' : 'Switch to grid view'} onPress={() => { haptic(); setLayout(layout === 'grid' ? 'list' : 'grid'); }} style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' }]}>
                <Feather name={layout === 'grid' ? 'list' : 'grid'} size={21} color={colors.textSecondary} accessible={false} />
              </Pressable>
            </View>
            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="search" size={18} color={colors.textSecondary} accessible={false} />
              <TextField variant="plain" containerStyle={styles.searchInput} placeholder="Search notes" accessibilityLabel="Search notes" value={query} onChangeText={setQuery} maxLength={120} style={styles.searchText} />
              {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear note search" onPress={() => setQuery('')} style={styles.iconButton}><Feather name="x" size={17} color={colors.textSecondary} accessible={false} /></Pressable> : null}
            </View>
            {deferredQuery.trim() ? <Text accessibilityLiveRegion="polite" style={[styles.results, { color: colors.textSecondary }]}>{filtered.length.toLocaleString()} {filtered.length === 1 ? 'note found' : 'notes found'}</Text> : null}
          </View>
          <FlatList
            key={layout}
            data={filtered}
            numColumns={layout === 'grid' ? 2 : 1}
            keyExtractor={(note) => note.id}
            columnWrapperStyle={layout === 'grid' ? styles.columns : undefined}
            contentContainerStyle={styles.collection}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={closeMenu}
            ListEmptyComponent={<View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.accentMuted }]}><Feather name={query.trim() ? 'search' : 'edit-3'} size={33} color={colors.accent} accessible={false} /></View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{query.trim() ? 'No notes found' : 'A little room for your thoughts.'}</Text>
              <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>{query.trim() ? 'Try another word from the title or note.' : 'Ideas, reminders, the things worth keeping.\nStart with a title, a note, or both.'}</Text>
            </View>}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 5) * 35).duration(230).reduceMotion(ReduceMotion.System)} style={layout === 'grid' ? styles.gridItem : styles.listItem}>
                <NotePreview note={item} layout={layout} onPress={() => openNote(item)} onOptions={(anchor) => openOptions(item, anchor)} />
              </Animated.View>
            )}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="New note" onPress={() => openNote(null)} style={({ pressed }) => [styles.compose, { backgroundColor: colors.accent, shadowColor: colors.textPrimary, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
            <Feather name="edit-3" size={21} color={colors.onAccent} accessible={false} /><Text style={[styles.composeLabel, { color: colors.onAccent }]}>New note</Text>
          </Pressable>
        </View>
        {menuVisible && menu && selected ? <NoteActionMenu note={selected} placement={menu.placement} onClose={closeMenu} onEdit={() => openNote(selected)} onDelete={() => confirmRemoval(selected, async () => { await vaultService.deleteNote(selected.id); notify('Note deleted.'); })} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { ...typography.hero },
  total: { ...typography.small, fontVariant: ['tabular-nums'] },
  iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingLeft: 16, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 11 },
  searchInput: { flex: 1, minWidth: 0 },
  searchText: { minHeight: 48, fontSize: 16 },
  results: { ...typography.caption },
  collection: { paddingHorizontal: 24, paddingBottom: 112, gap: 12, flexGrow: 1 },
  columns: { gap: 12 },
  gridItem: { flex: 1, maxWidth: '48.5%' },
  listItem: { width: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 50, gap: 17 },
  emptyIcon: { width: 78, height: 78, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { ...typography.heading, textAlign: 'center' },
  emptyDescription: { ...typography.small, textAlign: 'center' },
  compose: { position: 'absolute', right: 24, bottom: 24, minHeight: 52, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', gap: 10, alignItems: 'center', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  composeLabel: { ...typography.button },
});
