import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cardExpiryError } from '../../core/validation/cardRules';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';

export function expiryPickerSelection(value: string, now = new Date()): { year: number; month: number | null } {
  const match = /^(0[1-9]|1[0-2])\/?(\d{2}|\d{4})$/.exec(value);
  const yearText = match?.[2];
  const monthText = match?.[1];
  const year = yearText ? yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText) : now.getFullYear();
  const month = monthText ? Number(monthText) : null;
  return {
    year: Math.max(year, now.getFullYear()),
    month: year < now.getFullYear() || (year === now.getFullYear() && month !== null && month < now.getMonth() + 1) ? null : month,
  };
}

export function pickerExpiryText(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}/${year >= 2000 && year <= 2099 ? String(year).slice(-2) : year}`;
}

export function CardExpiryPicker({ value, onClose, onSelect }: { value: string; onClose: () => void; onSelect: (value: string) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState(() => expiryPickerSelection(value));
  const [error, setError] = useState<string>();
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(2020, index, 1)));
  function moveYear(delta: number) {
    const year = selection.year + delta;
    setSelection({ year, month: year === now.getFullYear() && selection.month !== null && selection.month < now.getMonth() + 1 ? null : selection.month });
    setError(undefined);
  }
  function confirm() {
    if (selection.month === null) return;
    const expiry = pickerExpiryText(selection.year, selection.month);
    const message = cardExpiryError(expiry);
    if (message) { setError(message); return; }
    onSelect(expiry);
  }
  return (
    <Animated.View entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)} style={styles.overlay} accessibilityViewIsModal onAccessibilityEscape={onClose}>
      <Pressable accessible={false} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
      <View pointerEvents="box-none" style={[styles.alignment, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
        <Animated.View entering={FadeInDown.duration(180).reduceMotion(ReduceMotion.System)} style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Expiry date</Text>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Choose a month and year.</Text>
            <View style={styles.yearRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous year" accessibilityState={{ disabled: selection.year <= now.getFullYear() }} disabled={selection.year <= now.getFullYear()} onPress={() => moveYear(-1)} style={[styles.yearButton, { backgroundColor: colors.surfaceMuted, opacity: selection.year <= now.getFullYear() ? 0.3 : 1 }]}><Feather name="chevron-left" size={20} color={colors.textPrimary} accessible={false} /></Pressable>
              <Text accessibilityLiveRegion="polite" style={[styles.year, { color: colors.textPrimary }]}>{selection.year}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next year" accessibilityState={{ disabled: selection.year >= 2099 }} disabled={selection.year >= 2099} onPress={() => moveYear(1)} style={[styles.yearButton, { backgroundColor: colors.surfaceMuted, opacity: selection.year >= 2099 ? 0.3 : 1 }]}><Feather name="chevron-right" size={20} color={colors.textPrimary} accessible={false} /></Pressable>
            </View>
            <View style={styles.months}>
              {months.map((label, index) => {
                const disabled = selection.year === now.getFullYear() && index < now.getMonth();
                const selected = selection.month === index + 1;
                return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`${label} ${selection.year}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => { setSelection({ ...selection, month: index + 1 }); setError(undefined); }} style={({ pressed }) => [styles.month, { backgroundColor: selected ? colors.accent : colors.surfaceMuted, opacity: disabled ? 0.3 : pressed ? 0.75 : 1 }]}><Text style={[styles.monthLabel, { color: selected ? colors.onAccent : colors.textPrimary }]}>{label}</Text></Pressable>;
              })}
            </View>
            {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel expiry selection" onPress={onClose} style={({ pressed }) => [styles.action, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.75 : 1 }]}><Text style={[styles.actionText, { color: colors.textPrimary }]}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Use selected expiry date" accessibilityState={{ disabled: selection.month === null }} disabled={selection.month === null} onPress={confirm} style={({ pressed }) => [styles.action, { backgroundColor: colors.accent, opacity: selection.month === null ? 0.4 : pressed ? 0.8 : 1 }]}><Text style={[styles.actionText, { color: colors.onAccent }]}>Use date</Text></Pressable>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 30, elevation: 30 },
  alignment: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  panel: { width: '100%', maxWidth: 340, maxHeight: '100%', borderWidth: 1, borderRadius: 24, elevation: 20, shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: 22, paddingBottom: 8 },
  title: { ...typography.heading },
  caption: { ...typography.small, marginTop: 7, marginBottom: 12 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  yearButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  year: { fontSize: 23, fontWeight: '600', fontVariant: ['tabular-nums'] },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  month: { flexGrow: 1, flexBasis: '30%', minHeight: 46, paddingVertical: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  error: { ...typography.small, marginTop: 12 },
  actions: { padding: 22, paddingTop: 12, flexDirection: 'row', gap: 10 },
  action: { flex: 1, minHeight: 52, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { ...typography.label, textAlign: 'center' },
});
