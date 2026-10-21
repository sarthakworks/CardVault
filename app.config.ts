import 'tsx/cjs';
import type { ExpoConfig } from 'expo/config';
import { version } from './package.json';
import withAndroidSecurity from './plugins/withAndroidSecurity';

const easProjectId = process.env.EAS_PROJECT_ID ?? process.env.EAS_BUILD_PROJECT_ID;
if (easProjectId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(easProjectId)) {
  throw new Error('EAS_PROJECT_ID must be the project UUID from the Expo dashboard.');
}

const config: ExpoConfig = {
  name: 'Cardvault',
  slug: 'cardvault',
  version,
  extra: easProjectId ? { eas: { projectId: easProjectId } } : undefined,
  platforms: ['android'],
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  backgroundColor: '#F6F7FB',
  updates: { enabled: false },
  android: {
    package: 'com.cardvault.app',
    versionCode: 1,
    allowBackup: false,
    blockedPermissions: [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_MEDIA_IMAGES',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#142033',
    },
    predictiveBackGestureEnabled: true,
  },
  plugins: [
    ['expo-build-properties', { android: { minSdkVersion: 29 } }],
    ['expo-secure-store', { configureAndroidBackup: false }],
    ['expo-splash-screen', {
      image: './assets/splash-icon.png',
      imageWidth: 120,
      backgroundColor: '#F6F7FB',
      dark: { backgroundColor: '#0B111B' },
    }],
    'expo-sqlite',
    'expo-font',
  ],
};

export default withAndroidSecurity(config);
