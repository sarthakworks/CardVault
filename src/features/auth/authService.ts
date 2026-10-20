import { AppState } from 'react-native';
import { createHeader, type EnvelopeHeader } from '../../core/crypto/envelope';
import { deriveKeys, destroyKeys } from '../../core/crypto/deriveKeys';
import { seal, unseal } from '../../core/crypto/aesGcm';
import { createVault, readVault } from '../../core/storage/vaultRepository';
import { assertGeneration, useSessionStore } from '../../core/security/sessionStore';
import { sessionKeyring } from '../../core/security/sessionKeyring';
import { verifiedKeys } from '../../core/security/passwordVerification';
import { readBiometricKey } from '../../core/security/biometricCredentials';
import { snapshotSchema } from '../../core/vault/schemas';
import type { VaultSnapshot } from '../../core/vault/models';
import { errorMessage, VaultError } from '../../core/errors/VaultError';
import { cryptoPolicy } from '../../core/crypto/cryptoPolicy';
import VaultSecurity from '../../../modules/vault-security';

function assertForeground(generation: number): void {
  assertGeneration(generation);
  if (AppState.currentState !== 'active' || !VaultSecurity.isWindowFocused()) {
    throw new VaultError('locked', 'Return to Cardvault and unlock again.');
  }
}

function openSession(snapshot: VaultSnapshot, key: Uint8Array, header: EnvelopeHeader, revision: number, generation: number): void {
  assertForeground(generation);
  if (snapshot.vaultId !== header.vaultId) throw new VaultError('format', 'The vault contents do not match its header.');
  sessionKeyring.install(key);
  useSessionStore.setState({ status: 'unlocked', snapshot, header, revision, error: null });
}

export async function initializeAuth(): Promise<void> {
  try {
    const record = await readVault();
    useSessionStore.setState({ header: record?.header ?? null, status: record ? 'locked' : 'setup', error: null });
  } catch (error) {
    useSessionStore.setState({ status: 'failed', error: errorMessage(error) });
  }
}

export async function createMasterPassword(password: string): Promise<void> {
  if (password.length < cryptoPolicy.minimumPasswordLength || password.length > 256) {
    throw new VaultError('password', `Choose a master password between ${cryptoPolicy.minimumPasswordLength} and 256 characters.`);
  }
  const generation = useSessionStore.getState().generation;
  const header = createHeader('local');
  const keys = await deriveKeys(password, header.kdf);
  try {
    assertForeground(generation);
    const snapshot: VaultSnapshot = { version: 1, vaultId: header.vaultId, cards: [], notes: [] };
    const verifier = await seal({ marker: 'cardvault-verifier-v1', vaultId: header.vaultId }, keys.verification, header, 'verifier');
    const ciphertext = await seal(snapshot, keys.payload, header, 'payload');
    assertForeground(generation);
    await createVault({ header, verifier, ciphertext, revision: 0 });
    useSessionStore.setState({ header, status: 'locked' });
    openSession(snapshot, keys.payload, header, 0, generation);
  } finally {
    destroyKeys(keys);
  }
}

export async function unlockWithPassword(password: string): Promise<void> {
  const generation = useSessionStore.getState().generation;
  const record = await readVault();
  if (!record) throw new VaultError('storage', 'No local vault was found.');
  const keys = await verifiedKeys(password, record);
  try {
    assertForeground(generation);
    const snapshot = snapshotSchema.parse(await unseal(record.ciphertext, keys.payload, record.header, 'payload', record.revision));
    openSession(snapshot, keys.payload, record.header, record.revision, generation);
  } finally {
    destroyKeys(keys);
  }
}

export async function unlockWithBiometrics(): Promise<void> {
  const generation = useSessionStore.getState().generation;
  const record = await readVault();
  if (!record) throw new VaultError('storage', 'No local vault was found.');
  const key = await readBiometricKey(record.header.vaultId);
  try {
    assertForeground(generation);
    const snapshot = snapshotSchema.parse(await unseal(record.ciphertext, key, record.header, 'payload', record.revision));
    openSession(snapshot, key, record.header, record.revision, generation);
  } finally {
    key.fill(0);
  }
}
