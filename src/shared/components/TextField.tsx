import {useState, type ComponentRef, type ReactNode, type Ref} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';
import Feather from '@expo/vector-icons/Feather';
import {useTheme} from '../theme/ThemeProvider';
import {typography} from '../theme/typography';

interface Props extends Omit<TextInputProps, 'ref'> {
  label?: string;
  error?: string;
  inSheet?: boolean;
  variant?: 'filled' | 'plain' | 'soft';
  labelStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  rightAccessory?: ReactNode;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({
  label,
  error,
  secureTextEntry,
  style,
  inSheet = false,
  variant = 'filled',
  labelStyle,
  containerStyle,
  rightAccessory,
  inputRef,
  ...props
}: Props) {
  const {colors} = useTheme();
  const [revealed, setRevealed] = useState(false);
  const plain = variant === 'plain';
  const soft = variant === 'soft';
  const inputProps: TextInputProps = {
    autoCorrect: false,
    spellCheck: false,
    autoComplete: 'off',
    importantForAutofill: 'no',
    autoCapitalize: 'none',
    contextMenuHidden: true,
    disableFullscreenUI: true,
    underlineColorAndroid: 'transparent',
    placeholderTextColor: colors.textSecondary,
    selectionColor: colors.accent,
    ...props,
    secureTextEntry: secureTextEntry && !revealed,
    style: [
      styles.input,
      plain && styles.plainInput,
      {color: colors.textPrimary},
      style,
    ],
  };
  return (
    <View style={[styles.group, containerStyle]}>
      {label ? (
        <Text style={[styles.label, {color: colors.textSecondary}, labelStyle]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: plain ? 'transparent' : colors.surfaceMuted,
            borderColor: error ? colors.danger : colors.border,
            borderWidth: plain || (soft && !error) ? 0 : 1,
            flex: plain && props.multiline ? 1 : undefined,
            alignItems: props.multiline ? 'flex-start' : 'center',
          },
        ]}>
        {inSheet ? (
          <BottomSheetTextInput {...inputProps} />
        ) : (
          <TextInput ref={inputRef} {...inputProps} />
        )}
        {rightAccessory}
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={12}
            onPress={() => setRevealed(!revealed)}
            style={styles.eye}>
            <Feather
              name={revealed ? 'eye-off' : 'eye'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.error, {color: colors.danger}]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function SheetTextField(props: Omit<Props, 'inSheet' | 'inputRef'>) {
  return <TextField {...props} inSheet />;
}

const styles = StyleSheet.create({
  group: {gap: 8},
  label: {...typography.label},
  inputRow: {borderWidth: 1, borderRadius: 14, flexDirection: 'row'},
  input: {
    minHeight: 52,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    flex: 1,
  },
  plainInput: {paddingHorizontal: 0, paddingVertical: 0},
  eye: {padding: 16},
  error: {...typography.small},
});
