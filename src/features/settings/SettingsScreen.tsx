import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../shared/components/Screen';
import { BrandMark } from '../../shared/components/BrandMark';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { ThemeSetting } from './ThemeSetting';
import { BiometricSetting } from './BiometricSetting';
import { BackupActions } from '../backup/BackupActions';

export function SettingsScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brand}><BrandMark size={32} /><Text style={[styles.kicker, { color: colors.textPrimary }]}>CARDVAULT</Text></View>
          <Text accessibilityRole="header" style={[typography.hero, { color: colors.textPrimary }]}>Settings</Text>
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPEARANCE</Text>
          <ThemeSetting />
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>SECURITY</Text>
          <BiometricSetting />
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>BACKUPS</Text>
          <BackupActions />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 40, gap: 28 },
  header: { gap: 16, paddingTop: 8, marginBottom: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { ...typography.eyebrow },
  section: { gap: 12 },
  sectionTitle: { ...typography.eyebrow, paddingLeft: 4 },
});
