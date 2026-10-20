import { Component, useEffect, useLayoutEffect, useState, type PropsWithChildren } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenCapture from 'expo-screen-capture';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import VaultSecurity from '../../modules/vault-security';
import { AppProviders } from './AppProviders';
import { RootNavigator } from './navigation/RootNavigator';
import { initializeAuth } from '../features/auth/authService';
import { refreshSettings } from '../features/settings/settingsStore';
import { cleanupEncryptedCache } from '../features/backup/backupService';
import { watchSessionLifecycle, lockSession } from '../core/security/sessionLifecycle';
import { useSessionStore } from '../core/security/sessionStore';
import { errorMessage } from '../core/errors/VaultError';
import { reportError } from '../core/errors/noticeStore';
import { useTheme } from '../shared/theme/ThemeProvider';
import { typography } from '../shared/theme/typography';
import { Screen } from '../shared/components/Screen';
import { Button } from '../shared/components/Button';
import { PrivacyShield } from '../shared/components/PrivacyShield';
import { ErrorBanner } from '../shared/components/ErrorBanner';

void SplashScreen.preventAutoHideAsync().catch(reportError);

class VaultErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { lockSession(); }
  override render() {
    if (this.state.failed) return (
      <View style={{ flex: 1, backgroundColor: '#0B111B', padding: 30, justifyContent: 'center', gap: 20 }}>
        <Text style={{ color: '#F3F6FC', fontSize: 24, fontWeight: '700' }}>Your vault stopped safely.</Text>
        <Text style={{ color: '#ACB9CC', fontSize: 15, lineHeight: 24 }}>An unexpected display error occurred. Your session was cleared. Close and reopen Cardvault to unlock again.</Text>
      </View>
    );
    return this.props.children;
  }
}

function AppContent() {
  const { colors, dark } = useTheme();
  const status = useSessionStore((state) => state.status);
  const generation = useSessionStore((state) => state.generation);
  const sessionError = useSessionStore((state) => state.error);
  const [initialized, setInitialized] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const [fontsLoaded, fontError] = useFonts({ ...Feather.font, ...MaterialCommunityIcons.font });
  useEffect(() => {
    const stop = watchSessionLifecycle(() => setFocusVersion((value) => value + 1));
    async function initialize() {
      await ScreenCapture.preventScreenCaptureAsync('cardvault');
      cleanupEncryptedCache();
      await Promise.all([initializeAuth(), refreshSettings()]);
      setInitialized(true);
    }
    void initialize().catch((error) => setBootError(errorMessage(error)));
    return stop;
  }, []);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(reportError);
  }, [colors.background]);
  useEffect(() => {
    if ((initialized && fontsLoaded) || bootError || fontError) {
      void SplashScreen.hideAsync().catch(reportError);
    }
  }, [initialized, fontsLoaded, bootError, fontError]);
  useLayoutEffect(() => {
    if (AppState.currentState === 'active' && VaultSecurity.isWindowFocused()) {
      void VaultSecurity.releasePrivacyShield().catch((error) => {
        lockSession();
        setBootError(`The native privacy shield could not be initialized: ${errorMessage(error)}`);
      });
    }
  }, [status, generation, focusVersion, initialized]);
  const failure = bootError ?? fontError?.message ?? (status === 'failed' ? sessionError : null);
  if (failure) return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 30, justifyContent: 'center', gap: 20 }}>
        <Feather name="shield" color={colors.danger} size={40} />
        <Text style={[typography.title, { color: colors.textPrimary }]}>Your data stays protected.</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{failure}</Text>
        <Text style={[typography.small, { color: colors.textSecondary }]}>We will never replace an unreadable vault with an empty one. Close and reopen the app, or restore an encrypted backup on a separate installation.</Text>
        {status === 'failed' && !bootError && !fontError ? <Button title="Try opening again" icon="refresh-cw" onPress={() => void initializeAuth()} /> : null}
      </ScrollView>
    </Screen>
  );
  if (!initialized || !fontsLoaded || status === 'booting') return <PrivacyShield loading />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <RootNavigator />
      <ErrorBanner />
    </View>
  );
}

export default function App() {
  return <VaultErrorBoundary><AppProviders><AppContent /></AppProviders></VaultErrorBoundary>;
}
