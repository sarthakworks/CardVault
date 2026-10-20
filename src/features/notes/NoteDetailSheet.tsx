import { useState } from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { SecureNote } from '../../core/vault/models';
import { vaultService } from '../../core/vault/vaultService';
import { notify } from '../../core/errors/noticeStore';
import { Sheet } from '../../shared/components/Sheet';
import { Button } from '../../shared/components/Button';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { displayDate } from '../../shared/utils/formatters';
import { ActionAuthorizationSheet } from '../auth/ActionAuthorizationSheet';

export function NoteDetailSheet({ note, onClose, onEdit }: { note: SecureNote; onClose: () => void; onEdit: () => void }) {
  const { colors } = useTheme();
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <Sheet visible onClose={onClose} title={note.title} subtitle={`${note.category} / Updated ${displayDate(note.updatedAt)}`}>
        <View style={{ padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
          <Text style={[typography.body, { color: colors.textPrimary, lineHeight: 27 }]}>{note.content}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Feather name="lock" size={14} color={colors.success} /><Text style={[typography.small, { color: colors.textSecondary }]}>Encrypted at rest. Visible only in this session.</Text></View>
        <Button title="Edit note" icon="edit-2" onPress={onEdit} />
        <Button title="Delete note" icon="trash-2" variant="danger" onPress={() => setDeleteOpen(true)} />
      </Sheet>
      <ActionAuthorizationSheet visible={deleteOpen} operation={`note:delete:${note.id}`} onClose={() => setDeleteOpen(false)} title="Let this note go?" description="This permanently deletes the note from this device. Authenticate to confirm." confirmLabel="Delete permanently" onAuthorized={async (authorization) => {
        await vaultService.deleteNote(note.id, authorization);
        notify('Note removed from your vault.');
        onClose();
      }} />
    </>
  );
}
