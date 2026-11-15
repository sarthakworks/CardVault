import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import VaultSecurity from '../../../modules/vault-security';
import { createHeader } from '../../core/crypto/envelope';
import { deriveKeys, destroyKeys } from '../../core/crypto/deriveKeys';
import { seal, unseal } from '../../core/crypto/aesGcm';
import { cryptoPolicy } from '../../core/crypto/cryptoPolicy';
import { activeSession, assertGeneration } from '../../core/security/sessionStore';
import { snapshotSchema } from '../../core/vault/schemas';
import { vaultService } from '../../core/vault/vaultService';
import type { VaultSnapshot } from '../../core/vault/models';
import { VaultError } from '../../core/errors/VaultError';
import { backupFileSchema, backupSchema, unencryptedBackupSchema, type BackupFile } from './backupSchema';
import { useBackupStore } from './backupStore';
import { pickBackupFile, readBackupFile } from './backupFileAccess';
import { rememberBackupFile } from './backupFiles';

const cache = new Directory(Paths.cache, 'cardvault-backups');

export interface PreparedBackup {
  readonly name: string;
  readonly contents: string;
  readonly encrypted: boolean;
  readonly generation: number;
}

type PickedBackup = { kind: 'encrypted' } | { kind: 'unencrypted'; snapshot: VaultSnapshot };

function prepareCache(): void {
  cache.create({ intermediates: true, idempotent: true });
}

function ownedFile(uri: string): File {
  const file = new File(uri);
  const parent = cache.uri.replace(/\/+$/, '');
  if (file.uri !== `${parent}/${file.name}` || !file.name.startsWith('vault-') || !file.name.endsWith('.vault')) {
    throw new VaultError('format', 'The backup cache path is invalid.');
  }
  return file;
}

export function cleanupBackupCache(): void {
  if (!cache.exists) return;
  for (const entry of cache.list()) {
    if (entry instanceof File && entry.name.startsWith('vault-') && entry.name.endsWith('.vault')) entry.delete();
  }
  useBackupStore.setState({ pendingUri: null });
}

function prepareExport(contents: string, encrypted: boolean, generation: number): PreparedBackup {
  return {
    name: `vault-export-${encrypted ? '' : 'unencrypted-'}${randomUUID()}.vault`,
    contents,
    encrypted,
    generation,
  };
}

export async function createEncryptedExport(password: string): Promise<PreparedBackup> {
  if (password.length < cryptoPolicy.minimumPasswordLength || password.length > 256) {
    throw new VaultError('password', `Choose a dedicated backup password between ${cryptoPolicy.minimumPasswordLength} and 256 characters.`);
  }
  const generation = activeSession().generation;
  const header = createHeader('backup');
  const keys = await deriveKeys(password, header.kdf, 'backup');
  try {
    assertGeneration(generation);
    const ciphertext = await seal(activeSession().snapshot, keys.payload, header, 'backup');
    assertGeneration(generation);
    return prepareExport(JSON.stringify(backupSchema.parse({ header, ciphertext })), true, generation);
  } finally {
    destroyKeys(keys);
  }
}

export function createUnencryptedExport(): PreparedBackup {
  const { snapshot, generation } = activeSession();
  const backup = unencryptedBackupSchema.parse({ format: 'cardvault-unencrypted-backup', version: 1, snapshot });
  return prepareExport(JSON.stringify(backup), false, generation);
}

export async function saveBackupExport(backup: PreparedBackup): Promise<boolean> {
  activeSession();
  assertGeneration(backup.generation);
  if (typeof VaultSecurity.createBackupDocument !== 'function' || typeof VaultSecurity.rememberBackupDocument !== 'function') {
    throw new VaultError('storage', 'Saving to a folder requires an updated native build of Cardvault. You can still share this backup.');
  }
  const uri = await VaultSecurity.createBackupDocument(backup.name);
  if (uri === null) return false;
  assertGeneration(backup.generation);
  await new File(uri).write(backup.contents);
  assertGeneration(backup.generation);
  try {
    await rememberBackupFile(uri);
  } catch (cause) {
    throw new VaultError('storage', 'Your backup was saved, but could not be added to Backup files. Use Open existing to add it.', { cause });
  }
  return true;
}

export async function shareBackupExport(backup: PreparedBackup): Promise<void> {
  activeSession();
  assertGeneration(backup.generation);
  if (!await Sharing.isAvailableAsync()) throw new VaultError('storage', 'Sharing is unavailable on this device.');
  assertGeneration(backup.generation);
  prepareCache();
  const file = ownedFile(new File(cache, backup.name).uri);
  file.create();
  let retainedForSharing = false;
  try {
    await file.write(backup.contents);
    assertGeneration(backup.generation);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: `Share ${backup.encrypted ? 'encrypted' : 'unencrypted'} Cardvault backup`,
    });
    retainedForSharing = true;
  } finally {
    // Android recipients may read the URI after the chooser closes.
    if (!retainedForSharing && file.exists) file.delete();
  }
}

export async function pickBackup(): Promise<PickedBackup | null> {
  const generation = activeSession().generation;
  const asset = await pickBackupFile();
  if (!asset) return null;
  const { text } = await readBackupFile(asset.uri, asset.size);
  let backup: BackupFile;
  try {
    backup = backupFileSchema.parse(JSON.parse(text));
  } catch (cause) {
    throw new VaultError('format', 'This file is not a valid Cardvault .vault backup.', { cause });
  }
  assertGeneration(generation);
  if ('snapshot' in backup) {
    discardPendingImport();
    return { kind: 'unencrypted', snapshot: backup.snapshot };
  }
  prepareCache();
  const destination = new File(cache, `vault-import-${randomUUID()}.vault`);
  destination.create();
  await destination.write(JSON.stringify(backup));
  assertGeneration(generation);
  discardPendingImport();
  useBackupStore.setState({ pendingUri: destination.uri });
  return { kind: 'encrypted' };
}

export function discardPendingImport(): void {
  const uri = useBackupStore.getState().pendingUri;
  useBackupStore.setState({ pendingUri: null });
  if (uri) {
    const file = ownedFile(uri);
    if (file.exists) file.delete();
  }
}

export async function decryptPendingBackup(password: string): Promise<VaultSnapshot> {
  const generation = activeSession().generation;
  const uri = useBackupStore.getState().pendingUri;
  if (!uri) throw new VaultError('storage', 'Select an encrypted backup first.');
  const file = ownedFile(uri);
  if (!file.exists || file.size > cryptoPolicy.maximumFileBytes) throw new VaultError('format', 'This backup is unavailable or too large.');
  const envelope = backupSchema.parse(JSON.parse(await file.text()));
  const keys = await deriveKeys(password, envelope.header.kdf, 'backup');
  try {
    assertGeneration(generation);
    const snapshot = snapshotSchema.parse(await unseal(envelope.ciphertext, keys.payload, envelope.header, 'backup'));
    assertGeneration(generation);
    return snapshot;
  } finally {
    destroyKeys(keys);
  }
}

export async function importDecryptedBackup(snapshot: VaultSnapshot): Promise<void> {
  await vaultService.importSnapshot(snapshot);
}
