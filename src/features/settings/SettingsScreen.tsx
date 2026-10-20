import { ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../../shared/components/Screen';
import { PageHeader } from '../../shared/components/PageHeader';
import { Button } from '../../shared/components/Button';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { lockSession } from '../../core/security/sessionLifecycle';
import { ThemeSetting } from './ThemeSetting';
import { BiometricSetting } from './BiometricSetting';
import { BackupActions } from '../backup/BackupActions';

export function SettingsScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 35 }}>
        <PageHeader title={'Your vault.\nYour rules.'} subtitle="Small preferences. Uncompromising privacy." />
        <View style={{ marginHorizontal: 24, gap: 26 }}>
          <LinearGradient colors={['#263E65', '#162A49']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 23, borderRadius: 23, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Feather name="shield" size={27} color="#D7E5FF" /><View style={{ backgroundColor: '#FFFFFF15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}><Text style={{ color: '#CBDFC9', fontSize: 9, letterSpacing: 1 }}>ALWAYS OFFLINE</Text></View></View>
            <Text style={{ color: '#FFFFFF', fontSize: 21, fontWeight: '600', letterSpacing: -0.5 }}>Private means private.</Text>
            <Text style={{ color: '#BFCEE1', fontSize: 12, lineHeight: 20 }}>No account. No servers. No one looking over your shoulder. Just AES-256 encryption and you.</Text>
          </LinearGradient>
          <View style={{ gap: 14 }}><Text style={[typography.eyebrow, { color: colors.textSecondary }]}>MAKE IT YOURS</Text><ThemeSetting /></View>
          <View style={{ gap: 14 }}><Text style={[typography.eyebrow, { color: colors.textSecondary }]}>ACCESS & SECURITY</Text><BiometricSetting /></View>
          <View style={{ gap: 14 }}><Text style={[typography.eyebrow, { color: colors.textSecondary }]}>BACKUP & PORTABILITY</Text><BackupActions /><Text style={[typography.small, { color: colors.textSecondary }]}>Backups are your responsibility. App removal deletes local data. Imported records are added without replacing existing ones.</Text></View>
          <Button title="Lock my vault" variant="secondary" icon="lock" onPress={lockSession} />
          <View style={{ alignItems: 'center', gap: 8, marginTop: 5 }}><Text style={[typography.eyebrow, { color: colors.textSecondary }]}>CARDVAULT 1.0.0</Text><Text style={{ color: colors.textSecondary, fontSize: 10 }}>A calmer home for your important things.</Text></View>
        </View>
      </ScrollView>
    </Screen>
  );
}
