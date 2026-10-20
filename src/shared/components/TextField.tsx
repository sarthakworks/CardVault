import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';

interface Props extends Omit<TextInputProps, 'ref'> {
  label?: string;
  error?: string;
  inSheet?: boolean;
}

export function TextField(
  { label, error, secureTextEntry, style, inSheet = false, ...props }: Props,
) {
  const { colors } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const Input = inSheet ? BottomSheetTextInput : TextInput;
  return (
    <View style={styles.group}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <View style={[styles.inputRow, {
        backgroundColor: colors.surfaceMuted,
        borderColor: error ? colors.danger : colors.border,
        alignItems: props.multiline ? 'flex-start' : 'center',
      }]}>
        <Input
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          importantForAutofill="no"
          autoCapitalize="none"
          contextMenuHidden
          disableFullscreenUI
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          {...props}
          secureTextEntry={secureTextEntry && !revealed}
          style={[styles.input, { color: colors.textPrimary }, style]}
        />
        {secureTextEntry ? (
          <Pressable accessibilityRole="button" accessibilityLabel={revealed ? 'Hide password' : 'Show password'} hitSlop={12} onPress={() => setRevealed(!revealed)} style={styles.eye}>
            <Feather name={revealed ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function SheetTextField(props: Omit<Props, 'inSheet'>) {
  return <TextField {...props} inSheet />;
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7 },
  inputRow: { borderWidth: 1, borderRadius: 14, flexDirection: 'row' },
  input: { minHeight: 52, paddingHorizontal: 15, paddingVertical: 14, fontSize: 15, flex: 1 },
  eye: { padding: 16 },
  error: { fontSize: 12, lineHeight: 18 },
});
