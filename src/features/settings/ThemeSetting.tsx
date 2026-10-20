import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useSettingsStore, changeTheme } from './settingsStore';
import { reportError } from '../../core/errors/noticeStore';

export function ThemeSetting() {
  const { colors } = useTheme();
  const theme = useSettingsStore((state) => state.theme);
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {(['light', 'dark'] as const).map((mode) => (
        <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: mode === theme }} accessibilityLabel={`${mode} theme`} onPress={() => void changeTheme(mode).catch(reportError)} style={{ flex: 1, backgroundColor: mode === theme ? colors.accentMuted : colors.surface, borderRadius: 19, padding: 18, borderWidth: 1.5, borderColor: mode === theme ? colors.accent : colors.border, gap: 15 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Feather name={mode === 'light' ? 'sun' : 'moon'} size={22} color={mode === theme ? colors.accent : colors.textSecondary} /><Feather name={mode === theme ? 'check-circle' : 'circle'} size={16} color={mode === theme ? colors.accent : colors.border} /></View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>{mode === 'light' ? 'Light & airy' : 'After hours'}</Text>
        </Pressable>
      ))}
    </View>
  );
}
