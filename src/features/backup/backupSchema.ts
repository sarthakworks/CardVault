import { z } from 'zod';
import { headerSchema, sealedSchema } from '../../core/crypto/envelope';
import { snapshotSchema } from '../../core/vault/schemas';

export const backupSchema = z.strictObject({
  header: headerSchema.refine((header) => header.purpose === 'backup', 'Choose a Cardvault backup, not a local database.'),
  ciphertext: sealedSchema,
});

export const unencryptedBackupSchema = z.strictObject({
  format: z.literal('cardvault-unencrypted-backup'),
  version: z.literal(1),
  snapshot: snapshotSchema,
});

export const backupFileSchema = z.union([backupSchema, unencryptedBackupSchema]);
export type BackupFile = z.infer<typeof backupFileSchema>;
