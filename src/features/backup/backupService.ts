import { Directory, File, FileMode, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { createHeader } from '../../core/crypto/envelope';
import { deriveKeys, destroyKeys } from '../../core/crypto/deriveKeys';
import { seal, unseal } from '../../core/crypto/aesGcm';
import { cryptoPolicy } from '../../core/crypto/cryptoPolicy';
import type { Authorization } from '../../core/security/stepUpAuthorization';
import { activeSession, assertGeneration } from '../../core/security/sessionStore';
import { snapshotSchema } from '../../core/vault/schemas';
import { vaultService } from '../../core/vault/vaultService';
import type { VaultSnapshot } from '../../core/vault/models';
import { VaultError } from '../../core/errors/VaultError';
import { backupSchema } from './backupSchema';
import { useBackupStore } from './backupStore';

const cache = new Directory(Paths.cache, 'cardvault-backups');

function prepareCache(): void {
  cache.create({ intermediates: true, idempotent: true });
}

function ownedFile(uri: string): File {
  const file = new File(uri);
  const parent = cache.uri.replace(/\/+$/, '');
  if (file.uri !== `${parent}/${file.name}` || !file.name.startsWith('vault-') || !file.name.endsWith('.vault')) {
    throw new VaultError('format', 'The encrypted cache path is invalid.');
  }
  return file;
}

export function cleanupEncryptedCache(): void {
  if (!cache.exists) return;
  for (const entry of cache.list()) {
    if (entry instanceof File && entry.name.startsWith('vault-') && entry.name.endsWith('.vault')) entry.delete();
  }
  useBackupStore.setState({ pendingUri: null });
}

export async function createEncryptedExport(password: string, confirmation: string): Promise<string> {
  if (password.length < cryptoPolicy.minimumPasswordLength || password.length > 256) {
    throw new VaultError('password', `Choose a dedicated backup password between ${cryptoPolicy.minimumPasswordLength} and 256 characters.`);
  }
  if (password !== confirmation) {
    throw new VaultError('password', 'Your backup passwords do not match.');
  }
  const generation = activeSession().generation;
  const header = createHeader('backup');
  const keys = await deriveKeys(password, header.kdf, 'backup');
  try {
    assertGeneration(generation);
    const ciphertext = await seal(activeSession().snapshot, keys.payload, header, 'backup');
    assertGeneration(generation);
    const encoded = JSON.stringify(backupSchema.parse({ header, ciphertext }));
    prepareCache();
    const file = new File(cache, `vault-export-${randomUUID()}.vault`);
    file.create();
    file.write(encoded);
    return file.uri;
  } finally {
    destroyKeys(keys);
  }
}

export async function shareEncryptedExport(uri: string): Promise<void> {
  const file = ownedFile(uri);
  if (!file.exists) throw new VaultError('storage', 'The encrypted export file is no longer available.');
  if (!await Sharing.isAvailableAsync()) throw new VaultError('storage', 'Android sharing is unavailable on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Share encrypted Cardvault backup' });
}

export async function pickEncryptedBackup(): Promise<boolean> {
  activeSession();
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: false });
  if (result.canceled) return false;
  const asset = result.assets[0];
  if (!asset || !asset.name.toLowerCase().endsWith('.vault') || !/^(file|content):\/\//.test(asset.uri)) {
    throw new VaultError('format', 'Choose a local file with the .vault extension.');
  }
  if (asset.size !== undefined && asset.size > cryptoPolicy.maximumFileBytes) {
    throw new VaultError('limit', 'Backups must be smaller than 12 MB.');
  }
  const source = new File(asset.uri);
  const handle = source.open(FileMode.ReadOnly);
  let bytes: Uint8Array;
  try {
    bytes = await handle.readBytes(cryptoPolicy.maximumFileBytes + 1);
  } finally {
    handle.close();
  }
  if (bytes.byteLength > cryptoPolicy.maximumFileBytes) throw new VaultError('limit', 'Backups must be smaller than 12 MB.');
  const envelope = backupSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  prepareCache();
  const destination = new File(cache, `vault-import-${randomUUID()}.vault`);
  destination.create();
  destination.write(JSON.stringify(envelope));
  discardPendingImport();
  useBackupStore.setState({ pendingUri: destination.uri });
  return true;
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

export async function importDecryptedBackup(snapshot: VaultSnapshot, authorization: Authorization): Promise<void> {
  await vaultService.importSnapshot(snapshot, authorization);
}
