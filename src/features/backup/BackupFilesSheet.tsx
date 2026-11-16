import {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {BottomSheetFlatList} from '@gorhom/bottom-sheet';
import Feather from '@expo/vector-icons/Feather';
import {errorMessage} from '../../core/errors/VaultError';
import {Sheet} from '../../shared/components/Sheet';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {displayDate} from '../../shared/utils/formatters';
import {rawTextBlocks} from './backupFileAccess';
import {
  openExistingBackup,
  openSavedBackup,
  refreshBackupFiles,
  useBackupFilesStore,
  type OpenBackup,
  type SavedBackup,
} from './backupFiles';

function fileSize(bytes: number | null): string {
  if (bytes === null) return 'Size unavailable';
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function BackupFilesSheet({onClose}: {onClose: () => void}) {
  const {colors} = useTheme();
  const files = useBackupFilesStore((state) => state.files);
  const status = useBackupFilesStore((state) => state.status);
  const historyError = useBackupFilesStore((state) => state.error);
  const [opened, setOpened] = useState<OpenBackup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [showUri, setShowUri] = useState(false);
  const blocks = useMemo(() => rawTextBlocks(opened?.text ?? ''), [opened]);

  async function open(file?: SavedBackup) {
    if (busy) return;
    setBusy(file?.uri ?? 'picker');
    setError(undefined);
    try {
      const result = file
        ? await openSavedBackup(file)
        : await openExistingBackup();
      if (result) {
        setShowUri(false);
        setOpened(result);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  function back() {
    setOpened(null);
    setShowUri(false);
    setError(undefined);
  }

  return (
    <Sheet
      visible
      title={opened ? 'Raw backup' : 'Backup files'}
      onClose={onClose}
      onBack={opened ? back : undefined}
      scrollable={false}
      dismissible={busy === null}>
      <View style={styles.toolbar}>
        {opened ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to backup files"
            onPress={back}
            style={styles.toolbarButton}>
            <Feather name="chevron-left" size={20} color={colors.accent} />
            <Text style={[styles.action, {color: colors.accent}]}>
              All files
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={() => void open()}
            style={styles.toolbarButton}>
            {busy === 'picker' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Feather name="folder-plus" size={17} color={colors.accent} />
            )}
            <Text style={[styles.action, {color: colors.accent}]}>
              Open existing
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close backup files"
          disabled={busy !== null}
          onPress={onClose}
          style={styles.close}>
          <Feather name="x" size={21} color={colors.textSecondary} />
        </Pressable>
      </View>
      {error || historyError ? (
        <Text
          accessibilityRole="alert"
          style={[typography.small, styles.error, {color: colors.danger}]}>
          {error ?? historyError}
        </Text>
      ) : null}
      {opened ? (
        <>
          <View style={[styles.fileHeader, {borderBottomColor: colors.border}]}>
            <View style={styles.fileTitle}>
              <Text
                selectable
                style={[styles.name, {color: colors.textPrimary}]}>
                {opened.file.name}
              </Text>
              <View
                style={[styles.badge, {backgroundColor: colors.surfaceMuted}]}>
                <Text style={[styles.badgeText, {color: colors.textSecondary}]}>
                  READ ONLY
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show full file location"
              accessibilityState={{expanded: showUri}}
              onPress={() => setShowUri(!showUri)}
              style={styles.locationButton}>
              <Feather name="map-pin" size={13} color={colors.textSecondary} />
              <Text
                style={[
                  typography.small,
                  styles.location,
                  {color: colors.textSecondary},
                ]}>
                {opened.file.location}
              </Text>
              <Feather
                name={showUri ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={colors.textSecondary}
              />
            </Pressable>
            {showUri ? (
              <Text
                selectable
                style={[styles.uri, {color: colors.textSecondary}]}>
                {opened.file.uri}
              </Text>
            ) : null}
            <Text style={[typography.small, {color: colors.textSecondary}]}>
              {fileSize(opened.byteLength)} · As stored, not decrypted
            </Text>
          </View>
          <BottomSheetFlatList
            data={blocks}
            key="raw"
            style={styles.list}
            keyExtractor={(_, index) => String(index)}
            renderItem={({item}: {item: string}) => (
              <Text
                selectable
                textBreakStrategy="simple"
                style={[styles.raw, {color: colors.textPrimary}]}>
                {item}
              </Text>
            )}
            contentContainerStyle={[
              styles.rawContent,
              {backgroundColor: colors.surfaceMuted},
            ]}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            ListEmptyComponent={
              <Text style={[typography.small, {color: colors.textSecondary}]}>
                This file is empty.
              </Text>
            }
          />
        </>
      ) : (
        <BottomSheetFlatList
          data={files}
          key="files"
          style={styles.list}
          keyExtractor={(item: SavedBackup) => item.uri}
          renderItem={({item}: {item: SavedBackup}) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View raw backup ${item.name}`}
              disabled={busy !== null}
              onPress={() => void open(item)}
              style={[styles.fileRow, {borderBottomColor: colors.border}]}>
              <View
                style={[
                  styles.fileIcon,
                  {backgroundColor: colors.accentMuted},
                ]}>
                <Feather name="file-text" size={20} color={colors.accent} />
              </View>
              <View style={styles.fileDetails}>
                <Text
                  numberOfLines={1}
                  style={[styles.rowName, {color: colors.textPrimary}]}>
                  {item.name}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[typography.small, {color: colors.textSecondary}]}>
                  {item.location}
                </Text>
                <Text style={[styles.meta, {color: colors.textSecondary}]}>
                  {fileSize(item.size)} · Added {displayDate(item.addedAt)}
                </Text>
              </View>
              {busy === item.uri ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Feather
                  name="chevron-right"
                  size={17}
                  color={colors.textSecondary}
                />
              )}
            </Pressable>
          )}
          contentContainerStyle={styles.filesContent}
          ListEmptyComponent={
            status === 'loading' ? (
              <ActivityIndicator style={styles.empty} color={colors.accent} />
            ) : (
              <View style={styles.empty}>
                <View
                  style={[
                    styles.emptyIcon,
                    {backgroundColor: colors.surfaceMuted},
                  ]}>
                  <Feather
                    name="folder"
                    size={28}
                    color={colors.textSecondary}
                  />
                </View>
                <Text style={[typography.heading, {color: colors.textPrimary}]}>
                  {status === 'error'
                    ? 'Files could not be loaded'
                    : 'No backups added yet'}
                </Text>
                <Text
                  style={[
                    typography.small,
                    styles.emptyHint,
                    {color: colors.textSecondary},
                  ]}>
                  {status === 'error'
                    ? 'Your saved files have not been changed.'
                    : 'Newly saved backups appear here. Open an older file to add it.'}
                </Text>
                {status === 'error' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void refreshBackupFiles().catch((cause) =>
                        setError(errorMessage(cause))
                      );
                    }}
                    style={styles.toolbarButton}>
                    <Text style={[styles.action, {color: colors.accent}]}>
                      Try again
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )
          }
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    paddingLeft: 24,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toolbarButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  action: {...typography.label},
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {marginHorizontal: 24, marginBottom: 12},
  list: {flex: 1},
  filesContent: {paddingHorizontal: 24, paddingBottom: 40, flexGrow: 1},
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fileIcon: {
    width: 42,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: {flex: 1, gap: 4},
  rowName: {...typography.label},
  meta: {...typography.caption},
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 55,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyHint: {maxWidth: 250, textAlign: 'center'},
  fileHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fileTitle: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  name: {...typography.label, flex: 1},
  badge: {borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4},
  badgeText: {fontSize: 10, fontWeight: '600', letterSpacing: 0.5},
  locationButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  location: {flex: 1},
  uri: {fontFamily: 'monospace', fontSize: 12, lineHeight: 18},
  rawContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  raw: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 19,
    includeFontPadding: false,
  },
});
