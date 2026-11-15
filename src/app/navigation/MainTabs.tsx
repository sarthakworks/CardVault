import { useCallback, useState, type ComponentProps } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardsScreen } from '../../features/cards/CardsScreen';
import { NotesScreen } from '../../features/notes/NotesScreen';
import { NoteEditor } from '../../features/notes/NoteEditor';
import { CardEditor } from '../../features/cards/CardEditor';
import type { SecureNote, VaultCard } from '../../core/vault/models';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { ConfirmationProvider } from '../../shared/components/ConfirmationProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';
import type { MainTabParamList } from './navigationTypes';

const Tab = createBottomTabNavigator<MainTabParamList>();
const icons: Record<keyof MainTabParamList, ComponentProps<typeof Feather>['name']> = {
  Cards: 'credit-card', Notes: 'file-text', Settings: 'sliders',
};

export function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [noteEditor, setNoteEditor] = useState<{ note: SecureNote | null } | null>(null);
  const [cardEditor, setCardEditor] = useState<{ card: VaultCard | null } | null>(null);
  const openCard = useCallback((card: VaultCard | null) => setCardEditor({ card }), []);
  const closeCard = useCallback(() => setCardEditor(null), []);
  const openNote = useCallback((note: SecureNote | null) => setNoteEditor({ note }), []);
  const closeNote = useCallback(() => setNoteEditor(null), []);
  const editorOpen = noteEditor !== null || cardEditor !== null;
  return (
    <ConfirmationProvider><BottomSheetModalProvider>
      <View style={styles.container}>
        <View style={styles.container} pointerEvents={editorOpen ? 'none' : 'auto'} accessibilityElementsHidden={editorOpen} importantForAccessibility={editorOpen ? 'no-hide-descendants' : 'auto'}>
          <Tab.Navigator screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: { height: 70 + insets.bottom + Math.max(0, Math.ceil(12 * (fontScale - 1))), paddingTop: 9, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: colors.surface, borderTopColor: colors.border, elevation: 0 },
            tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
            tabBarIcon: ({ color }) => <Feather name={icons[route.name]} color={color} size={22} />,
            sceneStyle: { backgroundColor: colors.background },
          })}>
            <Tab.Screen name="Cards">{() => <CardsScreen onOpenCard={openCard} />}</Tab.Screen>
            <Tab.Screen name="Notes">{() => <NotesScreen onOpenNote={openNote} />}</Tab.Screen>
            <Tab.Screen name="Settings" component={SettingsScreen} />
          </Tab.Navigator>
        </View>
        {cardEditor ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} accessibilityViewIsModal><CardEditor key={cardEditor.card?.id ?? 'new'} card={cardEditor.card} onClose={closeCard} /></View> : null}
        {noteEditor ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} accessibilityViewIsModal><NoteEditor key={noteEditor.note?.id ?? 'new'} note={noteEditor.note} onClose={closeNote} /></View> : null}
      </View>
    </BottomSheetModalProvider></ConfirmationProvider>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
