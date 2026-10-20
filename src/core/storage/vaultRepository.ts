import { z } from 'zod';
import { getDatabase } from './database';
import { headerSchema, sealedSchema, type EnvelopeHeader } from '../crypto/envelope';
import { VaultError } from '../errors/VaultError';

interface VaultRow {
  header: string;
  verifier: string;
  ciphertext: string;
  revision: number;
}

export interface EncryptedVault {
  header: EnvelopeHeader;
  verifier: string;
  ciphertext: string;
  revision: number;
}

export async function readVault(): Promise<EncryptedVault | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<VaultRow>('SELECT header, verifier, ciphertext, revision FROM vault WHERE id = 1');
  if (!row) return null;
  const header = headerSchema.parse(JSON.parse(row.header));
  if (header.purpose !== 'local') throw new VaultError('format', 'This is not a local vault.');
  return {
    header,
    verifier: sealedSchema.parse(row.verifier),
    ciphertext: sealedSchema.parse(row.ciphertext),
    revision: z.number().int().nonnegative().parse(row.revision),
  };
}

export async function createVault(record: EncryptedVault): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'INSERT INTO vault (id, header, verifier, ciphertext, revision) VALUES (1, ?, ?, ?, ?)',
      JSON.stringify(record.header), record.verifier, record.ciphertext, record.revision,
    );
  });
}

export async function saveVaultCiphertext(ciphertext: string, expectedRevision: number): Promise<void> {
  sealedSchema.parse(ciphertext);
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      'UPDATE vault SET ciphertext = ?, revision = ? WHERE id = 1 AND revision = ?',
      ciphertext, expectedRevision + 1, expectedRevision,
    );
    if (result.changes !== 1) throw new VaultError('conflict', 'Your vault changed. Lock and unlock it before trying again.');
  });
}
