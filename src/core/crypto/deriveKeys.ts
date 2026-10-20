import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes } from '@noble/hashes/utils.js';
import { kdfSchema, type KdfParameters } from './envelope';
import { cryptoPolicy } from './cryptoPolicy';
import VaultSecurity from '../../../modules/vault-security';
import { VaultError } from '../errors/VaultError';

export interface DerivedKeys {
  payload: Uint8Array;
  verification: Uint8Array;
}

export async function deriveKeys(password: string, parameters: KdfParameters, purpose: 'local' | 'backup' = 'local'): Promise<DerivedKeys> {
  const kdf = kdfSchema.parse(parameters);
  const salt = hexToBytes(kdf.salt);
  let root: Uint8Array | undefined;
  try {
    root = hexToBytes(await VaultSecurity.deriveRootKey(password, kdf.salt, kdf.iterations));
    if (root.byteLength !== cryptoPolicy.keyBytes) throw new VaultError('format', 'The device returned an invalid derived key.');
    return {
      payload: hkdf(sha256, root, salt, new TextEncoder().encode(purpose === 'backup' ? 'cardvault/backup/v1' : 'cardvault/payload/v1'), 32),
      verification: hkdf(sha256, root, salt, new TextEncoder().encode('cardvault/verification/v1'), 32),
    };
  } finally {
    root?.fill(0);
  }
}

export function destroyKeys(keys: DerivedKeys): void {
  keys.payload.fill(0);
  keys.verification.fill(0);
}
