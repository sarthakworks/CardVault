# Cardvault

An Android-only, offline credit-card and secure-notes vault built with Expo SDK 58, React Native, and strict TypeScript.

[![Latest release](https://img.shields.io/github/v/release/sarthakworks/CardVault)](https://github.com/sarthakworks/CardVault/releases/latest)

## Download an APK

[Download the latest APK](https://github.com/sarthakworks/CardVault/releases/latest/download/cardvault.apk), or [browse all versions on GitHub Releases](https://github.com/sarthakworks/CardVault/releases). Open a release and download `cardvault.apk` from **Assets** to get that exact version. `SHA256SUMS.txt` accompanies each APK.

Automated releases become available after the one-time setup below. Each release identifies both the app version and the unique Android build number, for example **Cardvault 1.0.0 (build 42)**, tagged `v1.0.0-build.42`. Non-default-branch and tag pushes produce prereleases; the current default-branch build is marked **Latest**.

Install the standalone APK on an Android 10+ phone, allowing installation from that file's source when Android asks. Expo Go, a QR code, and a running development server are not required.

**Export an encrypted backup before changing installations.** Android normally blocks installing a lower build number or updating an app signed with a different key. The previous locally built APK uses a development key and cannot be updated in place by a new EAS-signed release. If Android requires uninstalling, export first: uninstalling erases the local vault. Keep the backup password so you can import into the new installation.

## Automated APK releases

`.github/workflows/android-release.yml` builds and publishes an APK on **every push**, including branch and tag pushes. **Actions > Android APK release > Run workflow** also starts a build manually after the workflow is on the default branch. No pushes are cancelled in favor of newer builds, and previous releases remain downloadable.

The workflow validates TypeScript and lint, waits for a signed EAS `release` build, verifies its platform/status/version/source commit, downloads the APK, and publishes it with a SHA-256 checksum. Failed builds do not publish a release. Releases point to the pushed commit, not whichever commit happens to be at the branch tip when the build finishes. Tags created by the workflow's `GITHUB_TOKEN` do not trigger another workflow run.

### EAS Free plan

Keep the Expo account that owns this project on the **Free ($0/month)** plan; confirm **Current Plan** in [Expo Billing](https://expo.dev/settings/billing) before starting builds. The `release` profile explicitly uses the Free-compatible **medium** Android worker. It does not require a paid subscription or a large worker.

As of October 2026, the [Free plan](https://expo.dev/pricing) includes up to **15 Android builds per calendar month**, with a low-priority queue and a 45-minute build timeout. The initial signing/setup build and subsequent builds, including reruns and prereleases, use the same account's allowance. Building on every push can exhaust that allowance quickly.

[Free accounts cannot incur overage charges](https://docs.expo.dev/billing/faq/#what-happens-when-i-use-up-the-free-plans-monthly-quota): after the quota is exhausted, new builds are unavailable until the first day of the next calendar month. The workflow fails without publishing a new release; existing releases stay available. It does not upgrade your plan, purchase extra builds, or fall back to a different build service.

The Expo account's plan, not `eas.json`, controls billing. A medium worker is also available on paid plans, so this configuration is not a spending cap if you later upgrade the owning account. Monitor usage in Expo Billing and stay on Free to avoid EAS charges.

### One-time setup

1. Create a free [Expo account](https://expo.dev/signup), confirm its plan is **Free**, then create or link a **Cardvault** project in the [Expo dashboard](https://expo.dev). Copy its project UUID from the project settings. The project slug should be `cardvault`.
2. Authenticate and complete an initial EAS build locally, allowing EAS to create or import a persistent Android signing keystore:

   ```sh
   npm ci
   export EAS_PROJECT_ID='your-expo-project-uuid'
   npx eas-cli@latest login
   npx eas-cli@latest build --platform android --profile release
   ```

3. In this repository's **Settings > Secrets and variables > Actions**, add a repository **variable** named `EAS_PROJECT_ID` containing that UUID, and a repository **secret** named `EXPO_TOKEN` containing an [Expo access token](https://expo.dev/settings/access-tokens) with access to the project.
4. Make sure repository/organization Actions policies permit this workflow's `contents: write` permission so `GITHUB_TOKEN` can create releases. Commit and push the workflow, or run it manually after setup.

Signing credentials are managed by EAS and reused across builds; there is no fallback to the template's public development key. Preserve and securely back up the keystore: changing it prevents in-place updates. Never commit tokens, keystores, or `credentials.json`. Missing CI settings fail the workflow with a setup error rather than publishing an unsigned or development-signed APK.

EAS cloud builds require an Expo account and available build quota; each accepted build request uses the account's allowance. GitHub Actions only orchestrates EAS and publishes the finished APK; it does not use EAS Workflows CI/CD minutes. These build-time services do not add network access, telemetry, or OTA updates to the installed app.

### Versioning

`package.json` is the source of the user-facing `major.minor.patch` version; `app.config.ts` reads it directly. Use `npm version patch --no-git-tag-version` (or `minor`/`major`) when intentionally changing that version, then commit both package files.

EAS remotely increments `android.versionCode` for every build, including reruns and prereleases. CI does not commit version bumps or overwrite old releases, so there is no build/commit loop. Release tags combine the app version with the actual EAS build number. Only a successful build of the current default-branch tip updates **Latest**, so a slower, older build cannot replace a newer build.

## Run on Android

Requirements: Node.js 24 LTS, Java 17, an Android SDK, and an Android 10+ device or emulator.

For an existing build, use [GitHub Releases](https://github.com/sarthakworks/CardVault/releases). Local native builds use the template's development signing configuration, not the persistent EAS distribution key.

```sh
npm ci
npm run generate:android
npm run android
```

The Android command builds an embedded release bundle and installs it on the selected device. No Metro connection is required by the installed app. Expo Go is intentionally unsupported because the native privacy, clipboard, and Keystore adapter is required.

Build tools need internet access when downloading dependencies. The installed release app has no internet or network-state permission and does not use a backend, telemetry, cloud assets, or OTA updates.

### Expo Go / QR-code error

`Project is incompatible with this version of Expo Go` means the installed Expo Go runtime does not match this project's Expo SDK 58. A matching Expo Go version would still lack Cardvault's local Android security module, so upgrading Expo Go or changing SDK versions is not the supported solution.

Install the standalone APK from GitHub Releases directly on the phone, allowing installation from that file's source when Android asks. You do not need to run `npm run start` or scan a QR code for the standalone app.

Alternatively, connect the phone over USB with USB debugging enabled and run:

```sh
npm run android -- --device
```

Select the phone when prompted. This builds and installs the release app with its native security module and embedded assets. `npm run start` starts Metro only; it cannot add native security code to Expo Go.

## Included

- Master-password setup and password-first unlock.
- PBKDF2-HMAC-SHA-256 with 600,000 iterations, a cryptographic 32-byte salt, and HKDF-separated keys.
- Native AES-256-GCM authenticated encryption before SQLite writes.
- Optional strong biometric unlock and action confirmation, enabled only after inspecting the actual hardware-backed, per-use-authenticated Keystore wrapping key.
- Fresh fingerprint or master-password confirmation for card/note creation, edits, deletion, import merging, and biometric-setting changes.
- Realistic animated cards, CVV flips, explicit sensitive copying, owner/bank/network filtering, and sorting.
- Secure notes with categories, in-memory search, and timestamps.
- Persistent light/dark themes, reduced-motion-aware animations, and haptics.
- Dedicated-password-encrypted `.vault` export and additive import with local re-encryption.
- Native secure windows, an opaque lifecycle privacy shield, session clearing, and clipboard expiry.

The app starts empty. There are no sample cards, preconfigured passwords, or hidden recovery credentials.

## Daily use

Choose a master password of 5-256 characters. Numbers are allowed, but the password is not restricted to digits. Longer passphrases are strongly recommended because short passwords are much easier to guess. The password is never stored, and there is no password-recovery service. Existing passwords are not shortened or changed by this minimum-length update.

Enable **Fingerprint authentication** in Settings to use a fingerprint for unlocking and confirming actions. Every new card/note save, edit, deletion, and import merge requires a fresh fingerprint or master-password confirmation. Confirmation is single-use and cannot authorize a second action. If fingerprints are disabled or unavailable, use the master password.

Initial fingerprint setup requires the master password because no biometric key has been enrolled yet. Disabling fingerprints accepts the current fingerprint or master password. Changing Android biometric enrollment may invalidate access; use the master password to unlock and configure it again. Enabling fingerprints intentionally locks the session while Android authenticates.

An app-initiated authenticated SecureStore prompt can temporarily take focus without discarding the editor; the native privacy shield still covers the window. Actual backgrounding or an inactive AppState always clears the session and cancels pending authorization. Ordinary focus loss outside that narrowly scoped biometric prompt still locks the vault.

Copying a card number or CVV marks the clipboard entry sensitive. The native guard clears an app-owned entry within 30 seconds while active, or earlier when focus/session is lost. It does not erase a newer unrelated clipboard entry.

### Session drafts and bottom sheets

New-card, card-edit, new-note, and note-edit drafts stay in memory throughout the current unlocked session. Dragging an editor closed, using **Close & keep draft**, switching tabs, or cancelling authentication does not erase entered fields. Reopen the same editor to continue; different records keep separate drafts. Successful saves clear only that editor's draft, and deleting a record clears its associated draft.

To dismiss a sheet by gesture, drag its top handle down to the bottom. Outside taps do not close it. Android Back closes the current dismissible sheet and retains its editor draft, and scrolling form content does not pan the sheet itself. Explicit Save, Close, and Cancel actions remain available where appropriate.

Drafts are not written to SQLite, exported, or restored after process death. Locking, backgrounding, or ending the session wipes them together with other decrypted state. Master-password and backup-password fields are not cached as drafts.

### Card details are not financially validated

Card numbers, expiry values, and CVVs are accepted as entered. There is no Luhn check, network/card-number length rule, CVV digit/length rule, expiry-format rule, or future-date requirement. These fields accept free-form text, including separators and values that are not real payment-card details. The same policy applies to new cards, edits, local persistence, and imported backups.

Basic required fields and storage-size safeguards remain: card numbers support up to 128 characters, and expiry/security-code values support up to 32 characters each. Numeric card numbers may be grouped for display without changing the stored value. Expiry sorting orders recognizable MM/YY values first and keeps other text afterward; it does not block saving or label unknown text as expired.

Saving a new card still uses the existing fresh-action authentication policy. If fingerprint authentication is enabled, the confirmation screen leads with **Confirm with fingerprint** and hides the password field until **Use master password instead** is selected. If fingerprint authentication is disabled or unavailable, the master password remains the fallback.

## Backups

Export requires a dedicated backup password of 5-256 characters and a matching confirmation. There is no master-password export mode. Choose a separate, preferably longer password and keep it safe: the app never stores it and fingerprint cannot encrypt or decrypt a portable backup in place of that password. The app writes only an authenticated encrypted envelope, then opens Android sharing. The receiving app is outside Cardvault's network boundary.

For import, choose a local `.vault` file. File selection locks the vault. Unlock again, return to Settings, and choose **Continue selected import**. Enter the same dedicated password used to export that file, review the record counts, and choose **Merge into my vault**. Authenticate with a fingerprint or the receiving vault's master password to save the merged records. Imported records get fresh identifiers and never replace existing ones; importing twice creates duplicates. They are re-encrypted with the receiving vault's local payload key, not the backup password.

Existing backups remain compatible: enter the password originally used to encrypt the file. If an older backup was exported using the old master-password option, that original password still decrypts it; the new app only removes that option when creating new exports.

The local vault supports up to 8 MB of serialized plaintext, 5,000 cards, and 5,000 notes. Each note supports 100,000 characters. Backup inputs are bounded to 12 MB and 600,000-2,000,000 KDF iterations. Limits produce explicit errors; data is never silently truncated.

Encrypted export files are retained until the next cold launch so another Android app has time to open the temporary share URI. Selected import files are removed after completion/cancellation or on the next cold launch. Cache cleanup targets only Cardvault-owned `.vault` files.

Uninstalling the app deletes its local database and biometric access. Export regularly and keep the backup password separately.

## Validation

```sh
npm run typecheck
npm run lint
npx expo install --check
npm run build
npm run build:android
```

As requested, there are no authored unit/integration/E2E test cases or test-framework dependencies. `npm test` is explicitly an alias for TypeScript validation, not a runtime test suite.

The native module is maintained under `modules/vault-security`. The generated `android` project is not the source of truth; `app.config.ts` and the config plugin regenerate it. The plugin fails explicitly if the expected Kotlin startup hook cannot be secured.

The template release signing configuration is for local installation and verification. Automated GitHub APK releases use the persistent EAS signing credentials configured above; the `release` profile produces an APK for direct installation, not a Google Play app bundle. Do not commit signing keys or passwords.

### Verified delivery

TypeScript and lint pass, Expo Doctor reports 20/20 checks passed, and both the Android bundle and native arm64 release APK build successfully.

Manual verification on the API 36 Pixel emulator covered signup, wrong-password rejection, cold unlock, card/note creation, password-confirmed note editing and card deletion, bank filtering, theme persistence, background locking, and fully redacted screen capture. The real system clipboard was empty after its 30-second deadline.

An independently generated PBKDF2/HKDF/AES-GCM backup was successfully decrypted and merged. The imported records survived a cold unlock with the receiving vault's different master password. Encrypted export launched the Android share chooser and locked the returning session.

The fingerprint-confirmation update was also checked: new card/note saves require authorization, a wrong creation password is rejected, and password fallback completes creation, edits, and deletion. Dedicated-only export rejects mismatched confirmation and opens Android sharing with a password different from the local master. Import rejects the local master as a substitute for that backup's password, accepts its dedicated password, and requires a separate local action confirmation before merging.

In-memory checks of the actual authorization and lifecycle modules verified fresh biometric grants for each protected operation, single use, target/revision/session binding, mismatched-key rejection, cancellation, and the focus-only biometric prompt exception. These checks do not substitute for a physical device's fingerprint sensor and hardware-backed Keystore.

The five-character minimum was verified at its exact boundary on the emulator: four-character master/backup passwords are rejected, exactly five numeric characters create and unlock a vault, and a five-character dedicated backup password encrypts successfully and opens Android sharing.

The final APK was inspected: it has no internet/network-state or broad-storage permissions, is not debuggable, disables cleartext/automatic backup, and excludes all nine backup domains from both cloud and device transfer. Synthetic verification records and temporary backup files were removed; the emulator was reset to first-launch onboarding.

Hardware-backed biometric success/enrollment invalidation and manufacturer-specific screen-recording behavior still require a physical Android device. No independent security audit or production signing has been performed.

## Architecture

```text
src/app                 Providers and locked/unlocked navigation
src/core/crypto         KDF policy, key separation, GCM, authenticated envelopes
src/core/storage        SQLite migrations, ciphertext repository, UI preferences
src/core/security       Volatile keyring, session lifecycle, scoped fingerprint/password authorization
src/core/vault          Runtime schemas, typed models, serialized mutations
src/features            Auth, cards, notes, settings, encrypted backups
src/shared              Theme tokens, accessible controls, formatting, haptics
modules/vault-security  Android window, privacy, clipboard, actual-key inspection
plugins                 Reproducible Android hardening through Expo CNG
```

See [SECURITY.md](./SECURITY.md) for security guarantees, metadata, and platform limitations.

Dependency adjustment from the proposal: `@hookform/resolvers` is pinned to 5.2.2 because 6.0.0 introduced an unrelated optional Effect/Typeschema peer conflict. The selected version supports the Zod 4 / React Hook Form 7 integration used here.

PBKDF2 runs through Android's native SecretKeyFactory on a background thread. The initial pure-JavaScript path was prohibitively slow under Hermes during emulator verification. The native path preserves the same SHA-256 algorithm, 600,000-iteration floor, salt size, and key size; it does not weaken the work factor. Noble remains responsible for HKDF and hashing.
