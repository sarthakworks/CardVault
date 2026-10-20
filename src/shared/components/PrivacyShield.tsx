import { ActivityIndicator, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

export function PrivacyShield({ loading = false }: { loading?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: colors.background }}>
      <Feather name="shield" size={42} color={colors.accent} />
      <Text style={[typography.eyebrow, { color: colors.textPrimary }]}>CARDVAULT</Text>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
    </View>
  );
}
