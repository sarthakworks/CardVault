import { create } from 'zustand';
import { errorMessage } from './VaultError';

interface NoticeState {
  message: string | null;
  kind: 'error' | 'success';
}

export const useNoticeStore = create<NoticeState>(() => ({ message: null, kind: 'success' }));

export function notify(message: string): void {
  useNoticeStore.setState({ message, kind: 'success' });
}

export function reportError(error: unknown): void {
  useNoticeStore.setState({ message: errorMessage(error), kind: 'error' });
}
