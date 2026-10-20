import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

export function useHaptics() {
  return useCallback(() => {
    void Haptics.selectionAsync().catch(() => console.warn('Haptic feedback is unavailable on this device.'));
  }, []);
}
