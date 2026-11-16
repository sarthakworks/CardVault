import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import {bytesToHex} from '@noble/hashes/utils.js';
import {assertGeneration} from './sessionStore';
import {writePreference} from '../storage/preferencesRepository';
import {VaultError} from '../errors/VaultError';
import {
  biometricSlot,
  biometricStoreOptions,
  requireHardwareProtection,
} from './biometricCredentials';
import {runBiometricPrompt} from './biometricPrompt';

export async function disableBiometricUnlock(): Promise<void> {
  await SecureStore.deleteItemAsync(biometricSlot, biometricStoreOptions);
  await writePreference('biometrics', 'false');
}

export async function enableBiometricUnlock(
  vaultId: string,
  key: Uint8Array,
  generation: number
): Promise<void> {
  const enrolled = await LocalAuthentication.getEnrolledLevelAsync();
  if (
    enrolled !== LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG ||
    !SecureStore.canUseBiometricAuthentication()
  ) {
    throw new VaultError(
      'biometric',
      'Enroll a strong fingerprint or supported biometric in Android Settings first.'
    );
  }
  assertGeneration(generation);
  await disableBiometricUnlock();
  assertGeneration(generation);
  let encoded = JSON.stringify({vaultId, key: bytesToHex(key)});
  try {
    await runBiometricPrompt(() =>
      SecureStore.setItemAsync(biometricSlot, encoded, biometricStoreOptions)
    );
    encoded = '';
    assertGeneration(generation);
    await requireHardwareProtection();
    assertGeneration(generation);
    await writePreference('biometrics', 'true');
  } catch (error) {
    await SecureStore.deleteItemAsync(biometricSlot, biometricStoreOptions);
    throw error;
  } finally {
    encoded = '';
  }
}
