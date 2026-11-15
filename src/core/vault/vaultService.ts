import { randomUUID } from 'expo-crypto';
import { seal } from '../crypto/aesGcm';
import { saveVaultCiphertext } from '../storage/vaultRepository';
import { activeSession, assertGeneration, discardSessionDraft, useSessionStore } from '../security/sessionStore';
import { cardInputSchema, noteFieldsSchema, snapshotSchema } from './schemas';
import type { CardInput, NoteInput, VaultSnapshot } from './models';
import { VaultError } from '../errors/VaultError';

let mutationTail: Promise<void> = Promise.resolve();

function mutate(transform: (snapshot: VaultSnapshot) => VaultSnapshot): Promise<void> {
  const generation = activeSession().generation;
  const operation = mutationTail.then(async () => {
    assertGeneration(generation);
    const session = activeSession();
    const snapshot = snapshotSchema.parse(transform(session.snapshot));
    const ciphertext = await seal(snapshot, session.key, session.header, 'payload', session.revision + 1);
    assertGeneration(generation);
    await saveVaultCiphertext(ciphertext, session.revision);
    if (useSessionStore.getState().generation === generation) {
      useSessionStore.setState({ snapshot, revision: session.revision + 1 });
    }
  });
  mutationTail = operation.then(() => undefined, () => undefined);
  return operation;
}

export const vaultService = {
  addCard(input: CardInput): Promise<void> {
    const fields = cardInputSchema.parse(input);
    return mutate((snapshot) => {
      const now = new Date().toISOString();
      return { ...snapshot, cards: [{ ...fields, id: randomUUID(), createdAt: now, updatedAt: now }, ...snapshot.cards] };
    });
  },
  updateCard(id: string, input: CardInput): Promise<void> {
    const fields = cardInputSchema.parse(input);
    return mutate((snapshot) => {
      if (!snapshot.cards.some((card) => card.id === id)) throw new VaultError('conflict', 'This card no longer exists.');
      return { ...snapshot, cards: snapshot.cards.map((card) => card.id === id ? { ...card, ...fields, updatedAt: new Date().toISOString() } : card) };
    });
  },
  deleteCard(id: string): Promise<void> {
    const generation = activeSession().generation;
    return mutate((snapshot) => {
      if (!snapshot.cards.some((card) => card.id === id)) throw new VaultError('conflict', 'This card no longer exists.');
      return { ...snapshot, cards: snapshot.cards.filter((card) => card.id !== id) };
    }).then(() => discardSessionDraft(`card:${id}`, generation));
  },
  addNote(input: NoteInput): Promise<void> {
    const fields = noteFieldsSchema.parse(input);
    return mutate((snapshot) => {
      const now = new Date().toISOString();
      return { ...snapshot, notes: [{ ...fields, id: randomUUID(), createdAt: now, updatedAt: now }, ...snapshot.notes] };
    });
  },
  updateNote(id: string, input: NoteInput): Promise<void> {
    const fields = noteFieldsSchema.parse(input);
    return mutate((snapshot) => {
      if (!snapshot.notes.some((note) => note.id === id)) throw new VaultError('conflict', 'This note no longer exists.');
      return { ...snapshot, notes: snapshot.notes.map((note) => note.id === id ? { ...note, ...fields, updatedAt: new Date().toISOString() } : note) };
    });
  },
  deleteNote(id: string): Promise<void> {
    const generation = activeSession().generation;
    return mutate((snapshot) => {
      if (!snapshot.notes.some((note) => note.id === id)) throw new VaultError('conflict', 'This note no longer exists.');
      return { ...snapshot, notes: snapshot.notes.filter((note) => note.id !== id) };
    }).then(() => discardSessionDraft(`note:${id}`, generation));
  },
  importSnapshot(imported: VaultSnapshot): Promise<void> {
    const incoming = snapshotSchema.parse(imported);
    return mutate((snapshot) => {
      return {
        ...snapshot,
        cards: [...incoming.cards.map((card) => ({ ...card, id: randomUUID() })), ...snapshot.cards],
        notes: [...incoming.notes.map((note) => ({ ...note, id: randomUUID() })), ...snapshot.notes],
      };
    });
  },
};
