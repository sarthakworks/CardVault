import {useRef, type ComponentRef} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type {SecureNote} from '../../core/vault/models';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {displayDate} from '../../shared/utils/formatters';

export function NotePreview({
  note,
  layout,
  onPress,
  onOptions,
}: {
  note: SecureNote;
  layout: 'grid' | 'list';
  onPress: () => void;
  onOptions: (anchor: ComponentRef<typeof View>) => void;
}) {
  const {colors} = useTheme();
  const reference = useRef<ComponentRef<typeof View>>(null);
  const tone = note.id.charCodeAt(0) % 3;
  const paper =
    tone === 0
      ? colors.surface
      : tone === 1
        ? colors.surfaceMuted
        : colors.accentMuted;
  const label = note.title || note.content.trim().slice(0, 80);
  function showOptions() {
    if (reference.current) onOptions(reference.current);
  }
  return (
    <View style={styles.container}>
      <Pressable
        ref={reference}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`Open note: ${label}`}
        accessibilityHint="Opens the note for editing. Hold for more actions."
        onPress={onPress}
        onLongPress={showOptions}
        delayLongPress={450}
        style={({pressed}) => [
          styles.note,
          layout === 'list' && styles.listNote,
          {
            backgroundColor: paper,
            borderColor: colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}>
        {note.title ? (
          <Text
            numberOfLines={layout === 'grid' ? 2 : 1}
            style={[styles.title, {color: colors.textPrimary}]}>
            {note.title}
          </Text>
        ) : null}
        <Text
          numberOfLines={layout === 'grid' ? 6 : 3}
          style={[
            styles.preview,
            !note.title && styles.untitledPreview,
            {color: colors.textSecondary},
          ]}>
          {note.content}
        </Text>
        <View style={styles.footer}>
          <Text style={[styles.date, {color: colors.textSecondary}]}>
            {displayDate(note.updatedAt)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More actions for ${note.title || 'untitled note'}`}
        onPress={showOptions}
        style={({pressed}) => [
          styles.more,
          {backgroundColor: pressed ? colors.surfaceMuted : 'transparent'},
        ]}>
        <Feather
          name="more-horizontal"
          size={17}
          color={colors.textSecondary}
          accessible={false}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  note: {
    flex: 1,
    minHeight: 190,
    borderWidth: 1,
    borderRadius: 19,
    paddingHorizontal: 17,
    paddingTop: 19,
    paddingBottom: 9,
    gap: 10,
  },
  listNote: {minHeight: 130},
  title: {...typography.label, fontSize: 16, lineHeight: 23},
  preview: {...typography.small, flex: 1},
  untitledPreview: {...typography.body},
  footer: {minHeight: 30, justifyContent: 'center', paddingRight: 32},
  date: {...typography.caption},
  more: {
    position: 'absolute',
    right: 4,
    bottom: 3,
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
