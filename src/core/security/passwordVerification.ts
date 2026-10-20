import { deriveKeys, destroyKeys, type DerivedKeys } from '../crypto/deriveKeys';
import { unseal } from '../crypto/aesGcm';
import { readVault, type EncryptedVault } from '../storage/vaultRepository';
import { verifierSchema } from '../vault/schemas';
import { VaultError } from '../errors/VaultError';

export async function verifiedKeys(password: string, record?: EncryptedVault): Promise<DerivedKeys> {
  const vault = record ?? await readVault();
  if (!vault) throw new VaultError('storage', 'Your vault could not be found.');
  const keys = await deriveKeys(password, vault.header.kdf);
  try {
    const verifier = verifierSchema.parse(await unseal(vault.verifier, keys.verification, vault.header, 'verifier'));
    if (verifier.vaultId !== vault.header.vaultId) {
      throw new VaultError('format', 'The vault verification data does not match.');
    }
    return keys;
  } catch (error) {
    destroyKeys(keys);
    throw error;
  }
}
