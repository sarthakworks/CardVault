import { type ConfigPlugin, withAppBuildGradle } from 'expo/config-plugins';

const abiSplits = `    splits {
        abi {
            enable true
            reset()
            include(*project.property('reactNativeArchitectures').toString().split(','))
            universalApk false
        }
    }`;

const withAndroidApkSplits: ConfigPlugin = (config) => withAppBuildGradle(config, (mod) => {
  if (mod.modResults.language !== 'groovy') {
    throw new Error('Cardvault APK splits require a Groovy app build.gradle.');
  }
  const source = mod.modResults.contents;
  if (source.includes(abiSplits)) return mod;
  if (/^\s*splits\s*\{/m.test(source)) {
    throw new Error('Cannot configure APK ABI splits: review the existing splits block.');
  }
  const androidBlock = /^android \{$/m;
  if (!androidBlock.test(source)) {
    throw new Error('Cannot locate the Android configuration for APK ABI splits.');
  }
  mod.modResults.contents = source.replace(androidBlock, `android {\n${abiSplits}\n`);
  return mod;
});

export default withAndroidApkSplits;
