import {Share} from 'react-native';
import type {NoteInput} from '../../core/vault/models';
import {noteFieldsSchema} from '../../core/vault/schemas';
import {activeSession} from '../../core/security/sessionStore';
import {copySecret} from '../../core/security/clipboardGuard';
import {notify} from '../../core/errors/noticeStore';
import {useConfirmation} from '../../shared/components/ConfirmationProvider';

export function noteText(input: NoteInput): string {
  const note = noteFieldsSchema.parse(input);
  return [note.title, note.content]
    .filter((value) => value.trim())
    .join('\n\n');
}

export async function copyNote(input: NoteInput): Promise<void> {
  await copySecret(noteText(input));
  notify('Note copied securely. Clears within 30 seconds.');
}

export async function shareNote(input: NoteInput): Promise<void> {
  activeSession();
  await Share.share(
    {title: input.title.trim() || 'Note', message: noteText(input)},
    {dialogTitle: 'Share note'}
  );
}

export function useNoteRemoval() {
  const confirm = useConfirmation();
  return (
    note: NoteInput,
    onConfirm: () => void | Promise<void>,
    draft = false
  ) =>
    confirm({
      title: draft ? 'Discard this note?' : 'Delete this note?',
      description: draft
        ? 'This unsaved note will be discarded. This cannot be undone.'
        : 'This note will leave your vault. This cannot be undone.',
      confirmLabel: draft ? 'Discard note' : 'Delete note',
      cancelLabel: draft ? 'Keep editing' : 'Keep note',
      itemTitle: note.title.trim() || 'Untitled note',
      itemDescription:
        note.content.trim().replace(/\s+/g, ' ').slice(0, 120) ||
        'No note text',
      itemIcon: 'file-text',
      onConfirm,
    });
}
