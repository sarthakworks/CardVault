import {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {errorMessage} from '../../core/errors/VaultError';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {changeFingerprintUnlock, useSettingsStore} from './settingsStore';

type Availability =
  | {status: 'checking' | 'available' | 'not-enrolled' | 'unsupported'}
  | {status: 'error'; message: string};

export function BiometricSetting() {
  const {colors} = useTheme();
  const enabled = useSettingsStore((state) => state.biometricsEnabled);
  const [availability, setAvailability] = useState<Availability>({
    status: 'checking',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const changing = useRef(false);

  useEffect(() => {
    let version = 0;
    function checkAvailability() {
      const request = ++version;
      setAvailability({status: 'checking'});
      void Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.getEnrolledLevelAsync(),
      ])
        .then(([hardware, level]) => {
          if (request !== version) return;
          const status = !hardware
            ? 'unsupported'
            : level !== LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG
              ? 'not-enrolled'
              : SecureStore.canUseBiometricAuthentication()
                ? 'available'
                : 'unsupported';
          setAvailability({status});
        })
        .catch((cause) => {
          if (request === version)
            setAvailability({status: 'error', message: errorMessage(cause)});
        });
    }
    checkAvailability();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAvailability();
    });
    return () => {
      version++;
      subscription.remove();
    };
  }, []);

  async function change(value: boolean) {
    if (changing.current || value === enabled) return;
    changing.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await changeFingerprintUnlock(value);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      changing.current = false;
      setBusy(false);
    }
  }

  const available = availability.status === 'available';
  const disabled = busy || (!enabled && !available);
  const description =
    availability.status === 'checking'
      ? 'Checking device support'
      : enabled
        ? available
          ? 'On for future app opens'
          : 'Unavailable. Master password still works.'
        : availability.status === 'not-enrolled'
          ? 'Set up a strong fingerprint in Android settings'
          : available
            ? 'Use instead of your master password'
            : 'Fingerprint is unavailable on this device';
  const message =
    error ??
    (availability.status === 'error' ? availability.message : undefined);

  return (
    <View style={{gap: 10}}>
      <View
        style={[
          styles.row,
          {backgroundColor: colors.surface, borderColor: colors.border},
        ]}>
        <View style={[styles.icon, {backgroundColor: colors.accentMuted}]}>
          <Feather name="user-check" size={20} color={colors.accent} />
        </View>
        <View style={styles.labels}>
          <Text style={[styles.title, {color: colors.textPrimary}]}>
            Fingerprint unlock
          </Text>
          <Text style={[styles.detail, {color: colors.textSecondary}]}>
            {description}
          </Text>
        </View>
        {busy ? <ActivityIndicator size="small" color={colors.accent} /> : null}
        <Switch
          accessibilityLabel="Fingerprint unlock"
          accessibilityHint="Use your fingerprint to unlock Cardvault when opening the app"
          accessibilityState={{disabled, busy}}
          value={enabled}
          disabled={disabled}
          onValueChange={(value) => void change(value)}
          trackColor={{false: colors.border, true: colors.accent}}
          thumbColor={colors.surface}
        />
      </View>
      {message ? (
        <Text
          accessibilityRole="alert"
          style={[styles.error, {color: colors.danger}]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 17,
    gap: 13,
    borderRadius: 20,
    borderWidth: 1,
  },
  icon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {flex: 1, gap: 5},
  title: {...typography.label},
  detail: {...typography.small},
  error: {...typography.small, paddingHorizontal: 4},
});
