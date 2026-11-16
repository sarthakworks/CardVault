import {useEffect, type PropsWithChildren} from 'react';
import {BackHandler, Pressable, StyleSheet, Text, View} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import {useTheme} from '../theme/ThemeProvider';
import {typography} from '../theme/typography';

export interface DropdownPlacement {
  anchor: {x: number; y: number; width: number; height: number};
  viewport: {width: number; height: number};
}

export function dropdownPosition(
  {anchor, viewport}: DropdownPlacement,
  contentHeight: number,
  preferredWidth = 248,
  align: 'left' | 'right' = 'left'
) {
  const width = Math.min(preferredWidth, viewport.width - 24);
  const below = viewport.height - anchor.y - anchor.height - 16;
  const above = anchor.y - 16;
  const openBelow = below >= Math.min(contentHeight, 240) || below >= above;
  const height = Math.min(
    contentHeight,
    420,
    Math.max(0, openBelow ? below : above)
  );
  const preferredLeft =
    align === 'right' ? anchor.x + anchor.width - width : anchor.x;
  return {
    width,
    height,
    left: Math.max(12, Math.min(preferredLeft, viewport.width - width - 12)),
    top: openBelow ? anchor.y + anchor.height + 8 : anchor.y - height - 8,
  };
}

export function Dropdown({
  placement,
  title,
  contentHeight,
  width = 248,
  align = 'left',
  onClose,
  children,
}: PropsWithChildren<{
  placement: DropdownPlacement;
  title: string;
  contentHeight: number;
  width?: number;
  align?: 'left' | 'right';
  onClose: () => void;
}>) {
  const {colors, dark} = useTheme();
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      }
    );
    return () => subscription.remove();
  }, [onClose]);
  return (
    <View
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      onAccessibilityEscape={onClose}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessible={false}
        onPress={onClose}
      />
      <View
        style={[
          styles.menu,
          dropdownPosition(placement, contentHeight, width, align),
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: dark ? '#000000' : '#243654',
          },
        ]}>
        <View style={[styles.header, {borderBottomColor: colors.border}]}>
          <Text
            accessibilityRole="header"
            style={[styles.title, {color: colors.textPrimary}]}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close dropdown"
            onPress={onClose}
            style={({pressed}) => [
              styles.close,
              {backgroundColor: pressed ? colors.surfaceMuted : 'transparent'},
            ]}>
            <Feather
              name="x"
              size={16}
              color={colors.textSecondary}
              accessible={false}
            />
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    borderRadius: 20,
    borderWidth: 1,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: {width: 0, height: 8},
    elevation: 12,
    overflow: 'hidden',
  },
  header: {
    minHeight: 52,
    paddingLeft: 17,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {...typography.label, flex: 1},
  close: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
