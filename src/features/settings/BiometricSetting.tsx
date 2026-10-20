import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { setBiometricUnlock } from '../../core/security/biometricKeyStore';
import { notify, reportError } from '../../core/errors/noticeStore';
import { ActionAuthorizationSheet } from '../auth/ActionAuthorizationSheet';
import { useSettingsStore, refreshSettings } from './settingsStore';

export function BiometricSetting() {
  const { colors } = useTheme();
  const enabled = useSettingsStore((state) => state.biometricsEnabled);
  const [requested, setRequested] = useState<boolean | null>(null);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    void LocalAuthentication.getEnrolledLevelAsync().then((level) => setAvailable(level === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG)).catch(reportError);
  }, []);
  return (
    <>
      <View style={{ padding: 18, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <View style={{ backgroundColor: colors.accentMuted, padding: 10, borderRadius: 14 }}><MaterialCommunityIcons name="fingerprint" size={24} color={colors.accent} /></View>
          <View style={{ flex: 1, gap: 5 }}><Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}>Fingerprint authentication</Text><Text style={{ color: colors.textSecondary, fontSize: 11 }}>{enabled ? 'Unlock and confirm changes with a fingerprint' : available ? 'Optional. Master password remains available.' : 'Enroll a strong biometric in Android first'}</Text></View>
          <Switch accessibilityLabel="Enable fingerprint authentication" value={enabled} disabled={!available && !enabled} onValueChange={setRequested} trackColor={{ false: colors.border, true: colors.accent }} thumbColor={colors.surface} />
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 18 }}>Use a fingerprint or master password for each save, edit, deletion, and import merge. Backup encryption and decryption still need the dedicated backup password.</Text>
      </View>
      <ActionAuthorizationSheet visible={requested !== null} operation="biometrics:toggle" onClose={() => setRequested(null)} title={requested ? 'Make access effortless.' : 'Password-only it is.'} description={requested ? 'Confirm your master password to enable fingerprint authentication. We only enable it when the actual key is hardware-protected.' : 'Confirm with your fingerprint or master password to disable fingerprint authentication.'} onAuthorized={async (authorization) => {
        if (requested === null) throw new Error('Choose a biometric setting first.');
        try {
          await setBiometricUnlock(requested, authorization);
          await refreshSettings();
          notify(requested ? 'Biometric unlock enabled. Unlock to continue.' : 'Biometric unlock disabled.');
        } catch (error) {
          reportError(error);
          throw error;
        }
      }} />
    </>
  );
}
