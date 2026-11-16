import {Pressable, StyleSheet, Text, View} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {useSettingsStore, changeTheme} from './settingsStore';
import {reportError} from '../../core/errors/noticeStore';

export function ThemeSetting() {
  const {colors} = useTheme();
  const theme = useSettingsStore((state) => state.theme);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Appearance"
      style={[styles.control, {backgroundColor: colors.surfaceMuted}]}>
      {(['light', 'dark'] as const).map((mode) => (
        <Pressable
          key={mode}
          accessibilityRole="radio"
          accessibilityState={{checked: mode === theme}}
          accessibilityLabel={`${mode} theme`}
          onPress={() => void changeTheme(mode).catch(reportError)}
          style={[
            styles.option,
            {
              backgroundColor: mode === theme ? colors.surface : 'transparent',
              borderColor: mode === theme ? colors.border : 'transparent',
            },
          ]}>
          <Feather
            name={mode === 'light' ? 'sun' : 'moon'}
            size={20}
            color={mode === theme ? colors.accent : colors.textSecondary}
          />
          <Text
            style={[
              styles.label,
              {
                color:
                  mode === theme ? colors.textPrimary : colors.textSecondary,
              },
            ]}>
            {mode === 'light' ? 'Light' : 'Dark'}
          </Text>
          {mode === theme ? (
            <Feather name="check" size={14} color={colors.accent} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {flexDirection: 'row', padding: 5, borderRadius: 17, gap: 5},
  option: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  label: {...typography.label},
});
