import { AppState } from 'react-native';
import VaultSecurity from '../../../modules/vault-security';
import { sessionKeyring } from './sessionKeyring';
import { useSessionStore } from './sessionStore';
import { clearAuthorizations } from './stepUpAuthorization';
import { reportError } from '../errors/noticeStore';
import { hasActiveBiometricPrompt } from './biometricPrompt';

export function lockSession(): void {
  sessionKeyring.clear();
  clearAuthorizations();
  useSessionStore.setState((state) => ({
    status: state.header ? 'locked' : state.status,
    snapshot: null,
    drafts: {},
    revision: 0,
    generation: state.generation + 1,
  }));
  void VaultSecurity.clearOwnedClipboard().catch(reportError);
}

export function watchSessionLifecycle(onFocus: () => void): () => void {
  const change = AppState.addEventListener('change', (state) => {
    if (state !== 'active') lockSession();
    else onFocus();
  });
  const blur = AppState.addEventListener('blur', () => {
    if (useSessionStore.getState().status === 'unlocked' && !hasActiveBiometricPrompt()) lockSession();
  });
  const focus = AppState.addEventListener('focus', onFocus);
  return () => {
    change.remove();
    blur.remove();
    focus.remove();
  };
}
