import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { SheetTextField as TextField } from '../../shared/components/TextField';
import { Sheet } from '../../shared/components/Sheet';
import { Button } from '../../shared/components/Button';
import { errorMessage } from '../../core/errors/VaultError';
import { authorizeWithBiometrics, authorizeWithPassword, type Authorization, type ProtectedOperation } from '../../core/security/stepUpAuthorization';
import { useSettingsStore } from '../settings/settingsStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  operation: ProtectedOperation;
  onAuthorized: (authorization: Authorization) => Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
}

export function ActionAuthorizationSheet(props: Props) {
  return props.visible ? <AuthorizationContent {...props} /> : null;
}

function AuthorizationContent({ onClose, onAuthorized, operation, title = 'One more layer.', description, confirmLabel = 'Confirm securely' }: Props) {
  const { colors } = useTheme();
  const biometricsEnabled = useSettingsStore((state) => state.biometricsEnabled);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function confirm(method: 'password' | 'biometric') {
    if (busy || (method === 'password' && !password)) return;
    const submitted = password;
    setPassword('');
    setError(undefined);
    setBusy(true);
    try {
      const authorization = method === 'biometric'
        ? await authorizeWithBiometrics(operation)
        : await authorizeWithPassword(submitted, operation);
      await onAuthorized(authorization);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet visible onClose={onClose} title={title} subtitle={description ?? (biometricsEnabled ? 'Confirm this action with your fingerprint or master password.' : 'Enter your master password to confirm this action. Enable fingerprints in Settings for quicker confirmations.')} dismissible={!busy}>
      <View style={[styles.icon, { backgroundColor: colors.accentMuted }]}><Feather name="shield" size={24} color={colors.accent} /></View>
      {biometricsEnabled ? <>
        <Button title="Confirm with fingerprint" icon="user-check" loading={busy} onPress={() => void confirm('biometric')} />
      </> : null}
      {error ? <Text accessibilityRole="alert" style={[typography.small, { color: colors.danger }]}>{error}</Text> : null}
      {biometricsEnabled && !showPassword ? <Button title="Use master password instead" variant="secondary" disabled={busy} onPress={() => setShowPassword(true)} /> : <>
        <TextField label="MASTER PASSWORD" secureTextEntry value={password} onChangeText={setPassword} editable={!busy} onSubmitEditing={() => void confirm('password')} returnKeyType="done" maxLength={256} />
        <Button title={biometricsEnabled ? 'Confirm with master password' : confirmLabel} icon="lock" variant={biometricsEnabled ? 'secondary' : 'primary'} loading={busy} disabled={!password} onPress={() => void confirm('password')} />
      </>}
      <Button title="Cancel" variant="ghost" disabled={busy} onPress={onClose} />
      <Text style={[typography.small, { color: colors.textSecondary, textAlign: 'center' }]}>Authentication stays on this device.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  icon: { height: 52, width: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
});
