import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { bytesToHex } from '@noble/hashes/utils.js';
import { activeSession, assertGeneration, useSessionStore } from './sessionStore';
import { consumeAuthorization, type Authorization } from './stepUpAuthorization';
import { lockSession } from './sessionLifecycle';
import { writePreference } from '../storage/preferencesRepository';
import { VaultError } from '../errors/VaultError';
import { biometricSlot, biometricStoreOptions, requireHardwareProtection } from './biometricCredentials';
import { runBiometricPrompt } from './biometricPrompt';

export async function setBiometricUnlock(enabled: boolean, authorization: Authorization): Promise<void> {
  consumeAuthorization(authorization, 'biometrics:toggle');
  if (!enabled) {
    await SecureStore.deleteItemAsync(biometricSlot, biometricStoreOptions);
    await writePreference('biometrics', 'false');
    return;
  }
  const enrolled = await LocalAuthentication.getEnrolledLevelAsync();
  if (enrolled !== LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG || !SecureStore.canUseBiometricAuthentication()) {
    throw new VaultError('biometric', 'Enroll a strong fingerprint or supported biometric in Android Settings first.');
  }
  const { header, key } = activeSession();
  let encoded = JSON.stringify({ vaultId: header.vaultId, key: bytesToHex(key) });
  lockSession();
  const generation = useSessionStore.getState().generation;
  try {
    await runBiometricPrompt(() => SecureStore.setItemAsync(biometricSlot, encoded, biometricStoreOptions));
    encoded = '';
    assertGeneration(generation);
    await requireHardwareProtection();
    await writePreference('biometrics', 'true');
  } catch (error) {
    await SecureStore.deleteItemAsync(biometricSlot, biometricStoreOptions);
    throw error;
  } finally {
    encoded = '';
  }
}
