import 'tsx/cjs';
import type {ExpoConfig} from 'expo/config';
import type withBuildProperties from 'expo-build-properties';
import {version} from './package.json';
import withAndroidApkSplits from './plugins/withAndroidApkSplits';
import withAndroidSecurity from './plugins/withAndroidSecurity';

const easProjectId =
  process.env.EAS_PROJECT_ID ?? process.env.EAS_BUILD_PROJECT_ID;
if (
  easProjectId !== undefined &&
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    easProjectId
  )
) {
  throw new Error(
    'EAS_PROJECT_ID must be the project UUID from the Expo dashboard.'
  );
}

const config: ExpoConfig = {
  name: 'Cardvault',
  slug: 'cardvault',
  version,
  extra: easProjectId ? {eas: {projectId: easProjectId}} : undefined,
  platforms: ['android'],
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  backgroundColor: '#F5F6F8',
  updates: {enabled: false},
  android: {
    package: 'com.cardvault.app',
    versionCode: 2,
    allowBackup: false,
    permissions: ['android.permission.INTERNET'],
    blockedPermissions: [
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_MEDIA_IMAGES',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#EDF3FF',
    },
    predictiveBackGestureEnabled: true,
  },
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 29,
          buildArchs: ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          useLegacyPackaging: true,
          enableBundleCompression: true,
        },
      } satisfies Parameters<typeof withBuildProperties>[1],
    ],
    ['expo-secure-store', {configureAndroidBackup: false}],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        backgroundColor: '#F5F6F8',
        dark: {backgroundColor: '#101216'},
      },
    ],
    'expo-sqlite',
    'expo-font',
  ],
};

export default withAndroidApkSplits(withAndroidSecurity(config));
