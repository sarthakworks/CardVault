import {AppState, BackHandler} from 'react-native';
import VaultSecurity from '../../../modules/vault-security';
import {sessionKeyring} from './sessionKeyring';
import {useSessionStore} from './sessionStore';
import {reportError} from '../errors/noticeStore';

export function lockSession(): void {
  sessionKeyring.clear();
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
  let activitySessionId = VaultSecurity.getActivitySessionId();
  function restoreFocus() {
    const currentActivitySessionId = VaultSecurity.getActivitySessionId();
    if (activitySessionId !== currentActivitySessionId) {
      activitySessionId = currentActivitySessionId;
      lockSession();
    }
    onFocus();
  }
  const change = AppState.addEventListener('change', (state) => {
    if (state === 'active') restoreFocus();
    else void VaultSecurity.clearOwnedClipboard().catch(reportError);
  });
  const blur = AppState.addEventListener('blur', () => {
    void VaultSecurity.clearOwnedClipboard().catch(reportError);
  });
  const focus = AppState.addEventListener('focus', restoreFocus);
  const closed = VaultSecurity.addListener('onAppClosed', lockSession);
  const back = BackHandler.addEventListener('hardwareBackPress', () => {
    lockSession();
    BackHandler.exitApp();
    return true;
  });
  return () => {
    change.remove();
    blur.remove();
    focus.remove();
    closed.remove();
    back.remove();
  };
}
