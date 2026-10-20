import { useCallback, useEffect, useRef, type PropsWithChildren } from 'react';
import { BackHandler, Keyboard, StyleSheet, Text, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

interface Props extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  dismissible?: boolean;
  height?: string;
}

export function Sheet({ visible, onClose, title, subtitle, children, dismissible = true, height = '92%' }: Props) {
  const { colors } = useTheme();
  const reference = useRef<BottomSheetModal>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (visible) reference.current?.present();
    else reference.current?.dismiss();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dismissible) {
        Keyboard.dismiss();
        reference.current?.dismiss();
      }
      return true;
    });
    return () => subscription.remove();
  }, [visible, dismissible]);
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} pressBehavior="none" />, []);
  return (
    <BottomSheetModal
      ref={reference}
      stackBehavior="push"
      snapPoints={[height]}
      enableDynamicSizing={false}
      enablePanDownToClose={dismissible}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={dismissible}
      onDismiss={() => { if (mounted.current && visible) onClose(); }}
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 36 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[typography.title, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[typography.body, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 50, gap: 20 },
  header: { gap: 7, marginBottom: 4 },
});
