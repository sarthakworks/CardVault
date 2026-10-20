import type { SQLiteDatabase } from 'expo-sqlite';
import { VaultError } from '../errors/VaultError';

export async function migrate(database: SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA secure_delete = ON;');
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (row && row.user_version > 1) {
    throw new VaultError('format', 'This vault was created by a newer version of Cardvault.');
  }
  if (row?.user_version === 1) return;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(`
      CREATE TABLE vault (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        header TEXT NOT NULL,
        verifier TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision >= 0)
      );
      CREATE TABLE preferences (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  });
}
