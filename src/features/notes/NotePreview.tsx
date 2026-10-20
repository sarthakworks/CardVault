import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { SecureNote } from '../../core/vault/models';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { displayDate } from '../../shared/utils/formatters';

export function NotePreview({ note, onPress }: { note: SecureNote; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${note.title}, ${note.category}`} onPress={onPress} style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.top}><View style={[styles.icon, { backgroundColor: colors.accentMuted }]}><Feather name="file-text" size={18} color={colors.accent} /></View><Feather name="arrow-up-right" size={15} color={colors.textSecondary} /></View>
      <Text numberOfLines={2} style={[styles.title, { color: colors.textPrimary }]}>{note.title}</Text>
      <Text numberOfLines={3} style={[styles.preview, { color: colors.textSecondary }]}>{note.content}</Text>
      <View style={styles.footer}><Text numberOfLines={1} style={{ color: colors.accent, fontSize: 10, fontWeight: '600' }}>{note.category}</Text><Text style={{ color: colors.textSecondary, fontSize: 9 }}>{displayDate(note.updatedAt)}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  note: { flex: 1, minHeight: 218, borderWidth: 1, borderRadius: 21, padding: 17, gap: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, lineHeight: 21, fontWeight: '700', letterSpacing: -0.3 },
  preview: { fontSize: 12, lineHeight: 18, flex: 1 },
  footer: { gap: 5, paddingTop: 4 },
});
