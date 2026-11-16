import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Controller, useForm, useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import Feather from '@expo/vector-icons/Feather';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NoteInput, SecureNote} from '../../core/vault/models';
import {vaultService} from '../../core/vault/vaultService';
import {
  discardSessionDraft,
  keepSessionDraft,
  useSessionStore,
} from '../../core/security/sessionStore';
import {errorMessage} from '../../core/errors/VaultError';
import {notify} from '../../core/errors/noticeStore';
import {Screen} from '../../shared/components/Screen';
import {TextField} from '../../shared/components/TextField';
import type {DropdownPlacement} from '../../shared/components/Dropdown';
import {useConfirmation} from '../../shared/components/ConfirmationProvider';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {noteFormSchema} from './noteFormSchema';
import {NoteActionMenu} from './NoteActionMenu';
import {shareNote, useNoteRemoval} from './noteActions';

function EditorButton({
  label,
  icon,
  onPress,
  disabled = false,
  primary = false,
  loading = false,
}: {
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  loading?: boolean;
}) {
  const {colors} = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled, busy: loading}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.iconButton,
        {
          backgroundColor: primary
            ? colors.accentMuted
            : pressed
              ? colors.surfaceMuted
              : 'transparent',
          opacity: disabled && !loading ? 0.4 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Feather
          name={icon}
          size={21}
          color={primary ? colors.accent : colors.textPrimary}
          accessible={false}
        />
      )}
    </Pressable>
  );
}

