import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSessionStore } from '../../core/security/sessionStore';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { CreateVaultScreen } from '../../features/auth/CreateVaultScreen';
import { UnlockScreen } from '../../features/auth/UnlockScreen';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { colors, dark } = useTheme();
  const status = useSessionStore((state) => state.status);
  const generation = useSessionStore((state) => state.generation);
  return (
    <NavigationContainer theme={{ ...(dark ? DarkTheme : DefaultTheme), colors: { ...(dark ? DarkTheme.colors : DefaultTheme.colors), primary: colors.accent, background: colors.background, card: colors.surface, text: colors.textPrimary, border: colors.border } }}>
      <Stack.Navigator key={`${status}:${generation}`} screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.background } }}>
        {status === 'unlocked' ? <Stack.Screen name="Vault" component={MainTabs} />
          : status === 'setup' ? <Stack.Screen name="Create" component={CreateVaultScreen} />
            : <Stack.Screen name="Unlock" component={UnlockScreen} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
