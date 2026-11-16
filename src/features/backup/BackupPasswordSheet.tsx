import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type {VaultSnapshot} from '../../core/vault/models';
import {errorMessage, VaultError} from '../../core/errors/VaultError';
import {notify, reportError} from '../../core/errors/noticeStore';
import {Sheet} from '../../shared/components/Sheet';
import {SheetTextField as TextField} from '../../shared/components/TextField';
import {Button} from '../../shared/components/Button';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {
  createEncryptedExport,
  createUnencryptedExport,
  decryptPendingBackup,
  discardPendingImport,
  importDecryptedBackup,
  saveBackupExport,
  shareBackupExport,
  type PreparedBackup,
} from './backupService';
import {cryptoPolicy} from '../../core/crypto/cryptoPolicy';

export function BackupPasswordSheet({
  mode,
  initialSnapshot,
  onClose,
}: {
  mode: 'import' | 'export';
  initialSnapshot?: VaultSnapshot;
  onClose: () => void;
}) {
  const {colors} = useTheme();
  const [password, setPassword] = useState('');
  const [unencrypted, setUnencrypted] = useState(false);
  const [prepared, setPrepared] = useState<PreparedBackup | null>(null);
  const [preview, setPreview] = useState<VaultSnapshot | null>(
    initialSnapshot ?? null
  );
  const [busy, setBusy] = useState<
    'prepare' | 'save' | 'share' | 'import' | null
  >(null);
  const [error, setError] = useState<string>();
  async function proceed() {
    if (busy) return;
    setError(undefined);
    let submitted = password;
    setPassword('');
    setBusy('prepare');
    try {
      if (mode === 'export') {
        setPrepared(
          unencrypted
            ? createUnencryptedExport()
            : await createEncryptedExport(submitted)
        );
      } else {
        const snapshot = await decryptPendingBackup(submitted);
        setPreview(snapshot);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      submitted = '';
      setBusy(null);
    }
  }
  async function finishExport(destination: 'save' | 'share') {
    if (busy || !prepared) return;
    setError(undefined);
    setBusy(destination);
    try {
      if (destination === 'save') {
        if (!(await saveBackupExport(prepared))) return;
        notify(
          prepared.encrypted
            ? 'Encrypted backup saved. Keep its password safe.'
            : 'Unencrypted backup saved. Store it privately.'
        );
      } else {
        await shareBackupExport(prepared);
        notify(
          prepared.encrypted
            ? 'Encrypted backup ready to share. Keep its password safe.'
            : 'Unencrypted backup ready to share. Anyone with the file can read it.'
        );
      }
      setPrepared(null);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }
  async function finishImport() {
    if (busy) return;
    setError(undefined);
    setBusy('import');
    try {
      if (!preview)
        throw new VaultError(
          'conflict',
          'Review the backup contents again before merging.'
        );
      await importDecryptedBackup(preview);
      setPreview(null);
      onClose();
      try {
        discardPendingImport();
      } catch (cause) {
        reportError(
          new VaultError(
            'storage',
            'Records were imported, but encrypted cache cleanup failed. The file will be removed on the next launch.',
            {cause}
          )
        );
        return;
      }
      notify('Your imported records are now encrypted in this vault.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }
  const errorNotice = error ? (
    <Text
      accessibilityRole="alert"
      style={[typography.small, {color: colors.danger}]}>
      {error}
    </Text>
  ) : null;
  const subtitle = prepared
    ? 'Save to Downloads or another location in the file manager, or share via an app.'
    : preview
      ? initialSnapshot
        ? 'This unencrypted backup needs no password. Review its contents before merging.'
        : 'Review the decrypted backup before merging.'
      : mode === 'export'
        ? unencrypted
          ? 'No password is needed. Anyone with this file can read every card and note.'
          : 'Create a dedicated password for this backup. You will need the same password to import it.'
        : 'Enter the dedicated password used when this backup was exported.';
  return (
    <Sheet
      visible
      onClose={onClose}
      title={
        prepared
          ? 'Save your backup.'
          : mode === 'export'
            ? 'Take a safe copy.'
            : preview
              ? 'A new home for your records.'
              : 'Bring your vault along.'
      }
      subtitle={subtitle}
      dismissible={busy === null}>
      {prepared ? (
        <>
          <View
            style={{
              backgroundColor: prepared.encrypted
                ? colors.accentMuted
                : colors.dangerMuted,
              padding: 20,
              borderRadius: 20,
              gap: 10,
            }}>
            <Feather
              name={prepared.encrypted ? 'lock' : 'alert-triangle'}
              size={26}
              color={prepared.encrypted ? colors.accent : colors.danger}
            />
            <Text style={[typography.body, {color: colors.textPrimary}]}>
              {prepared.encrypted
                ? 'Your password-protected .vault backup is ready.'
                : 'This .vault backup is NOT encrypted. It exposes full card numbers, security codes, and note text. Anyone with it can read or change it.'}
            </Text>
          </View>
          {errorNotice}
          <Button
            title="Save to files"
            icon="folder"
            loading={busy === 'save'}
            disabled={busy !== null}
            onPress={() => void finishExport('save')}
          />
          <Button
            title="Share via app"
            icon="share-2"
            variant="secondary"
            loading={busy === 'share'}
            disabled={busy !== null}
            onPress={() => void finishExport('share')}
          />
        </>
      ) : preview ? (
        <>
          <View
            style={{
              backgroundColor: colors.accentMuted,
              padding: 24,
              borderRadius: 20,
              gap: 10,
            }}>
            <Feather name="check-circle" size={30} color={colors.accent} />
            <Text style={[typography.title, {color: colors.textPrimary}]}>
              {preview.cards.length} cards / {preview.notes.length} notes
            </Text>
            <Text style={[typography.body, {color: colors.textSecondary}]}>
              Added as new records. Nothing in your current vault will be
              replaced. Importing the same backup again creates duplicates.
            </Text>
          </View>
          {initialSnapshot ? (
            <Text style={[typography.small, {color: colors.danger}]}>
              Unencrypted files are not protected against reading or
              modification. Only import a file you trust.
            </Text>
          ) : null}
          {errorNotice}
          <Button
            title="Merge into my vault"
            icon="download"
            loading={busy === 'import'}
            onPress={() => void finishImport()}
          />
        </>
      ) : (
        <>
          <TextField
            label={
              mode === 'import'
                ? 'BACKUP PASSWORD'
                : `DEDICATED BACKUP PASSWORD (${cryptoPolicy.minimumPasswordLength}+ CHARACTERS)`
            }
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={busy === null && !unencrypted}
            maxLength={256}
            placeholder={
              unencrypted ? 'Not needed for unencrypted export' : undefined
            }
          />
          {mode === 'export' ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Export without encryption"
              accessibilityState={{
                checked: unencrypted,
                disabled: busy !== null,
              }}
              disabled={busy !== null}
              onPress={() => {
                setUnencrypted(!unencrypted);
                setPassword('');
                setError(undefined);
              }}
              style={{
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}>
              <Feather
                name={unencrypted ? 'check-square' : 'square'}
                size={20}
                color={unencrypted ? colors.danger : colors.textSecondary}
              />
              <Text
                style={[
                  typography.small,
                  {color: colors.textPrimary, flex: 1},
                ]}>
                Export without encryption (no password)
              </Text>
            </Pressable>
          ) : null}
          <Text
            style={[
              typography.small,
              {color: unencrypted ? colors.danger : colors.textSecondary},
            ]}>
            {mode === 'export'
              ? unencrypted
                ? 'WARNING: Full card numbers, security codes, and all notes will be readable without a password. Keep this file private.'
                : 'Use a separate password, not your master password. Longer passwords are safer. It is never stored and cannot be recovered.'
              : 'Fingerprint cannot decrypt a backup file. Use the password that encrypted this file.'}
          </Text>
          {errorNotice}
          <Button
            title={mode === 'export' ? 'Export backup' : 'Decrypt backup'}
            icon={mode === 'export' ? 'upload' : 'unlock'}
            disabled={mode === 'export' ? !unencrypted && !password : !password}
            loading={busy === 'prepare'}
            onPress={() => void proceed()}
          />
        </>
      )}
      <Button
        title="Cancel"
        variant="ghost"
        disabled={busy !== null}
        onPress={onClose}
      />
      <Text style={[typography.small, {color: colors.textSecondary}]}>
        Picking, saving, or sharing a file keeps this session open. Only
        encrypted backups need a backup password.
      </Text>
    </Sheet>
  );
}
