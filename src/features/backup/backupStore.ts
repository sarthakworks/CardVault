import { create } from 'zustand';

export const useBackupStore = create<{ pendingUri: string | null }>(() => ({ pendingUri: null }));
