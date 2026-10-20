import { z } from 'zod';
import { cardFieldLimits, networks } from '../validation/cardRules';

export const cardFieldsSchema = z.object({
  number: z.string().min(1, 'Card number is required.').max(cardFieldLimits.number),
  expiry: z.string().min(1, 'Expiry is required.').max(cardFieldLimits.expiry),
  cvv: z.string().min(1, 'Security code is required.').max(cardFieldLimits.cvv),
  holder: z.string().trim().min(1, 'Cardholder name is required.').max(80),
  bank: z.string().trim().min(1, 'Bank name is required.').max(60),
  network: z.enum(networks),
  owner: z.string().trim().min(1, 'Owner is required.').max(40),
});

export const cardInputSchema = cardFieldsSchema;
export const cardSchema = cardFieldsSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const noteFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Give your note a title.').max(120),
  category: z.string().trim().min(1, 'Add a category.').max(40),
  content: z.string().min(1, 'Your note is empty.').max(100_000, 'Keep each note below 100,000 characters.'),
});

export const noteSchema = noteFieldsSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const snapshotSchema = z.strictObject({
  version: z.literal(1),
  vaultId: z.uuid(),
  cards: z.array(cardSchema).max(5_000),
  notes: z.array(noteSchema).max(5_000),
}).superRefine((snapshot, context) => {
  const identifiers = [...snapshot.cards, ...snapshot.notes].map((record) => record.id);
  if (new Set(identifiers).size !== identifiers.length) {
    context.addIssue({ code: 'custom', message: 'The vault contains duplicate record identifiers.' });
  }
});

export const verifierSchema = z.strictObject({
  marker: z.literal('cardvault-verifier-v1'),
  vaultId: z.uuid(),
});
