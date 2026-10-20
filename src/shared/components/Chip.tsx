import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useHaptics } from '../hooks/useHaptics';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const haptic = useHaptics();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => { haptic(); onPress(); }}
      style={[styles.chip, { backgroundColor: selected ? colors.textPrimary : colors.surface, borderColor: selected ? colors.textPrimary : colors.border }]}
    >
      <Text style={[styles.text, { color: selected ? colors.background : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 40, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  text: { fontSize: 12, fontWeight: '600' },
});
