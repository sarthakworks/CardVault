import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NoteInput, SecureNote } from '../../core/vault/models';
import { vaultService } from '../../core/vault/vaultService';
import { notify } from '../../core/errors/noticeStore';
import { VaultError } from '../../core/errors/VaultError';
import { Sheet } from '../../shared/components/Sheet';
import { SheetTextField as TextField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';
import { Chip } from '../../shared/components/Chip';
import { ActionAuthorizationSheet } from '../auth/ActionAuthorizationSheet';
import { noteFormSchema } from './noteFormSchema';
import { discardSessionDraft, keepSessionDraft, useSessionStore } from '../../core/security/sessionStore';

export function NoteEditorSheet({ note, onClose }: { note: SecureNote | null; onClose: () => void }) {
  const draftKey = note ? `note:${note.id}` : 'note:new';
  const { generation, drafts } = useSessionStore.getState();
  const draft = drafts[draftKey];
  const saved = useRef(false);
  const [pending, setPending] = useState<NoteInput | null>(null);
  const { control, handleSubmit, setValue, subscribe, getValues, formState: { errors } } = useForm<NoteInput>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: draft?.kind === 'note' ? draft.values : note ? { title: note.title, category: note.category, content: note.content } : { title: '', category: 'Personal', content: '' },
  });
  useEffect(() => subscribe({
    formState: { values: true },
    callback: ({ values }) => {
      if (!saved.current) keepSessionDraft(draftKey, { kind: 'note', values }, generation);
    },
  }), [subscribe, draftKey, generation]);
  const category = useWatch({ control, name: 'category' });
  function closeEditor() {
    if (!saved.current) keepSessionDraft(draftKey, { kind: 'note', values: getValues() }, generation);
    onClose();
  }
  return (
    <>
      <Sheet visible onClose={closeEditor} title={note ? 'Fine-tune your note.' : 'A thought worth keeping.'} subtitle="Drafts stay in this unlocked session. Every save is encrypted.">
        <Controller control={control} name="title" render={({ field }) => <TextField label="NOTE TITLE" placeholder="Give it a name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.title?.message} maxLength={120} />} />
        <Controller control={control} name="category" render={({ field }) => <TextField label="CATEGORY" placeholder="Personal, work, or your own tag" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.category?.message} maxLength={40} />} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['Personal', 'Finance', 'Work', 'Travel', 'Other'].map((tag) => <Chip key={tag} label={tag} selected={category === tag} onPress={() => setValue('category', tag, { shouldValidate: true })} />)}</View>
        <Controller control={control} name="content" render={({ field }) => <TextField label="YOUR NOTE" placeholder="Some things are just for you..." value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.content?.message} multiline textAlignVertical="top" style={{ minHeight: 220, lineHeight: 24 }} maxLength={100_000} />} />
        <Button title={note ? 'Authorize & save changes' : 'Save note securely'} icon="lock" onPress={() => void handleSubmit(setPending)()} />
        <Button title="Close & keep draft" variant="ghost" onPress={closeEditor} />
      </Sheet>
      <ActionAuthorizationSheet visible={pending !== null} operation={note ? `note:update:${note.id}` : 'note:create'} title={note ? 'Confirm your update.' : 'Save this note?'} onClose={() => setPending(null)} onAuthorized={async (authorization) => {
        if (!pending) throw new VaultError('authorization', 'This save is no longer active.');
        if (note) await vaultService.updateNote(note.id, pending, authorization);
        else await vaultService.addNote(pending, authorization);
        saved.current = true;
        discardSessionDraft(draftKey, generation);
        notify(note ? 'Note updated securely.' : 'Your note is safe with you.');
        setPending(null);
        onClose();
      }} />
    </>
  );
}
