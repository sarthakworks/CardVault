import type { z } from 'zod';
import type { cardInputSchema, cardSchema, noteFieldsSchema, noteSchema, snapshotSchema } from './schemas';

export type VaultCard = z.infer<typeof cardSchema>;
export type CardInput = z.infer<typeof cardInputSchema>;
export type SecureNote = z.infer<typeof noteSchema>;
export type NoteInput = z.infer<typeof noteFieldsSchema>;
export type VaultSnapshot = z.infer<typeof snapshotSchema>;
