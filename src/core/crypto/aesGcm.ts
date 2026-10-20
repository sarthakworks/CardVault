import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytes } from 'expo-crypto';
import { authenticatedHeader, sealedSchema, type EnvelopeHeader } from './envelope';
import { cryptoPolicy } from './cryptoPolicy';
import { VaultError } from '../errors/VaultError';

export async function seal(
  payload: unknown,
  keyBytes: Uint8Array,
  header: EnvelopeHeader,
  scope: string,
  revision = 0,
): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  try {
    if (plaintext.byteLength > cryptoPolicy.maximumPayloadBytes) {
      throw new VaultError('limit', 'Your vault exceeds the 8 MB limit. Remove some content before saving.');
    }
    const key = await AESEncryptionKey.import(keyBytes);
    const encrypted = await aesEncryptAsync(plaintext, key, {
      nonce: { bytes: getRandomBytes(cryptoPolicy.nonceBytes) },
      tagLength: cryptoPolicy.tagBytes,
      additionalData: authenticatedHeader(header, scope, revision),
    });
    return await encrypted.combined('base64');
  } finally {
    plaintext.fill(0);
  }
}

export async function unseal(
  ciphertext: string,
  keyBytes: Uint8Array,
  header: EnvelopeHeader,
  scope: string,
  revision = 0,
): Promise<unknown> {
  sealedSchema.parse(ciphertext);
  const key = await AESEncryptionKey.import(keyBytes);
  const sealed = AESSealedData.fromCombined(ciphertext, {
    ivLength: cryptoPolicy.nonceBytes,
    tagLength: cryptoPolicy.tagBytes,
  });
  let plaintext: Uint8Array;
  try {
    plaintext = await aesDecryptAsync(sealed, key, {
      output: 'bytes',
      additionalData: authenticatedHeader(header, scope, revision),
    });
  } catch (cause) {
    throw new VaultError('password', 'The password is incorrect or the encrypted data is damaged.', { cause });
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
  } finally {
    plaintext.fill(0);
  }
}
