import {ActivityIndicator, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeProvider';
import {typography} from '../theme/typography';
import {BrandMark} from './BrandMark';

export function PrivacyShield({loading = false}: {loading?: boolean}) {
  const {colors} = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        backgroundColor: colors.background,
      }}>
      <BrandMark size={76} />
      <Text style={[typography.eyebrow, {color: colors.textPrimary}]}>
        CARDVAULT
      </Text>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
    </View>
  );
}
