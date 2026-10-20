import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { useHaptics } from '../hooks/useHaptics';

interface Props {
  title: string;
  onPress: () => void;
  icon?: ComponentProps<typeof Feather>['name'];
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ title, onPress, icon, variant = 'primary', loading = false, disabled = false }: Props) {
  const { colors } = useTheme();
  const haptic = useHaptics();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const muted = variant === 'secondary' || variant === 'ghost';
  const foreground = muted ? colors.textPrimary : variant === 'danger' ? colors.danger : colors.onAccent;
  const background = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.dangerMuted : variant === 'ghost' ? 'transparent' : colors.surfaceMuted;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPressIn={() => { scale.set(withTiming(0.975, { duration: 100 })); }}
      onPressOut={() => { scale.set(withTiming(1, { duration: 160 })); }}
      onPress={() => { haptic(); onPress(); }}
      style={[styles.button, { backgroundColor: background, opacity: disabled ? 0.5 : 1 }, animated]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : icon ? <Feather name={icon} size={18} color={foreground} /> : null}
      <Text style={[styles.label, { color: foreground }]}>{title}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 16, paddingHorizontal: 20, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
});
