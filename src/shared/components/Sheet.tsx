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
  scrollable?: boolean;
  onBack?: () => void;
}

export function Sheet({ visible, ...props }: Props) {
  return visible ? <SheetContent {...props} /> : null;
}

function SheetContent({ onClose, title, subtitle, children, dismissible = true, height = '92%', scrollable = true, onBack }: Omit<Props, 'visible'>) {
  const { colors } = useTheme();
  const reference = useRef<BottomSheetModal>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    reference.current?.present();
  }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dismissible) {
        Keyboard.dismiss();
        if (onBack) onBack();
        else reference.current?.dismiss();
      }
      return true;
    });
    return () => subscription.remove();
  }, [dismissible, onBack]);
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} pressBehavior="none" />, []);
  const heading = (
    <View style={[styles.header, !scrollable && styles.fixedHeader]}>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[typography.body, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
  return (
    <BottomSheetModal
      ref={reference}
      stackBehavior="push"
      snapPoints={[height]}
      enableDynamicSizing={false}
      enablePanDownToClose={dismissible}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={dismissible}
      onDismiss={() => { if (mounted.current) onClose(); }}
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 36 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustResize"
    >
      {scrollable ? (
        <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {heading}
          {children}
        </BottomSheetScrollView>
      ) : <View style={styles.fixedContent}>{heading}{children}</View>}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 50, gap: 20 },
  header: { gap: 8, marginBottom: 4 },
  fixedContent: { flex: 1 },
  fixedHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
});
