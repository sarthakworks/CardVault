import {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {reportError} from '../../core/errors/noticeStore';
import type {VaultSnapshot} from '../../core/vault/models';
import {pickBackup, discardPendingImport} from './backupService';
import {useBackupStore} from './backupStore';
import {BackupPasswordSheet} from './BackupPasswordSheet';
import {BackupFilesSheet} from './BackupFilesSheet';
import {refreshBackupFiles, useBackupFilesStore} from './backupFiles';

export function BackupActions() {
  const {colors} = useTheme();
  const pendingUri = useBackupStore((state) => state.pendingUri);
  const files = useBackupFilesStore((state) => state.files);
  const fileStatus = useBackupFilesStore((state) => state.status);
  const [action, setAction] = useState<
    | {mode: 'export' | 'files'}
    | {mode: 'import'; snapshot?: VaultSnapshot}
    | null
  >(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    void refreshBackupFiles().catch(reportError);
  }, []);
  async function pick() {
    setPicking(true);
    try {
      const selected = await pickBackup();
      if (selected) {
        setAction(
          selected.kind === 'unencrypted'
            ? {mode: 'import', snapshot: selected.snapshot}
            : {mode: 'import'}
        );
      }
    } catch (cause) {
      reportError(cause);
    } finally {
      setPicking(false);
    }
  }
  return (
    <View style={{gap: 10}}>
      <View
        style={[
          styles.group,
          {backgroundColor: colors.surface, borderColor: colors.border},
        ]}>
        {(
          [
            {
              icon: 'upload',
              title: 'Export backup',
              detail: 'Save or share a .vault file',
              action: () => setAction({mode: 'export'}),
            },
            {
              icon: 'download',
              title: pendingUri ? 'Continue import' : 'Import backup',
              detail: pendingUri
                ? 'Your selected file is ready'
                : 'Add records from a .vault file',
              action: () => {
                if (pendingUri) setAction({mode: 'import'});
                else void pick();
              },
            },
            {
              icon: 'folder',
              title: 'Backup files',
              detail:
                fileStatus === 'error'
                  ? 'Tap to retry loading your files'
                  : 'Raw content & file locations',
              action: () => {
                setAction({mode: 'files'});
                if (fileStatus === 'error')
                  void refreshBackupFiles().catch(reportError);
              },
            },
          ] as const
        ).map((item, index) => (
          <View key={item.icon}>
            {index ? (
              <View
                style={[styles.divider, {backgroundColor: colors.border}]}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={picking}
              onPress={item.action}
              style={({pressed}) => [
                styles.row,
                {
                  backgroundColor: pressed
                    ? colors.surfaceMuted
                    : 'transparent',
                },
              ]}>
              <View
                style={[styles.icon, {backgroundColor: colors.accentMuted}]}>
                <Feather name={item.icon} size={20} color={colors.accent} />
              </View>
              <View style={styles.labels}>
                <Text style={[styles.title, {color: colors.textPrimary}]}>
                  {item.title}
                </Text>
                <Text style={[styles.detail, {color: colors.textSecondary}]}>
                  {item.detail}
                </Text>
              </View>
              {item.icon === 'folder' && fileStatus === 'ready' ? (
                <Text style={[styles.count, {color: colors.textSecondary}]}>
                  {files.length}
                </Text>
              ) : null}
              {item.icon === 'download' && picking ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Feather
                  name="chevron-right"
                  size={16}
                  color={colors.textSecondary}
                />
              )}
            </Pressable>
          </View>
        ))}
      </View>
      {pendingUri ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard selected import"
          onPress={() => {
            try {
              discardPendingImport();
            } catch (cause) {
              reportError(cause);
            }
          }}
          style={{minHeight: 44, justifyContent: 'center'}}>
          <Text
            style={{
              color: colors.textSecondary,
              textAlign: 'center',
              fontSize: 12,
            }}>
            Discard selected import
          </Text>
        </Pressable>
      ) : null}
      {action?.mode === 'files' ? (
        <BackupFilesSheet onClose={() => setAction(null)} />
      ) : action ? (
        <BackupPasswordSheet
          key={action.mode}
          mode={action.mode}
          initialSnapshot={
            action.mode === 'import' ? action.snapshot : undefined
          }
          onClose={() => setAction(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {borderRadius: 20, borderWidth: 1, overflow: 'hidden'},
  row: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 17,
    gap: 13,
  },
  icon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {flex: 1, gap: 5},
  title: {...typography.label},
  detail: {...typography.small},
  count: {...typography.small, fontWeight: '600', marginRight: 2},
  divider: {height: StyleSheet.hairlineWidth, marginLeft: 66},
});
