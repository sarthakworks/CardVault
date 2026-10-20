import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useNoticeStore } from '../../core/errors/noticeStore';
import { useTheme } from '../theme/ThemeProvider';

export function ErrorBanner() {
  const { colors } = useTheme();
  const { message, kind } = useNoticeStore();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => useNoticeStore.setState({ message: null }), kind === 'error' ? 8_000 : 3_000);
    return () => clearTimeout(timer);
  }, [message, kind]);
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={{ position: 'absolute', bottom: 104, left: 20, right: 20, backgroundColor: kind === 'error' ? colors.dangerMuted : colors.textPrimary, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 10, alignItems: 'center', elevation: 20 }}>
      <Feather name={kind === 'error' ? 'alert-circle' : 'check-circle'} size={19} color={kind === 'error' ? colors.danger : colors.background} />
      <Text style={{ color: kind === 'error' ? colors.danger : colors.background, flex: 1, fontSize: 13, lineHeight: 19 }}>{message}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" hitSlop={12} onPress={() => useNoticeStore.setState({ message: null })}><Feather name="x" size={17} color={kind === 'error' ? colors.danger : colors.background} /></Pressable>
    </View>
  );
}
