import { VaultError } from '../errors/VaultError';

let sessionKey: Uint8Array | null = null;

export const sessionKeyring = {
  install(key: Uint8Array): void {
    sessionKeyring.clear();
    sessionKey = new Uint8Array(key);
  },
  get(): Uint8Array {
    if (!sessionKey) throw new VaultError('locked', 'Unlock your vault to continue.');
    return sessionKey;
  },
  clear(): void {
    sessionKey?.fill(0);
    sessionKey = null;
  },
};
