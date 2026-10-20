import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../../shared/components/Screen';
import { TextField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { createMasterPassword } from './authService';
import { errorMessage } from '../../core/errors/VaultError';
import { cryptoPolicy } from '../../core/crypto/cryptoPolicy';

export function CreateVaultScreen() {
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function create() {
    if (password.length < cryptoPolicy.minimumPasswordLength) { setError(`Use at least ${cryptoPolicy.minimumPasswordLength} characters. A longer passphrase is safer.`); return; }
    if (password !== confirmation) { setError('Your passwords do not match.'); return; }
    const submitted = password;
    setPassword('');
    setConfirmation('');
    setBusy(true);
    setError(undefined);
    try { await createMasterPassword(submitted); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return (
    <Screen>
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={[typography.eyebrow, { color: colors.textPrimary }]}>CARDVAULT / PRIVATE BY DESIGN</Text>
          <View style={styles.art}>
            <View style={[styles.artHalo, { borderColor: colors.border }]} />
            <LinearGradient colors={['#314A75', '#13223A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.artCard}>
              <Feather name="shield" size={32} color="#D7E5FF" />
              <View style={styles.artLines}><View style={styles.artLine} /><View style={[styles.artLine, { width: 46 }]} /></View>
              <Text style={[typography.eyebrow, { color: '#D7E5FF', letterSpacing: 3 }]}>YOURS. ONLY YOURS.</Text>
            </LinearGradient>
            <View style={[styles.lockBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}><Feather name="lock" size={24} color={colors.accent} /></View>
          </View>
          <View style={{ gap: 12 }}>
            <Text style={[typography.hero, { color: colors.textPrimary }]}>A little space.{'\n'}Just for you.</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>Your cards and private notes, beautifully kept. Encrypted on your device. Never in a cloud.</Text>
          </View>
          <View style={styles.promises}>
            {['100% offline', 'AES-256 encrypted', 'No account'].map((label) => <View key={label} style={styles.promise}><Feather name="check" size={12} color={colors.success} /><Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '600' }}>{label}</Text></View>)}
          </View>
          <TextField label={`CREATE MASTER PASSWORD (${cryptoPolicy.minimumPasswordLength}+ CHARACTERS)`} secureTextEntry value={password} onChangeText={setPassword} placeholder="A strong, memorable passphrase" maxLength={256} editable={!busy} />
          <Text style={[typography.small, { color: colors.textSecondary }]}>Longer passphrases provide stronger protection against guessing.</Text>
          <TextField label="CONFIRM MASTER PASSWORD" secureTextEntry value={confirmation} onChangeText={setConfirmation} placeholder="Enter it once more" maxLength={256} editable={!busy} error={error} />
          <Button title={busy ? 'Creating your private vault' : 'Create my vault'} icon="arrow-right" loading={busy} onPress={() => void create()} />
          <View style={[styles.warning, { borderColor: colors.border }]}><Feather name="info" size={16} color={colors.textSecondary} /><Text style={[typography.small, { color: colors.textSecondary, flex: 1 }]}>There is no password recovery. Keep your master password safe, and export encrypted backups regularly.</Text></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 28, paddingTop: 22, paddingBottom: 40, gap: 20 },
  art: { height: 220, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  artHalo: { position: 'absolute', width: 215, height: 215, borderRadius: 110, borderWidth: 1 },
  artCard: { width: 240, height: 150, borderRadius: 22, padding: 23, justifyContent: 'space-between', transform: [{ rotate: '-11deg' }], elevation: 12 },
  artLines: { gap: 8 },
  artLine: { height: 5, width: 112, backgroundColor: '#FFFFFF40', borderRadius: 3 },
  lockBadge: { position: 'absolute', right: 28, bottom: 16, width: 65, height: 65, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  promises: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 4 },
  promise: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  warning: { borderTopWidth: 1, paddingTop: 18, flexDirection: 'row', gap: 10 },
});
