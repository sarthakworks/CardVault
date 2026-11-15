import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

export function EmptyState({ icon, title, description }: { icon: ComponentProps<typeof Feather>['name']; title: string; description: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.halo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.accentMuted }]}><Feather name={icon} size={28} color={colors.accent} /></View>
      </View>
      <Text style={[typography.heading, { color: colors.textPrimary, textAlign: 'center' }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 40, gap: 12 },
  halo: { width: 88, height: 88, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  icon: { height: 64, width: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
