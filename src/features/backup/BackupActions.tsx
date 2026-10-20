import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { notify, reportError } from '../../core/errors/noticeStore';
import { useSessionStore } from '../../core/security/sessionStore';
import { pickEncryptedBackup, discardPendingImport } from './backupService';
import { useBackupStore } from './backupStore';
import { BackupPasswordSheet } from './BackupPasswordSheet';

export function BackupActions() {
  const { colors } = useTheme();
  const pendingUri = useBackupStore((state) => state.pendingUri);
  const [mode, setMode] = useState<'import' | 'export' | null>(null);
  const [picking, setPicking] = useState(false);
  async function pick() {
    setPicking(true);
    try {
      if (await pickEncryptedBackup()) {
        if (useSessionStore.getState().status === 'unlocked') setMode('import');
        else notify('Backup selected. Unlock your vault, then return to Settings to continue.');
      }
    } catch (cause) { reportError(cause); }
    finally { setPicking(false); }
  }
  return (
    <View style={{ gap: 10 }}>
      {([{ icon: 'upload', title: 'Export encrypted backup', detail: 'A password-protected .vault file', action: () => setMode('export') }, { icon: 'download', title: pendingUri ? 'Continue selected import' : 'Import encrypted backup', detail: pendingUri ? 'Enter its password to review and merge' : 'Merge safely without replacing records', action: () => { if (pendingUri) setMode('import'); else void pick(); } }] as const).map((item) => (
        <Pressable key={item.icon} accessibilityRole="button" disabled={picking} onPress={item.action} style={{ flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 18 }}>
          <View style={{ width: 39, height: 39, borderRadius: 13, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}><Feather name={item.icon} size={18} color={colors.accent} /></View>
          <View style={{ flex: 1, gap: 5 }}><Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{item.title}</Text><Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.detail}</Text></View><Feather name="chevron-right" size={16} color={colors.textSecondary} />
        </Pressable>
      ))}
      {pendingUri ? <Pressable accessibilityRole="button" accessibilityLabel="Discard selected import" onPress={() => { try { discardPendingImport(); } catch (cause) { reportError(cause); } }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 12 }}>Discard selected import</Text></Pressable> : null}
      {mode ? <BackupPasswordSheet key={mode} mode={mode} onClose={() => setMode(null)} /> : null}
    </View>
  );
}
