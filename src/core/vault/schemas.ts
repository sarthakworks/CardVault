import { z } from 'zod';
import { cardEntryLimits, cardExpiryError, cardFieldLimits } from '../validation/cardRules';

export const cardFieldsSchema = z.object({
  number: z.string().min(1, 'Card number is required.').max(cardFieldLimits.number),
  expiry: z.string().min(1, 'Expiry is required.').max(cardFieldLimits.expiry),
  cvv: z.string().min(1, 'Security code is required.').max(cardFieldLimits.cvv),
  holder: z.string().trim().min(1, 'Cardholder name is required.').max(80),
  bank: z.string().max(cardFieldLimits.bank).refine((value) => Boolean(value.trim()), 'Bank name is required.'),
  network: z.string().max(cardFieldLimits.network).refine((value) => Boolean(value.trim()), 'Network is required.'),
  type: z.string().max(cardFieldLimits.type).optional(),
  tier: z.string().max(cardFieldLimits.tier).optional(),
  country: z.string().max(cardFieldLimits.country).optional(),
});

export const cardInputSchema = cardFieldsSchema.extend({
  number: z.string()
    .min(cardEntryLimits.minimumNumberDigits, 'Card number must contain 13 to 19 digits.')
    .max(cardEntryLimits.maximumNumberDigits, 'Card number must contain 13 to 19 digits.')
    .regex(/^\d+$/, 'Use digits only for the card number.'),
  cvv: z.string()
    .min(cardEntryLimits.minimumCvvDigits, 'CVV must contain 3 or 4 digits.')
    .max(cardEntryLimits.maximumCvvDigits, 'CVV must contain 3 or 4 digits.')
    .regex(/^\d+$/, 'Use digits only for the CVV.'),
  expiry: cardFieldsSchema.shape.expiry.superRefine((value, context) => {
    const message = cardExpiryError(value);
    if (message) context.addIssue({ code: 'custom', message });
  }),
});

// Stored cards stay readable after expiry and across older, less restrictive app versions.
export const cardSchema = cardFieldsSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const noteFieldsSchema = z.object({
  title: z.string().trim().max(120, 'Keep the title below 120 characters.'),
  content: z.string().max(100_000, 'Keep each note below 100,000 characters.'),
}).refine((note) => Boolean(note.title.trim() || note.content.trim()), {
  path: ['content'],
  message: 'Add a title or some note text.',
});

export const noteSchema = noteFieldsSchema.safeExtend({
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
