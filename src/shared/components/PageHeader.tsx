import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';
import { lockSession } from '../../core/security/sessionLifecycle';

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <View style={[styles.brandIcon, { backgroundColor: colors.textPrimary }]}><Feather name="shield" size={16} color={colors.background} /></View>
          <Text style={[typography.eyebrow, { color: colors.textPrimary }]}>CARDVAULT</Text>
        </View>
        <Pressable onPress={lockSession} accessibilityRole="button" accessibilityLabel="Lock vault" style={[styles.lock, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Feather name="lock" size={17} color={colors.textSecondary} />
        </Pressable>
      </View>
      <Text style={[typography.hero, { color: colors.textPrimary }]}>{title}</Text>
      <View style={styles.subtitleRow}>
        <View style={[styles.dot, { backgroundColor: colors.success }]} />
        <Text style={[typography.small, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 24, paddingBottom: 20, gap: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  brand: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  brandIcon: { height: 30, width: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  lock: { height: 42, width: 42, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  subtitleRow: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  dot: { height: 5, width: 5, borderRadius: 3 },
});
