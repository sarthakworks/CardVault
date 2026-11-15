import { AppState } from 'react-native';
import VaultSecurity from '../../../modules/vault-security';
import { assertGeneration, useSessionStore } from './sessionStore';
import { VaultError } from '../errors/VaultError';

let promptGeneration: number | null = null;

function waitForBiometricFocus(generation: number): Promise<void> {
  assertGeneration(generation);
  if (AppState.currentState !== 'active') {
    return Promise.reject(new VaultError('locked', 'Return to Cardvault and unlock again.'));
  }
  if (VaultSecurity.isWindowFocused()) return Promise.resolve();

  // BiometricPrompt can resolve before Android has dismissed its window.
  return new Promise<void>((resolve, reject) => {
    let finished = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    const subscriptions: { remove(): void }[] = [];
    function finish(settle: () => void) {
      if (finished) return;
      finished = true;
      if (timeout !== undefined) clearTimeout(timeout);
      subscriptions.forEach((subscription) => subscription.remove());
      unsubscribe?.();
      settle();
    }
    function check() {
      try {
        assertGeneration(generation);
        if (AppState.currentState !== 'active') {
          finish(() => reject(new VaultError('locked', 'Return to Cardvault and unlock again.')));
        } else if (VaultSecurity.isWindowFocused()) {
          finish(resolve);
        }
      } catch (cause) {
        finish(() => reject(cause));
      }
    }
    subscriptions.push(AppState.addEventListener('focus', check), AppState.addEventListener('change', check));
    unsubscribe = useSessionStore.subscribe((state) => {
      if (state.generation !== generation) check();
    });
    timeout = setTimeout(() => {
      finish(() => reject(new VaultError('locked', 'Cardvault did not regain focus. Return to the app and try again.')));
    }, 3_000);
    check();
  });
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
      throw new VaultError('biometric', 'Return to Cardvault and try unlocking again.');
    }
    await waitForBiometricFocus(generation);
    return result;
  } finally {
    promptGeneration = null;
  }
}
