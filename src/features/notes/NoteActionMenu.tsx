import {Pressable, ScrollView, StyleSheet, Text} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type {NoteInput} from '../../core/vault/models';
import {reportError} from '../../core/errors/noticeStore';
import {
  Dropdown,
  type DropdownPlacement,
} from '../../shared/components/Dropdown';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {useHaptics} from '../../shared/hooks/useHaptics';
import {copyNote, shareNote} from './noteActions';

export function NoteActionMenu({
  note,
  placement,
  onClose,
  onEdit,
  onDelete,
  onDiscard,
  draft = false,
}: {
  note: NoteInput;
  placement: DropdownPlacement;
  onClose: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  onDiscard?: () => void;
  draft?: boolean;
}) {
  const {colors} = useTheme();
  const haptic = useHaptics();
  const empty = !note.title.trim() && !note.content.trim();
  const actions = [
    ...(onEdit
      ? [
          {
            title: 'Edit note',
            icon: 'edit-2',
            run: onEdit,
            danger: false,
            disabled: false,
          } as const,
        ]
      : []),
    {
      title: 'Copy note',
      icon: 'copy',
      run: () => {
        void copyNote(note).catch(reportError);
      },
      danger: false,
      disabled: empty,
    },
    {
      title: 'Share note',
      icon: 'share-2',
      run: () => {
        void shareNote(note).catch(reportError);
      },
      danger: false,
      disabled: empty,
    },
    ...(onDiscard
      ? [
          {
            title: 'Discard changes',
            icon: 'rotate-ccw',
            run: onDiscard,
            danger: false,
            disabled: false,
          } as const,
        ]
      : []),
    {
      title: draft ? 'Discard note' : 'Delete note',
      icon: 'trash-2',
      run: onDelete,
      danger: true,
      disabled: false,
    },
  ] as const;
  return (
    <Dropdown
      placement={placement}
      title="Note actions"
      contentHeight={64 + actions.length * 48}
      align="right"
      onClose={onClose}>
      <ScrollView
        contentContainerStyle={styles.options}
        keyboardShouldPersistTaps="handled">
        {actions.map((action) => (
          <Pressable
            key={action.title}
            accessibilityRole="button"
            accessibilityLabel={action.title}
            accessibilityState={{disabled: action.disabled}}
            disabled={action.disabled}
            onPress={() => {
              haptic();
              onClose();
              action.run();
            }}
            style={({pressed}) => [
              styles.option,
              {
                backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                opacity: action.disabled ? 0.4 : 1,
              },
            ]}>
            <Feather
              name={action.icon}
              size={17}
              color={action.danger ? colors.danger : colors.accent}
              accessible={false}
            />
            <Text
              style={[
                styles.label,
                {color: action.danger ? colors.danger : colors.textPrimary},
              ]}>
              {action.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Dropdown>
  );
}

const styles = StyleSheet.create({
  options: {padding: 6},
  option: {
    minHeight: 48,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {...typography.small, flex: 1},
});