export function NoteEditor({
  note,
  onClose,
}: {
  note: SecureNote | null;
  onClose: () => void;
}) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const confirm = useConfirmation();
  const confirmRemoval = useNoteRemoval();
  const {generation, drafts} = useSessionStore.getState();
  const draftKey = note ? `note:${note.id}` : 'note:new';
  const draft = drafts[draftKey];
  const finished = useRef(false);
  const pending = useRef(false);
  const viewport = useRef<ComponentRef<typeof View>>(null);
  const more = useRef<ComponentRef<typeof View>>(null);
  const menuRequest = useRef(0);
  const [menu, setMenu] = useState<DropdownPlacement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const {
    control,
    getValues,
    handleSubmit,
    subscribe,
    formState: {errors},
  } = useForm<NoteInput>({
    resolver: zodResolver(noteFormSchema),
    defaultValues:
      draft?.kind === 'note'
        ? {title: draft.values.title, content: draft.values.content}
        : {title: note?.title ?? '', content: note?.content ?? ''},
  });
  const title = useWatch({control, name: 'title'});
  const content = useWatch({control, name: 'content'});
  const hasContent = Boolean(title.trim() || content.trim());
  useEffect(
    () =>
      subscribe({
        formState: {values: true},
        callback: ({values}) => {
          if (!finished.current)
            keepSessionDraft(draftKey, {kind: 'note', values}, generation);
        },
      }),
    [draftKey, generation, subscribe]
  );
  const closeMenu = useCallback(() => {
    menuRequest.current++;
    setMenu(null);
  }, []);
  const finish = useCallback(() => {
    finished.current = true;
    discardSessionDraft(draftKey, generation);
    Keyboard.dismiss();
    onClose();
  }, [draftKey, generation, onClose]);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);
  const closeEditor = useCallback(() => {
    void run(async () => {
      const values = getValues();
      if (!values.title.trim() && !values.content.trim()) {
        if (!note) finish();
        else
          setError(
            'Add a title or note text, or use More to discard or delete this note.'
          );
        return;
      }
      await handleSubmit(
        async (input) => {
          if (
            !note ||
            input.title !== note.title ||
            input.content !== note.content
          ) {
            if (note) await vaultService.updateNote(note.id, input);
            else await vaultService.addNote(input);
          }
          finish();
        },
        () => setError('Check the highlighted note fields before saving.')
      )();
    });
  }, [finish, getValues, handleSubmit, note, run]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        closeEditor();
        return true;
      }
    );
    return () => subscription.remove();
  }, [closeEditor]);
  function openMenu() {
    const request = ++menuRequest.current;
    more.current?.measureInWindow((x, y, width, height) => {
      viewport.current?.measureInWindow(
        (screenX, screenY, screenWidth, screenHeight) => {
          if (
            menuRequest.current !== request ||
            width <= 0 ||
            screenWidth <= 0 ||
            screenHeight <= 0
          )
            return;
          setMenu({
            anchor: {x: x - screenX, y: y - screenY, width, height},
            viewport: {width: screenWidth, height: screenHeight},
          });
        }
      );
    });
  }
  function remove() {
    confirmRemoval(
      {title, content},
      async () => {
        if (note) await vaultService.deleteNote(note.id);
        finish();
        notify(note ? 'Note deleted.' : 'Draft discarded.');
      },
      note === null
    );
  }
  function discard() {
    confirm({
      title: 'Discard these changes?',
      description:
        'Your saved note will stay just as it was. Unsaved edits will be lost.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      itemTitle: note?.title || 'Untitled note',
      itemDescription: 'Your saved version stays unchanged',
      itemIcon: 'file-text',
      onConfirm: finish,
    });
  }
  return (
    <Screen>
      <View
        ref={viewport}
        collapsable={false}
        style={styles.viewport}
        onLayout={closeMenu}>
        <View
          style={styles.viewport}
          accessibilityElementsHidden={menu !== null}
          importantForAccessibility={menu ? 'no-hide-descendants' : 'auto'}>
          <KeyboardAvoidingView
            style={styles.viewport}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.toolbar}>
              <EditorButton
                label="Back to notes and save"
                icon="chevron-left"
                onPress={closeEditor}
                disabled={busy}
              />
              <Text style={[styles.editorLabel, {color: colors.textSecondary}]}>
                {note ? 'Edit note' : 'New note'}
              </Text>
              <EditorButton
                label="Share note"
                icon="share-2"
                onPress={() => {
                  void run(() => shareNote(getValues()));
                }}
                disabled={busy || !hasContent}
              />
              <Pressable
                ref={more}
                collapsable={false}
                accessibilityRole="button"
                accessibilityLabel="More note actions"
                accessibilityState={{expanded: menu !== null, disabled: busy}}
                disabled={busy}
                onPress={openMenu}
                style={({pressed}) => [
                  styles.iconButton,
                  {
                    backgroundColor: pressed
                      ? colors.surfaceMuted
                      : 'transparent',
                  },
                ]}>
                <Feather
                  name="more-horizontal"
                  size={21}
                  color={colors.textPrimary}
                  accessible={false}
                />
              </Pressable>
              <EditorButton
                label="Save note and close"
                icon="check"
                onPress={closeEditor}
                primary
                loading={busy}
                disabled={busy}
              />
            </View>
            {error ? (
              <Text
                accessibilityRole="alert"
                style={[styles.error, {color: colors.danger}]}>
                {error}
              </Text>
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === 'ios' ? 'interactive' : 'on-drag'
              }
              contentContainerStyle={styles.canvas}
              showsVerticalScrollIndicator={false}>
              <Controller
                control={control}
                name="title"
                render={({field}) => (
                  <TextField
                    variant="plain"
                    placeholder="Title"
                    accessibilityLabel="Note title"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    editable={!busy}
                    maxLength={120}
                    error={errors.title?.message}
                    style={styles.titleInput}
                  />
                )}
              />
              <Controller
                control={control}
                name="content"
                render={({field}) => (
                  <TextField
                    variant="plain"
                    placeholder="Note"
                    accessibilityLabel="Note text"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    editable={!busy}
                    multiline
                    scrollEnabled={false}
                    textAlignVertical="top"
                    maxLength={100_000}
                    error={errors.content?.message}
                    containerStyle={styles.bodyContainer}
                    style={styles.bodyInput}
                  />
                )}
              />
            </ScrollView>
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: Math.max(insets.bottom, 14),
                  borderTopColor: colors.border,
                },
              ]}>
              <Text style={[styles.footerText, {color: colors.textSecondary}]}>
                {busy ? 'Please wait' : 'Back or Done saves your note'}
              </Text>
              <Text style={[styles.footerText, {color: colors.textSecondary}]}>
                {content.length.toLocaleString()} characters
              </Text>
            </View>
          </KeyboardAvoidingView>
        </View>
        {menu ? (
          <NoteActionMenu
            note={{title, content}}
            placement={menu}
            onClose={closeMenu}
            onDelete={remove}
            onDiscard={note ? discard : undefined}
            draft={note === null}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewport: {flex: 1},
  toolbar: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorLabel: {...typography.small, flex: 1, minWidth: 0, paddingLeft: 5},
  error: {...typography.small, paddingHorizontal: 25, paddingVertical: 12},
  canvas: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 13,
  },
  titleInput: {...typography.title, minHeight: 57},
  bodyContainer: {flex: 1},
  bodyInput: {...typography.body, minHeight: 300},
  footer: {
    paddingHorizontal: 25,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
  },
  footerText: {
    ...typography.caption,
    maxWidth: '100%',
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
});
