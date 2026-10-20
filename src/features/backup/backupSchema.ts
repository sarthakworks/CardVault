import { z } from 'zod';
import { headerSchema, sealedSchema } from '../../core/crypto/envelope';

export const backupSchema = z.strictObject({
  header: headerSchema.refine((header) => header.purpose === 'backup', 'Choose a Cardvault backup, not a local database.'),
  ciphertext: sealedSchema,
});
