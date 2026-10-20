import type { ComponentProps } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardsScreen } from '../../features/cards/CardsScreen';
import { NotesScreen } from '../../features/notes/NotesScreen';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { useTheme } from '../../shared/theme/ThemeProvider';
import type { MainTabParamList } from './navigationTypes';

const Tab = createBottomTabNavigator<MainTabParamList>();
const icons: Record<keyof MainTabParamList, ComponentProps<typeof Feather>['name']> = {
  Cards: 'credit-card', Notes: 'file-text', Settings: 'sliders',
};

export function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <BottomSheetModalProvider>
      <Tab.Navigator screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { height: 66 + insets.bottom, paddingTop: 9, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: colors.surface, borderTopColor: colors.border, elevation: 0 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 4 },
        tabBarIcon: ({ color, size }) => <Feather name={icons[route.name]} color={color} size={size - 2} />,
        sceneStyle: { backgroundColor: colors.background },
      })}>
        <Tab.Screen name="Cards" component={CardsScreen} />
        <Tab.Screen name="Notes" component={NotesScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </BottomSheetModalProvider>
  );
}
