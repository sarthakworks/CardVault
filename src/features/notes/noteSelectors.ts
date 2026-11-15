import type { SecureNote } from '../../core/vault/models';

export function selectNotes(notes: SecureNote[], query: string): SecureNote[] {
  const search = query.trim().toLocaleLowerCase();
  return notes.filter((note) => !search || `${note.title}\n${note.content}`.toLocaleLowerCase().includes(search))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
}
