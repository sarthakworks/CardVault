import { create } from 'zustand';
import type { EnvelopeHeader } from '../crypto/envelope';
import type { CardInput, NoteInput, VaultSnapshot } from '../vault/models';
import { VaultError } from '../errors/VaultError';
import { sessionKeyring } from './sessionKeyring';

type SessionDraft =
  | { kind: 'card'; values: CardInput }
  | { kind: 'note'; values: NoteInput };

interface SessionState {
  status: 'booting' | 'setup' | 'locked' | 'unlocked' | 'failed';
  header: EnvelopeHeader | null;
  snapshot: VaultSnapshot | null;
  revision: number;
  generation: number;
  error: string | null;
  drafts: Record<string, SessionDraft>;
}

export const useSessionStore = create<SessionState>(() => ({
  status: 'booting',
  header: null,
  snapshot: null,
  revision: 0,
  generation: 0,
  error: null,
  drafts: {},
}));

export function keepSessionDraft(key: string, draft: SessionDraft, generation: number): void {
  useSessionStore.setState((state) => {
    if (state.status !== 'unlocked' || state.generation !== generation) return state;
    const copy: SessionDraft = draft.kind === 'card'
      ? { kind: 'card', values: { ...draft.values } }
      : { kind: 'note', values: { ...draft.values } };
    return { drafts: { ...state.drafts, [key]: copy } };
  });
}

export function discardSessionDraft(key: string, generation: number): void {
  useSessionStore.setState((state) => {
    if (state.status !== 'unlocked' || state.generation !== generation || !(key in state.drafts)) return state;
    const drafts = { ...state.drafts };
    delete drafts[key];
    return { drafts };
  });
}

export function assertGeneration(generation: number): void {
  if (useSessionStore.getState().generation !== generation) {
    throw new VaultError('locked', 'Your vault locked. Unlock it to try again.');
  }
}

export function activeSession() {
  const state = useSessionStore.getState();
  if (state.status !== 'unlocked' || !state.header || !state.snapshot) {
    throw new VaultError('locked', 'Unlock your vault to continue.');
  }
  return { ...state, header: state.header, snapshot: state.snapshot, key: sessionKeyring.get() };
}
