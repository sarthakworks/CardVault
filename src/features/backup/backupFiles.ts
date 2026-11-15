import { create } from 'zustand';
import { z } from 'zod';
import VaultSecurity from '../../../modules/vault-security';
import { errorMessage, VaultError } from '../../core/errors/VaultError';
import { activeSession, assertGeneration } from '../../core/security/sessionStore';
import { readPreference, writePreference } from '../../core/storage/preferencesRepository';
import { pickBackupFile, readBackupFile } from './backupFileAccess';

const savedBackupSchema = z.strictObject({
  uri: z.string().regex(/^content:\/\//),
  name: z.string().min(1),
  location: z.string().min(1),
  size: z.number().int().nonnegative().nullable(),
  addedAt: z.iso.datetime(),
});
const savedBackupsSchema = z.array(savedBackupSchema);
export type SavedBackup = z.infer<typeof savedBackupSchema>;
export interface OpenBackup {
  file: SavedBackup;
  text: string;
  byteLength: number;
}

export const useBackupFilesStore = create<{
  files: SavedBackup[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
}>(() => ({ files: [], status: 'loading', error: null }));

let historyTail: Promise<void> = Promise.resolve();

function synchronizeHistory(file?: SavedBackup): Promise<void> {
  const generation = activeSession().generation;
  const operation = historyTail.then(async () => {
    useBackupFilesStore.setState({ status: 'loading', error: null });
    const encoded = await readPreference('backup-files');
    let files: SavedBackup[];
    try {
      files = savedBackupsSchema.parse(encoded === null ? [] : JSON.parse(encoded));
    } catch (cause) {
      throw new VaultError('format', 'The saved-backup list could not be read. Your vault and backup files have not been changed.', { cause });
    }
    assertGeneration(generation);
    if (file) {
      files = [file, ...files.filter((entry) => entry.uri !== file.uri)];
      await writePreference('backup-files', JSON.stringify(files));
      assertGeneration(generation);
    }
    useBackupFilesStore.setState({ files, status: 'ready', error: null });
  }).catch((cause) => {
    useBackupFilesStore.setState({ status: 'error', error: errorMessage(cause) });
    throw cause;
  });
  historyTail = operation.then(() => undefined, () => undefined);
  return operation;
}

export function refreshBackupFiles(): Promise<void> {
  return synchronizeHistory();
}

export async function rememberBackupFile(uri: string, addedAt = new Date().toISOString()): Promise<SavedBackup> {
  const generation = activeSession().generation;
  if (typeof VaultSecurity.rememberBackupDocument !== 'function') {
    throw new VaultError('storage', 'Backup file access requires an updated native build of Cardvault.');
  }
  const info = await VaultSecurity.rememberBackupDocument(uri);
  assertGeneration(generation);
  const file = savedBackupSchema.parse({ ...info, addedAt });
  await synchronizeHistory(file);
  return file;
}

export async function openExistingBackup(): Promise<OpenBackup | null> {
  const generation = activeSession().generation;
  const asset = await pickBackupFile();
  if (!asset) return null;
  assertGeneration(generation);
  const raw = await readBackupFile(asset.uri, asset.size);
  assertGeneration(generation);
  const file = await rememberBackupFile(asset.uri);
  assertGeneration(generation);
  return { file, ...raw };
}

export async function openSavedBackup(file: SavedBackup): Promise<OpenBackup> {
  const generation = activeSession().generation;
  const raw = await readBackupFile(file.uri);
  assertGeneration(generation);
  const currentFile = await rememberBackupFile(file.uri, file.addedAt);
  assertGeneration(generation);
  return { file: currentFile, ...raw };
}
