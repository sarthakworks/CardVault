import { useState } from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { VaultSnapshot } from '../../core/vault/models';
import { errorMessage, VaultError } from '../../core/errors/VaultError';
import { notify, reportError } from '../../core/errors/noticeStore';
import { Sheet } from '../../shared/components/Sheet';
import { SheetTextField as TextField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { createEncryptedExport, decryptPendingBackup, discardPendingImport, importDecryptedBackup, shareEncryptedExport } from './backupService';
import { ActionAuthorizationSheet } from '../auth/ActionAuthorizationSheet';
import type { Authorization } from '../../core/security/stepUpAuthorization';
import { cryptoPolicy } from '../../core/crypto/cryptoPolicy';

export function BackupPasswordSheet({ mode, onClose }: { mode: 'import' | 'export'; onClose: () => void }) {
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [preview, setPreview] = useState<VaultSnapshot | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function proceed() {
    setError(undefined);
    let submitted = password;
    let confirmed = confirmation;
    setPassword('');
    setConfirmation('');
    setBusy(true);
    try {
      if (mode === 'export') {
        const uri = await createEncryptedExport(submitted, confirmed);
        submitted = '';
        confirmed = '';
        await shareEncryptedExport(uri);
        notify('Encrypted backup prepared. Keep its password safe.');
        onClose();
      } else {
        const snapshot = await decryptPendingBackup(submitted);
        submitted = '';
        confirmed = '';
        setPreview(snapshot);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      submitted = '';
      setBusy(false);
    }
  }
  async function finishImport(authorization: Authorization) {
    if (!preview) throw new VaultError('authorization', 'Review and confirm the backup contents again.');
    setBusy(true);
    try {
      await importDecryptedBackup(preview, authorization);
      setConfirmImport(false);
      setPreview(null);
      onClose();
      try {
        discardPendingImport();
      } catch (cause) {
        reportError(new VaultError('storage', 'Records were imported, but encrypted cache cleanup failed. The file will be removed on the next launch.', { cause }));
        return;
      }
      notify('Your imported records are now encrypted in this vault.');
    } catch (cause) {
      reportError(cause);
      throw cause;
    } finally { setBusy(false); }
  }
  return (
    <>
    <Sheet visible onClose={onClose} title={mode === 'export' ? 'Take a safe copy.' : preview ? 'A new home for your records.' : 'Bring your vault along.'} subtitle={mode === 'export' ? 'Create a dedicated password for this backup. You will need the same password to import it.' : 'Enter the dedicated password used when this backup was exported.'} dismissible={!busy}>
      {preview ? (
        <>
          <View style={{ backgroundColor: colors.accentMuted, padding: 24, borderRadius: 20, gap: 10 }}>
            <Feather name="check-circle" size={30} color={colors.accent} />
            <Text style={[typography.title, { color: colors.textPrimary }]}>{preview.cards.length} cards / {preview.notes.length} notes</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>Added as new records. Nothing in your current vault will be replaced. Importing the same backup again creates duplicates.</Text>
          </View>
          <Button title="Merge into my vault" icon="download" loading={busy} onPress={() => setConfirmImport(true)} />
        </>
      ) : (
        <>
          <TextField label={mode === 'import' ? 'BACKUP PASSWORD' : `DEDICATED BACKUP PASSWORD (${cryptoPolicy.minimumPasswordLength}+ CHARACTERS)`} secureTextEntry value={password} onChangeText={setPassword} editable={!busy} maxLength={256} error={error} />
          {mode === 'export' ? <TextField label="CONFIRM BACKUP PASSWORD" secureTextEntry value={confirmation} onChangeText={setConfirmation} editable={!busy} maxLength={256} /> : null}
          <Text style={[typography.small, { color: colors.textSecondary }]}>{mode === 'export' ? 'Use a separate password, not your master password. Longer passwords are safer. It is never stored and cannot be recovered.' : 'Fingerprint cannot decrypt a backup file. Use the password that encrypted this file.'}</Text>
          <Button title={mode === 'export' ? 'Encrypt & share backup' : 'Decrypt backup'} icon={mode === 'export' ? 'upload' : 'unlock'} disabled={!password} loading={busy} onPress={() => void proceed()} />
        </>
      )}
      <Button title="Cancel" variant="ghost" disabled={busy} onPress={onClose} />
      <Text style={[typography.small, { color: colors.textSecondary }]}>Picking or sharing a file locks the vault. Unlock again and return to Settings to continue a selected import.</Text>
    </Sheet>
    <ActionAuthorizationSheet visible={confirmImport && preview !== null} operation="backup:import" onClose={() => setConfirmImport(false)} title="Save the imported records?" onAuthorized={finishImport} />
    </>
  );
}
