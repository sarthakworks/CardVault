import {
  type ConfigPlugin,
  withAndroidManifest,
  withMainActivity,
  withDangerousMod,
} from 'expo/config-plugins';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const withAndroidSecurity: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android application manifest is missing.');
    application.$['android:allowBackup'] = 'false';
    application.$['android:usesCleartextTraffic'] = 'false';
    application.$['android:fullBackupContent'] = 'false';
    application.$['android:dataExtractionRules'] = '@xml/vault_data_extraction_rules';
    return mod;
  });
  config = withMainActivity(config, (mod) => {
    if (mod.modResults.language !== 'kt') {
      throw new Error('Cardvault requires a Kotlin MainActivity.');
    }
    let source = mod.modResults.contents;
    if (source.includes('PrivacyController.attach(this)')) return mod;
    source = source.replace(
      'import android.os.Bundle',
      'import android.os.Bundle\nimport android.view.WindowManager\nimport com.cardvault.security.PrivacyController',
    );
    const createCall = /super\.onCreate\((?:null|savedInstanceState)\)/;
    if (!createCall.test(source)) throw new Error('Cannot secure MainActivity startup.');
    source = source.replace(createCall,
      'window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)\n    super.onCreate(null)\n    PrivacyController.attach(this)');
    const closingBrace = source.lastIndexOf('}');
    if (closingBrace < 0) throw new Error('Invalid MainActivity structure.');
    source = `${source.slice(0, closingBrace)}
  override fun onPause() {
    PrivacyController.obscure(this)
    super.onPause()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    if (!hasFocus) PrivacyController.obscure(this)
    super.onWindowFocusChanged(hasFocus)
  }

  override fun onDestroy() {
    PrivacyController.detach(this)
    super.onDestroy()
  }
${source.slice(closingBrace)}`;
    mod.modResults.contents = source;
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const folder = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await mkdir(folder, { recursive: true });
    const exclusions = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref']
      .map((domain) => `<exclude domain="${domain}" path="."/>`).join('');
    await writeFile(path.join(folder, 'vault_data_extraction_rules.xml'),
      `<data-extraction-rules><cloud-backup disableIfNoEncryptionCapabilities="true">${exclusions}</cloud-backup><device-transfer>${exclusions}</device-transfer></data-extraction-rules>`);
    return mod;
  }]);
};

export default withAndroidSecurity;
