import * as DocumentPicker from 'expo-document-picker';
import {File, FileMode} from 'expo-file-system';
import {cryptoPolicy} from '../../core/crypto/cryptoPolicy';
import {VaultError} from '../../core/errors/VaultError';
import {
  activeSession,
  assertGeneration,
} from '../../core/security/sessionStore';

export async function pickBackupFile(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const generation = activeSession().generation;
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: false,
  });
  if (result.canceled) return null;
  assertGeneration(generation);
  const asset = result.assets[0];
  if (
    !asset ||
    !asset.name.toLowerCase().endsWith('.vault') ||
    !/^(file|content):\/\//.test(asset.uri)
  ) {
    throw new VaultError(
      'format',
      'Choose a local file with the .vault extension.'
    );
  }
  return asset;
}

export async function readBackupFile(
  uri: string,
  knownSize?: number
): Promise<{text: string; byteLength: number}> {
  const generation = activeSession().generation;
  if (!/^(file|content):\/\//.test(uri))
    throw new VaultError('format', 'Choose a local backup file.');
  if (knownSize !== undefined && knownSize > cryptoPolicy.maximumFileBytes) {
    throw new VaultError('limit', 'Backup files must be 12 MB or smaller.');
  }
  let bytes: Uint8Array;
  try {
    const handle = new File(uri).open(FileMode.ReadOnly);
    try {
      bytes = await handle.readBytes(cryptoPolicy.maximumFileBytes + 1);
    } finally {
      handle.close();
    }
  } catch (cause) {
    throw new VaultError(
      'storage',
      'This file is unavailable. It may have moved or access may have expired. Use Open existing to select it again.',
      {cause}
    );
  }
  assertGeneration(generation);
  if (bytes.byteLength > cryptoPolicy.maximumFileBytes) {
    throw new VaultError('limit', 'Backup files must be 12 MB or smaller.');
  }
  try {
    return {
      text: new TextDecoder('utf-8', {fatal: true}).decode(bytes),
      byteLength: bytes.byteLength,
    };
  } catch (cause) {
    throw new VaultError(
      'format',
      'This backup is not a readable UTF-8 text file.',
      {cause}
    );
  }
}

export function rawTextBlocks(text: string): string[] {
  const blocks: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 2_048, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
    blocks.push(text.slice(start, end));
    start = end;
  }
  return blocks;
}
