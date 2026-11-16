import {useState} from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import {Screen} from '../../shared/components/Screen';
import {BrandMark} from '../../shared/components/BrandMark';
import {TextField} from '../../shared/components/TextField';
import {Button} from '../../shared/components/Button';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {useSettingsStore} from '../settings/settingsStore';
import {errorMessage} from '../../core/errors/VaultError';
import {unlockWithBiometrics, unlockWithPassword} from './authService';

export function UnlockScreen() {
  const {colors} = useTheme();
  const biometricEnabled = useSettingsStore((state) => state.biometricsEnabled);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function unlock(biometric: boolean) {
    const submitted = password;
    setPassword('');
    setError(undefined);
    setBusy(true);
    try {
      if (biometric) await unlockWithBiometrics();
      else await unlockWithPassword(submitted);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <KeyboardAvoidingView behavior="height" style={{flex: 1}}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}>
          <Text style={[typography.eyebrow, {color: colors.textPrimary}]}>
            CARDVAULT
          </Text>
          <View style={styles.center}>
            <View style={[styles.outer, {borderColor: colors.border}]}>
              <View
                style={[styles.inner, {backgroundColor: colors.brandSurface}]}>
                <BrandMark size={88} />
              </View>
            </View>
            <Text
              style={[
                typography.hero,
                {color: colors.textPrimary, textAlign: 'center'},
              ]}>
              Welcome back.
            </Text>
            <Text
              style={[
                typography.body,
                {color: colors.textSecondary, textAlign: 'center'},
              ]}>
              Unlock once when you open Cardvault.{'\n'}Switching apps will not
              ask again.
            </Text>
          </View>
          <TextField
            label="MASTER PASSWORD"
            secureTextEntry
            placeholder="Enter your master password"
            value={password}
            onChangeText={setPassword}
            error={error}
            editable={!busy}
            maxLength={256}
            onSubmitEditing={() => {
              if (password) void unlock(false);
            }}
          />
          <Button
            title={busy ? 'Unlocking securely' : 'Unlock vault'}
            icon="unlock"
            loading={busy}
            disabled={!password}
            onPress={() => void unlock(false)}
          />
          {biometricEnabled ? (
            <Button
              title="Use fingerprint"
              variant="secondary"
              icon="user-check"
              loading={busy}
              onPress={() => void unlock(true)}
            />
          ) : null}
          <View style={styles.footer}>
            <Feather name="shield" size={16} color={colors.success} />
            <Text style={[typography.small, {color: colors.textSecondary}]}>
              On your device. Under your control.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {padding: 28, paddingBottom: 40, gap: 18, flexGrow: 1},
  center: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: 34,
    flex: 1,
    justifyContent: 'center',
  },
  outer: {padding: 16, borderWidth: 1, borderRadius: 45, marginBottom: 10},
  inner: {
    height: 100,
    width: 100,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
});
