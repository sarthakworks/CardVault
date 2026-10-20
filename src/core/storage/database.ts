import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrate } from './migrations';

let connection: Promise<SQLiteDatabase> | undefined;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!connection) {
    connection = openDatabaseAsync('cardvault.db').then(async (database) => {
      await migrate(database);
      return database;
    });
    connection.catch(() => { connection = undefined; });
  }
  return connection;
}
