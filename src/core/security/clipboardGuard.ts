import * as Clipboard from 'expo-clipboard';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import VaultSecurity from '../../../modules/vault-security';
import { activeSession, assertGeneration } from './sessionStore';
import { VaultError } from '../errors/VaultError';

export async function copySecret(value: string): Promise<void> {
  const generation = activeSession().generation;
  const copied = await Clipboard.setStringAsync(value, { android: { isSensitive: true } });
  if (!copied) throw new VaultError('storage', 'Android could not copy this value.');
  const hash = bytesToHex(sha256(new TextEncoder().encode(value)));
  await VaultSecurity.armClipboardExpiry(hash);
  try {
    assertGeneration(generation);
  } catch (error) {
    await VaultSecurity.clearOwnedClipboard();
    throw error;
  }
}
