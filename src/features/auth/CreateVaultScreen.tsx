import {useRef, useState, type ComponentRef} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Screen} from '../../shared/components/Screen';
import {BrandMark} from '../../shared/components/BrandMark';
import {TextField} from '../../shared/components/TextField';
import {Button} from '../../shared/components/Button';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {createMasterPassword} from './authService';
import {errorMessage} from '../../core/errors/VaultError';
import {cryptoPolicy} from '../../core/crypto/cryptoPolicy';

export function CreateVaultScreen() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmationInput = useRef<ComponentRef<typeof TextInput>>(null);
  const pending = useRef(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<{
    field: 'password' | 'confirmation' | 'form';
    message: string;
  }>();
  const [busy, setBusy] = useState(false);
  async function create() {
    if (pending.current) return;
    if (password.length < cryptoPolicy.minimumPasswordLength) {
      setError({
        field: 'password',
        message: `Use at least ${cryptoPolicy.minimumPasswordLength} characters.`,
      });
      passwordInput.current?.focus();
      return;
    }
    if (password !== confirmation) {
      setError({
        field: 'confirmation',
        message: 'Your passwords do not match. Try again.',
      });
      confirmationInput.current?.focus();
      return;
    }
    const submitted = password;
    pending.current = true;
    setPassword('');
    setConfirmation('');
    setBusy(true);
    setError(undefined);
    Keyboard.dismiss();
    try {
      await createMasterPassword(submitted);
    } catch (cause) {
      setError({field: 'form', message: errorMessage(cause)});
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {paddingBottom: Math.max(insets.bottom, 24)},
          ]}>
          <View style={styles.brand}>
            <View
              style={[
                styles.brandMark,
                {backgroundColor: colors.brandSurface},
              ]}>
              <BrandMark size={30} />
            </View>
            <Text style={[styles.brandName, {color: colors.textPrimary}]}>
              CARDVAULT
            </Text>
          </View>
          <View style={styles.body}>
            <View style={styles.intro}>
              <Text
                accessibilityRole="header"
                style={[styles.title, {color: colors.textPrimary}]}>
                Create your vault
              </Text>
              <Text
                style={[
                  typography.body,
                  styles.subtitle,
                  {color: colors.textSecondary},
                ]}>
                Your cards and notes, encrypted on this device.
              </Text>
            </View>
            <View style={styles.form}>
              <View style={styles.passwordGroup}>
                <TextField
                  label="Master password"
                  labelStyle={[styles.label, {color: colors.textPrimary}]}
                  accessibilityLabel="Master password"
                  accessibilityHint={`At least ${cryptoPolicy.minimumPasswordLength} characters. Longer passwords are safer.`}
                  inputRef={passwordInput}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  maxLength={256}
                  editable={!busy}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => confirmationInput.current?.focus()}
                  error={
                    error?.field === 'password' ? error.message : undefined
                  }
                />
                <Text style={[typography.small, {color: colors.textSecondary}]}>
                  {cryptoPolicy.minimumPasswordLength}+ characters. Longer is
                  safer.
                </Text>
              </View>
              <TextField
                label="Confirm password"
                labelStyle={[styles.label, {color: colors.textPrimary}]}
                accessibilityLabel="Confirm password"
                inputRef={confirmationInput}
                secureTextEntry
                value={confirmation}
                onChangeText={setConfirmation}
                maxLength={256}
                editable={!busy}
                returnKeyType="done"
                submitBehavior="submit"
                onSubmitEditing={() => {
                  void create();
                }}
                error={
                  error?.field === 'confirmation' ? error.message : undefined
                }
              />
              {error?.field === 'form' ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={[typography.small, {color: colors.danger}]}>
                  {error.message}
                </Text>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Button
                title={busy ? 'Creating vault' : 'Create vault'}
                loading={busy}
                onPress={() => {
                  void create();
                }}
              />
              <Text
                style={[
                  typography.small,
                  styles.recovery,
                  {color: colors.textSecondary},
                ]}>
                Keep your password safe. It can&apos;t be recovered.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {flexGrow: 1, paddingHorizontal: 28, paddingTop: 20},
  brand: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {...typography.eyebrow},
  body: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 28,
  },
  intro: {gap: 10},
  title: {...typography.hero},
  subtitle: {maxWidth: 310},
  form: {gap: 20},
  passwordGroup: {gap: 8},
  label: {fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0},
  actions: {gap: 14},
  recovery: {maxWidth: 300, alignSelf: 'center', textAlign: 'center'},
});
