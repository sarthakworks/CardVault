import { getRandomBytes, randomUUID } from 'expo-crypto';
import { bytesToHex } from '@noble/hashes/utils.js';
import { z } from 'zod';
import { cryptoPolicy } from './cryptoPolicy';

export const kdfSchema = z.strictObject({
  name: z.literal('PBKDF2-HMAC-SHA256'),
  iterations: z.number().int().min(cryptoPolicy.iterations).max(cryptoPolicy.maximumIterations),
  salt: z.string().regex(/^[0-9a-f]{64}$/),
});

export const headerSchema = z.strictObject({
  magic: z.literal('CARDVAULT'),
  version: z.literal(1),
  purpose: z.enum(['local', 'backup']),
  cipher: z.literal('AES-256-GCM'),
  vaultId: z.uuid(),
  kdf: kdfSchema,
});

export const sealedSchema = z.string()
  .min(40)
  .max(cryptoPolicy.maximumFileBytes)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);

export type KdfParameters = z.infer<typeof kdfSchema>;
export type EnvelopeHeader = z.infer<typeof headerSchema>;

export function createHeader(purpose: EnvelopeHeader['purpose']): EnvelopeHeader {
  return {
    magic: 'CARDVAULT',
    version: 1,
    purpose,
    cipher: 'AES-256-GCM',
    vaultId: randomUUID(),
    kdf: {
      name: 'PBKDF2-HMAC-SHA256',
      iterations: cryptoPolicy.iterations,
      salt: bytesToHex(getRandomBytes(cryptoPolicy.saltBytes)),
    },
  };
}

export function authenticatedHeader(header: EnvelopeHeader, scope: string, revision: number): Uint8Array {
  return new TextEncoder().encode(JSON.stringify([
    header.magic, header.version, header.purpose, header.cipher,
    header.vaultId, header.kdf.name, header.kdf.iterations, header.kdf.salt,
    scope, revision,
  ]));
}
