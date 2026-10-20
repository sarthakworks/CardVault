import * as SecureStore from 'expo-secure-store';
import { hexToBytes } from '@noble/hashes/utils.js';
import { z } from 'zod';
import VaultSecurity from '../../../modules/vault-security';
import { readPreference } from '../storage/preferencesRepository';
import { VaultError } from '../errors/VaultError';
import { runBiometricPrompt } from './biometricPrompt';

export const biometricService = 'cardvault.biometric.v1';
export const biometricSlot = 'payload-key';
export const biometricStoreOptions: SecureStore.SecureStoreOptions = {
  keychainService: biometricService,
  requireAuthentication: true,
  authenticationPrompt: 'Unlock your private vault',
};

const biometricKeySchema = z.strictObject({
  vaultId: z.uuid(),
  key: z.string().regex(/^[0-9a-f]{64}$/),
});

export async function requireHardwareProtection(): Promise<void> {
  const security = await VaultSecurity.inspectWrappingKey(biometricService);
  if (!security.hardwareBacked || !security.authenticationRequired || !security.perUseAuthentication) {
    throw new VaultError('biometric', 'This device cannot verify hardware-backed biometric key protection. Please use your master password.');
  }
}

export async function readBiometricKey(vaultId: string, prompt = 'Unlock your private vault'): Promise<Uint8Array> {
  if (await readPreference('biometrics') !== 'true') {
    throw new VaultError('biometric', 'Fingerprint authentication is not enabled.');
  }
  await requireHardwareProtection();
  const encoded = await runBiometricPrompt(() => SecureStore.getItemAsync(biometricSlot, {
    ...biometricStoreOptions,
    authenticationPrompt: prompt,
  }));
  if (!encoded) {
    throw new VaultError('biometric', 'Biometric access changed. Use your master password and enable fingerprint authentication again.');
  }
  const entry = biometricKeySchema.parse(JSON.parse(encoded));
  if (entry.vaultId !== vaultId) throw new VaultError('biometric', 'This biometric key belongs to a different vault.');
  return hexToBytes(entry.key);
}
