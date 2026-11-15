import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '../../core/errors/VaultError';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';
import { Button } from './Button';

interface Confirmation {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  itemTitle: string;
  itemDescription: string;
  itemIcon: 'credit-card' | 'file-text';
  onConfirm: () => void | Promise<void>;
}

const ConfirmationContext = createContext<((confirmation: Confirmation) => void) | null>(null);

export function useConfirmation() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error('ConfirmationProvider is missing.');
  return confirm;
}

function ConfirmationDialog({ confirmation, busy, error, onConfirm, onClose }: {
  confirmation: Confirmation;
  busy: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose]);
  return (
    <Animated.View entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)} style={styles.overlay} accessibilityViewIsModal onAccessibilityEscape={onClose}>
      <Pressable accessible={false} disabled={busy} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
      <View pointerEvents="box-none" style={[styles.alignment, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}>
        <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)} style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: dark ? '#000000' : colors.textPrimary }]}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={[styles.emblem, { backgroundColor: colors.dangerMuted }]}><Feather name="trash-2" size={25} color={colors.danger} accessible={false} /></View>
            <View style={styles.copy}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{confirmation.title}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{confirmation.description}</Text>
            </View>
            <View style={[styles.preview, { backgroundColor: colors.surfaceMuted }]}>
              <View style={[styles.previewIcon, { backgroundColor: colors.surface }]}><Feather name={confirmation.itemIcon} size={20} color={colors.textSecondary} accessible={false} /></View>
              <View style={styles.previewText}>
                <Text numberOfLines={2} style={[styles.itemTitle, { color: colors.textPrimary }]}>{confirmation.itemTitle}</Text>
                <Text numberOfLines={2} style={[styles.itemDescription, { color: colors.textSecondary }]}>{confirmation.itemDescription}</Text>
              </View>
            </View>
            {error ? <View style={styles.copy}><Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.error, { color: colors.danger }]}>{error}</Text><Text style={[styles.retry, { color: colors.textSecondary }]}>Try again, or cancel to return.</Text></View> : null}
          </ScrollView>
          <View style={styles.actions}>
            <View style={[styles.action, { flexBasis: 150 * fontScale }]}><Button title={confirmation.cancelLabel} variant="secondary" disabled={busy} onPress={onClose} /></View>
            <View style={[styles.action, { flexBasis: 150 * fontScale }]}><Button title={confirmation.confirmLabel} variant="danger" loading={busy} onPress={onConfirm} /></View>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export function ConfirmationProvider({ children }: PropsWithChildren) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef(false);
  const request = useCallback((value: Confirmation) => {
    if (pending.current) return;
    Keyboard.dismiss();
    setError(undefined);
    setConfirmation(value);
  }, []);
  const close = useCallback(() => {
    if (pending.current) return;
    setConfirmation(null);
    setError(undefined);
  }, []);
  async function confirm() {
    if (!confirmation || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await confirmation.onConfirm();
      setConfirmation(null);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return (
    <ConfirmationContext.Provider value={request}>
      <View style={styles.container}>
        <View style={styles.container} pointerEvents={confirmation ? 'none' : 'auto'} accessibilityElementsHidden={confirmation !== null} importantForAccessibility={confirmation ? 'no-hide-descendants' : 'auto'}>{children}</View>
        {confirmation ? <ConfirmationDialog confirmation={confirmation} busy={busy} error={error} onConfirm={() => { void confirm(); }} onClose={close} /> : null}
      </View>
    </ConfirmationContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 100, elevation: 100 },
  alignment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: 380, maxHeight: '100%', borderRadius: 28, borderWidth: 1, shadowOpacity: 0.18, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 20 },
  scroll: { flexGrow: 0, flexShrink: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  content: { padding: 24, gap: 20 },
  emblem: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: 9 },
  title: { ...typography.title },
  description: { ...typography.body },
  preview: { padding: 13, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewIcon: { width: 40, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewText: { flex: 1, minWidth: 0, gap: 5 },
  itemTitle: { ...typography.label },
  itemDescription: { ...typography.small },
  error: { ...typography.small },
  retry: { ...typography.small },
  actions: { paddingHorizontal: 24, paddingBottom: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { flexGrow: 1, flexShrink: 1, maxWidth: '100%' },
});
