import { AppState } from 'react-native';
import { assertGeneration, useSessionStore } from './sessionStore';
import { VaultError } from '../errors/VaultError';

let promptGeneration: number | null = null;

export function hasActiveBiometricPrompt(): boolean {
  return promptGeneration !== null
    && promptGeneration === useSessionStore.getState().generation
    && AppState.currentState === 'active';
}

export async function runBiometricPrompt<T>(request: () => Promise<T>): Promise<T> {
  if (promptGeneration !== null) {
    throw new VaultError('biometric', 'Finish the current fingerprint prompt before trying again.');
  }
  if (AppState.currentState !== 'active') {
    throw new VaultError('locked', 'Return to Cardvault to authenticate.');
  }
  const generation = useSessionStore.getState().generation;
  promptGeneration = generation;
  try {
    const result = await request();
    assertGeneration(generation);
    if (AppState.currentState !== 'active') {
      throw new VaultError('locked', 'Your vault locked. Unlock it to try again.');
    }
    return result;
  } finally {
    promptGeneration = null;
  }
}
