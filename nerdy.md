# Cardvault technical guide

For downloading and using the app, start with the [user guide](./README.md). This document covers development, release automation, configuration, and implementation details. Keep real keys, tokens, passwords, and signing material out of all Markdown and commits; use GitHub Actions secrets or ignored local configuration. Examples below contain only configuration names and placeholders.

[Local development](#run-on-android) | [APK releases](#automated-apk-releases) | [HandyAPI](#card-led-entry-and-optional-api-auto-fill) | [Validation](#validation) | [Architecture](#architecture)

An Android-only, offline-first credit-card and secure-notes vault built with Expo SDK 58, React Native, and strict TypeScript, with optional online BIN lookup for card-entry suggestions.

[![Latest release](https://img.shields.io/github/v/release/sarthakworks/CardVault)](https://github.com/sarthakworks/CardVault/releases/latest)

## APK assets and compatibility

[Download the latest ARM64 APK](https://github.com/sarthakworks/CardVault/releases/latest/download/cardvault.apk) for most modern phones, or [browse all versions on GitHub Releases](https://github.com/sarthakworks/CardVault/releases). Open a release and choose the matching APK from **Assets**. `SHA256SUMS.txt` contains a checksum for each APK.

| Device CPU | Download |
| --- | --- |
| ARM64 (`arm64-v8a`), most modern phones | `cardvault.apk` |
| 32-bit ARM (`armeabi-v7a`) | `cardvault-armeabi-v7a.apk` |
| 32-bit x86 | `cardvault-x86.apk` |
| 64-bit x86, including x86_64 emulators | `cardvault-x86_64.apk` |

With a device connected over ADB, `adb shell getprop ro.product.cpu.abilist` lists its supported CPUs. Install one matching APK, not all four. All APKs share the same app version, build number, and signing key.

Automated releases become available after the one-time setup below. Each release identifies both the app version and the unique Android build number, for example **Cardvault 1.0.0 (build 42)**, tagged `v1.0.0-build.42`. Non-default-branch and tag pushes produce prereleases; the current default-branch build is marked **Latest**.

Install the standalone APK on an Android 10+ phone, allowing installation from that file's source when Android asks. Expo Go, a QR code, and a running development server are not required.

**Export an encrypted backup before changing installations.** Android normally blocks installing a lower build number or updating an app signed with a different key. The previous locally built APK uses a development key and cannot be updated in place by a new EAS-signed release. If Android requires uninstalling, export first: uninstalling erases the local vault. Keep the backup password so you can import into the new installation.

## Automated APK releases

`.github/workflows/android-release.yml` builds and publishes the four CPU-specific APKs on **every push**, including branch and tag pushes. All four are produced by **one EAS build**, not four builds. **Actions > Android APK release > Run workflow** also starts a build manually after the workflow is on the default branch. No pushes are cancelled in favor of newer builds, and previous releases remain downloadable.

The workflow validates TypeScript and lint, waits for a signed EAS `release` build, verifies its platform/status/version/source commit, downloads its additional build-artifact archive, and publishes all four APKs with SHA-256 checksums. EAS's primary installable artifact is the ARM64 APK; the additional archive contains every CPU version. Failed builds, missing/wrong CPU APKs, and APKs larger than **20,000,000 bytes (20 MB)** do not publish a release. Releases point to the pushed commit, not whichever commit happens to be at the branch tip when the build finishes. Tags created by the workflow's `GITHUB_TOKEN` do not trigger another workflow run.

### APK download size

The old universal APK bundled four copies of native libraries and was about 104.6 MB. The release config now enables ABI splits, native-library and JavaScript-bundle compression, R8 minification, and unused-resource shrinking. Each download includes just one CPU architecture, preserving support for all four CPU types through separate assets rather than removing device support or vault features.

Compression reduces the download size, not the installed footprint: Android extracts compressed native libraries during installation, and bundle compression can add startup decompression work. The 20 MB check applies to each downloadable APK. Existing universal releases are not modified or deleted.

### EAS Free plan

Keep the Expo account that owns this project on the **Free ($0/month)** plan; confirm **Current Plan** in [Expo Billing](https://expo.dev/settings/billing) before starting builds. The `release` profile explicitly uses the Free-compatible **medium** Android worker. It does not require a paid subscription or a large worker.

As of November 2026, the [Free plan](https://expo.dev/pricing) includes up to **15 Android builds per calendar month**, with a low-priority queue and a 45-minute build timeout. The initial signing/setup build and subsequent builds, including reruns and prereleases, use the same account's allowance. Building on every push can exhaust that allowance quickly. Check the linked pricing page before relying on these limits.

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

3. In this repository's **Settings > Secrets and variables > Actions**, add a repository **variable** named `EAS_PROJECT_ID` containing that UUID, a repository **secret** named `EXPO_TOKEN` containing an [Expo access token](https://expo.dev/settings/access-tokens) with access to the project, and a repository **secret** named `EXPO_PUBLIC_HANDY_API_KEY` containing your HandyAPI **Publishable (Frontend)** key.
4. Make sure repository/organization Actions policies permit this workflow's `contents: write` permission so `GITHUB_TOKEN` can create releases. Commit and push the workflow, or run it manually after setup.

Signing credentials are managed by EAS and reused across builds; there is no fallback to the template's public development key. Preserve and securely back up the keystore: changing it prevents in-place updates. Never commit tokens, keystores, or `credentials.json`. Missing CI settings fail the workflow with a setup error rather than publishing an unsigned or development-signed APK.

GitHub Actions is the source of the HandyAPI key for automated releases; no separate Expo environment variable is required. The build step temporarily injects the GitHub secret into the `release` profile's `env` in `eas.json`, then restores the original file on success or failure. Only the private EAS build receives this temporary configuration; it is not committed or attached to the GitHub release. The workflow never prints the key, and local `.env` files stay excluded from Git and EAS uploads. A missing, blank, or multiline key fails before requesting an EAS build. The key is still embedded in the installed APK, so it must be a publishable frontend key, never a backend secret.

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

Build tools need internet access when downloading dependencies. The installed app permits HTTPS internet access for optional HandyAPI lookup, but blocks network-state/Wi-Fi-state permissions. It has no application telemetry, remote crash-reporting service, cloud vault storage, or OTA updates. Card storage, notes, search, backups, and manual card entry remain available offline.

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
- Master-password or optional strong biometric unlock when reopening a closed app; biometric setup verifies the actual hardware-backed, per-use-authenticated Keystore wrapping key.
- No extra password/fingerprint prompts for card/note creation, edits, deletion, import merging, or ordinary settings; enabling fingerprint unlock uses Android's protected-key setup prompt.
- Realistic card artwork, explicit secure copy/edit controls, owner/bank/network filtering, and sorting.
- Title-and-text-only notes, searchable paper-style grid/list views, full-screen editing, and timestamps.
- Persistent light/dark themes, reduced-motion-aware animations, and haptics.
- Encrypted-by-default `.vault` backups, optional password-free unencrypted export/import, file-manager saving, and sharing.
- Native secure windows, an opaque lifecycle privacy shield, session clearing, and clipboard expiry.

The app starts empty. There are no sample cards, preconfigured passwords, or hidden recovery credentials.

## Detailed interaction and session behavior

The Cards homepage keeps the collection front and center: **All owners** and the sort control open compact dropdowns beside their buttons, not bottom sheets. **Filters** groups bank and network choices in one dropdown; **Show cards**, an outside tap, or Android Back dismisses it without ending the session. Active filters show a result count and **Reset** action.

Tap the **copy icon beside a card number** to copy its complete stored value; the masked number itself stays private. A normal tap on the artwork does nothing. **Press and hold**, **swipe left or right**, or use the **More** icon below a card to open **Edit card**, **Copy card number**, **Share card details**, and **Delete card**. Deleting asks for confirmation before permanently removing the card from this vault. Vertical swipes still scroll the collection. The separate **pencil icon below the card** opens its editor directly, where you can also reveal/copy the CVV or delete the card with confirmation.

**Share card details** opens the system app chooser with plain text containing the bank, network, cardholder, full card number, expiry, CVV/security code, and owner. There is no additional confirmation or password prompt. Holding or swiping only opens the actions menu; it never shares automatically. This text is **not an encrypted backup**: only choose an app or recipient you trust.

On first launch, **Create your vault** keeps setup to a master password, confirmation, and one action. Choose a master password of 5-256 characters. Numbers are allowed, but the password is not restricted to digits. Longer passphrases are strongly recommended because short passwords are much easier to guess. The password is never stored, and there is no password-recovery service. Existing passwords are not shortened or changed by this minimum-length update.

Unlock with your master password when opening Cardvault after closing it. You can create, edit, delete, copy, import, and adjust ordinary settings without authenticating again. Enabling fingerprint unlock uses Android's protected-key setup prompt. Deletions still ask for a simple confirmation to prevent accidental removal.

Manage optional fingerprint unlock with **Settings > Security > Fingerprint unlock**. Turn the switch on while your vault is unlocked and complete Android's protected-key setup prompt; you do not need to re-enter the master password. The switch is unavailable when the device lacks supported, enrolled strong biometrics, with a short explanation in the row. Turn it off to remove the saved biometric-unlock key. The opening screen shows **Use fingerprint** only when enabled and always keeps master-password unlock available. If Android enrollment changes, unlock with the master password and configure fingerprint unlock again in Settings.

The native SecureStore-key inspector recognizes per-operation authentication as legacy `KeyInfo` validity `-1` or modern Keystore2 timeout `0`. Android 11+ must also report the exact strong-biometric authenticator type. Keep hardware-backed storage and hardware-enforced authentication checks: accepting zero alone, a timed key, or a software key would weaken the policy. Denials distinguish the failed protection check without logging key material. Native-policy changes require an updated APK; a failed prior enrollment can be retried from the switch without uninstalling or clearing vault data.

SecureStore can resolve a successful biometric request while Android's biometric window still has focus. `runBiometricPrompt` therefore waits for real app/window focus using lifecycle events and a bounded three-second deadline before returning. It aborts on backgrounding or a session-generation change and cleans up its subscriptions/timer on every outcome. Do not remove `authService`'s foreground check or replace the handoff with an unconditional sleep; the unlocked snapshot must not be published while another window/app is active.

Switching apps, opening the notification drawer, turning the screen off, and choosing or sharing a file keep the current session and drafts in memory. The native privacy shield still covers the window while it is not in focus. Closing Cardvault with Android Back at the root, removing its task, or process termination ends the session; reopening requires credentials. Android can also terminate a background process to reclaim memory, so a later cold launch will ask again.

Copying a card number or CVV marks the clipboard entry sensitive. The native guard clears an app-owned entry within 30 seconds while active, or earlier when focus/session is lost. It does not erase a newer unrelated clipboard entry.

### Notes

Notes use a clean, searchable grid or list. Tap a note to edit it directly, or **New note** to open a full-screen writing canvas. The editor has only **Title** and **Note**: no tags, categories, or classification fields. Either field can be left empty, but a saved note needs a title or some text.

Use the back arrow, **Done** checkmark, or Android Back after dismissing the keyboard to save and return to the collection. Unchanged notes are not rewritten; an empty new note is discarded. Existing notes cannot be overwritten with completely empty content. **More > Discard changes** leaves the saved version untouched. The full-screen editor covers the tab bar without resetting the collection's search/layout or the other tabs.

Long-press a preview or use its **More** button to edit, copy, share, or delete. Card/note deletion and note-draft discard use the same themed in-app confirmation, with a record preview and a clear **Keep** action instead of a system alert. Card previews reveal only the bank, network, and last four digits. Back or an outside tap cancels; controls stay disabled during deletion, and failures stay visible for retry. **Copy note** uses the sensitive clipboard with its expiry guard. **Share note** opens the system app chooser with just the title and note text, not an encrypted backup; the receiving app controls that plaintext copy.

Older vaults and backups still load. Old note-category metadata is ignored and removed from parsed notes, new saves, and exported snapshots without losing the title or text.

### Session drafts and bottom sheets

Card and note drafts stay in memory throughout the current unlocked session. The dedicated card editor keeps its draft with the Back arrow or Android Back, then restores it when reopened; **Save card / Save changes** commits it. Notes save with Back/Done. Switching apps retains both editors and drafts. Different records keep separate drafts. Successful saves clear only that editor's draft, and deleting a record clears its associated draft.

To dismiss a sheet by gesture, drag its top handle down to the bottom. Outside taps do not close it. Android Back closes the current dismissible sheet and retains its editor draft, and scrolling form content does not pan the sheet itself. Explicit Save, Close, and Cancel actions remain available where appropriate.

Drafts are not written to SQLite, exported, or restored after process death. Save a note with Back/Done before closing Cardvault. Closing the app or ending the session wipes unsaved drafts together with other decrypted state; ordinary backgrounding does not. Master-password and backup-password fields are not cached as drafts.

### Card entry validation

#### Card-led entry and optional API auto-fill

New and edited cards open a dedicated full-screen page, not a bottom sheet. A masked live card preview shows the bank, network mark, network tier directly below the mark, card type and country. The four main inputs are card number, expiry, CVV and name; Owner stays compact, and **Card details** always expands inline for bank/network/tier/type/country corrections. There are no bank/network preset chips. The expiry calendar selects month/year only; numeric entry still works. Existing-card **Card options** retains **Copy CVV** and confirmed deletion.

The preview's percentage width and maximum width are explicitly bound to its parent, independently of its font-scaled minimum height. Do not rely on `aspectRatio` plus a minimum height alone: Yoga can derive a card wider than its container on narrower logical screens or larger Android font settings. Header copy can shrink/wrap, shared button labels wrap within their controls, and the note footer wraps rather than pushing text off-screen. Keep system font scaling and safe-area handling enabled.

For local development and local native builds, create an ignored local `.env` file with this field, then fill it in locally with your HandyAPI **Publishable (Frontend) API Key**:

```dotenv
EXPO_PUBLIC_HANDY_API_KEY=
```

Never put a **Secret (Backend) API Key** here or put any actual credential in Markdown: Expo embeds `EXPO_PUBLIC_` values in the APK, where they can be extracted. Use HandyAPI's supported client-key restrictions to protect your quota; native requests do not spoof a browser Origin. A secret backend key requires a separate server-side proxy.

While entering a card number, the editor waits briefly after eight digits and requests only that **8-digit BIN** from `https://data.handyapi.com/bin/<BIN>` using the `x-api-key` header. For `Status: SUCCESS`, it copies **Issuer -> bank**, **Scheme -> network**, **CardTier -> network tier**, **Type -> card type** and **Country.Name -> country**. Text is preserved as returned, including the complete Issuer name; there are no guessed fallback labels. No complete card number, CVV, expiry, cardholder, owner, notes or vault keys are sent. HandyAPI still sees your BIN lookup, public key and network address, so the app is no longer network-permission-free.

Successful partial responses fill available string fields without clearing missing ones. Failed, malformed or non-successful responses, timeouts and missing configuration leave current values unchanged. Every field remains editable; manual corrections are protected from late replies, and **Use API details** inside the expander explicitly reapplies returned values. The preview keeps received/current values visible without duplicate summaries, toasts or API alerts; missing fields and failures use ordinary persistent inline text. Opening a saved card or restoring a draft does not perform a lookup; **Detect card details** opts in for that number. Session drafts retain ownership for all five fields.

Missing configuration, unavailable BINs, timeouts, rejected keys and rate limits leave manual entry available with an inline explanation. Type, tier and country are optional in older saved cards/backups; no vault-format migration is needed. Only Country.Name is retained, not its other codes. The API's Luhn flag does not change validation.

**Camera and NFC entry:** New-card actions open an in-window reader and then an editable number/expiry/holder review. **Use details** returns corrected fields to the existing editor and forces a fresh HandyAPI request for the corrected **8-digit BIN**, including when that BIN was previously looked up. No lookup is made while editing the review. CVV/owner and protected manual metadata stay in the editor; review acceptance is not a vault write or payment-card verification.

`modules/card-reader` is an Android Expo module, autolinked from the existing local-modules directory. Its source manifest declares camera/NFC permissions and optional hardware features, without audio/storage permissions. CameraX preview/image analysis uses a per-view lifecycle and Google Play services ML Kit Latin OCR; the model is **not bundled** and may require a first-use download. Model preparation has a timeout and visible failures. Physical card images are processed in memory, never written to a photo/cache file.

OCR normalizes Unicode spacing/full-width digits, isolates dates before finding PANs, handles up to five consecutive numeric fragments, and allows at most two common OCR character substitutions only when the resulting number is uniquely Luhn-plausible. Leading-zero, masked, conflicting, or otherwise inconclusive candidates are not selected. The same number must appear in three of the last five observations in the same input mode, including the current frame; original and enhanced images have independent windows so failures in one do not dilute the other. An occasional empty frame or missing expiry no longer resets all progress. Expiry/name values need a unique winning value seen at least twice for that same number. A short settling interval gives expiry another chance before opening an editable partial review. This heuristic does not change manual-save validation or establish card ownership.

Native events also retain bounded word rectangles and their parent-line identifiers. The parser uses alignment, spacing, and comparable text height to reconstruct horizontal, vertical, and wrapped numeric groups instead of trusting ML Kit's block iteration order. Printed rules and unrelated words do not break a spatial group; CVV/security-code-labelled and masked parent lines are excluded. Both row-major and column-major candidates must still pass the ordinary uniqueness/checksum checks rather than guessing an arbitrary reading order.

Analysis prefers 1920x1080 with CameraX's supported-resolution fallback, retains only the latest frame, and throttles OCR rather than queueing images. Initial focus uses the preview center; touch refocus sends a normalized point atomically to CameraX for focus/exposure at the actual tap, independent of display density. Accessibility activation retains center focus. An optional torch control remains available. Control failures are persistent, nonfatal inline hints; stale control results are ignored. Closing/pausing the reader unbinds the camera and its light. Higher resolution and these controls improve the available input; they cannot reconstruct digits hidden by severe blur, glare, damage, or occlusion.

After several unconfirmed frames, the reader alternates original images with an in-memory contrast pass. `CameraFrameEnhancer` respects Y-plane row/pixel strides and buffer offsets, bounds processing to a 1600-pixel longest side, and applies contrast-limited adaptive histogram equalization with interpolated tile maps. A further bounded component pass suppresses only large, sparse decorative rules in either polarity; isolated character strokes remain, and removal has component/pixel budgets. This is pixel preprocessing, not dropping recognized digits to force a checksum match. It supplies neutral-chroma NV21 to ML Kit and clears its temporary image/working arrays. Original frames remain in the rotation, and an unsupported contrast path is disabled with an inline explanation rather than stopping ordinary scanning. No enhanced image is saved or uploaded.

Recognition must remain free and on-device: no commercial license-key dependency or photo-upload OCR service is configured. A generic ML Kit wrapper would not solve the same underlying glyph/layout issue. Alternative OCR runtimes must be evaluated for actual accuracy, maintenance, licensing, ABI support, and the per-APK size cap rather than silently replacing the current engine.

For an explicitly authorized physical-device diagnosis, opt-in `CardvaultScan` logs contain only counts, character classes, confidence, checksum results, and bounding boxes, never recognized text, card values, or images:

```sh
adb -s PHONE_SERIAL shell setprop log.tag.CardvaultScan DEBUG
adb -s PHONE_SERIAL logcat -s CardvaultScan:I '*:S'
# Restore the previous default afterward.
adb -s PHONE_SERIAL shell "setprop log.tag.CardvaultScan ''"
```

The module packages `consumer-rules.pro` to retain the public no-argument constructors of Firebase component registrars, which ML Kit discovers through manifest metadata and reflection. Keeping only the registrar classes is insufficient under R8 full mode: their constructors can disappear and crash `TextRecognition.getClient` when the camera view attaches. Keep this targeted rule when upgrading the scanner SDKs, and verify camera startup in a minified release build, not only parser tests or a debug build. Minification and resource shrinking remain enabled.

The native NFC transport reads ISO-DEP EMV data on a worker, with foreground-only reader mode, a tap timeout, an elapsed read deadline, bounded responses/continuations/commands, and a defensive BER-TLV parser. Unsupported/disabled hardware and inaccessible card profiles fail explicitly. The printed CVV is never imported. Lifecycle/window-focus loss, cancellation, retry, and session invalidation stop readers or reject stale results; no raw tag responses or card images are logged. See [SECURITY.md](./SECURITY.md#camera-and-nfc-card-entry), including Google's SDK-metrics disclosure.

Rebuild the Android APK after adding this module; Metro reload alone cannot add its native view/readers. The existing per-APK **20,000,000-byte** release cap is unchanged. NFC needs an NFC-capable physical phone/card, and real card/camera coverage must be verified on physical devices; an emulator or synthetic parser test cannot establish universal issuer support. There is no browser/Expo Go payment-card NFC implementation.

The installed release app needs a new APK after adding/changing the key. The Android config plugin tracks `.env` files and a fingerprint of the public environment value as JS-bundle inputs, so changing only the key cannot silently reuse the old bundle. Automated GitHub releases receive the key from the `EXPO_PUBLIC_HANDY_API_KEY` repository Actions secret as described above; your local `.env` is neither committed nor uploaded. Manual EAS cloud builds outside that workflow must supply the public key separately through their EAS build profile or environment. Android's HTTPS internet permission is enabled through app config; regenerate/build Android after this change. Local storage, editing, search, backups and manual card entry remain available offline.

New cards and saved edits require a **13-19 digit card number**, a **3-4 digit CVV**, and a valid expiry month in **MM/YY or MM/YYYY** format. Months must be 01-12, and the expiry cannot be earlier than the current month. A card expiring this month remains valid through that month. Two-digit years are interpreted as 2000-2099.

The three fields use numeric keypads and remove non-digit input; expiry inserts its `/` automatically. Pasted card numbers can contain spaces or hyphens, which are removed. Fields show inline validation errors when you leave them or try saving. There is no Luhn or card-network-specific number/CVV rule.

Existing saved cards and imported backups remain readable, including older free-form or expired values. These new entry rules are not applied when unlocking, importing, or saving unrelated records, so an older value cannot make the vault unreadable. Saving an edit to such a card requires correcting its fields to the current entry rules. Existing grouped numeric card numbers are normalized in the editor without changing their digits.

Storage-size safeguards for legacy/imported records remain: card numbers support up to 128 characters, and expiry/security-code values support up to 32 characters each. Expiry sorting recognizes compact numeric dates and MM/YY or MM/YYYY values, keeping other text afterward.

Saving a card writes it directly to the encrypted vault without a password or fingerprint confirmation.

## Backups

Exports are encrypted by default and require one dedicated backup password of 5-256 characters, entered once. There is no master-password export mode. Choose a separate, preferably longer password and keep it safe: the app never stores it and fingerprint cannot encrypt or decrypt a portable backup in place of that password.

To export without a password, select **Export without encryption (no password)** below the password field. Both formats include all saved cards and notes, not unsaved drafts. **An unencrypted `.vault` file exposes full card numbers, security codes, note text, and record metadata to anyone who can access it, and can be modified without detection.** Only use this option deliberately and store the file privately.

After **Export backup**, choose **Save to files** to open Android's system **Save as** dialog. Select **Downloads** or another writable location offered by your file manager, edit the filename if desired, and save. This uses per-document access, not broad storage permissions; Android and document providers still restrict protected locations. Unlike a directory-tree picker, it supports saving directly in Downloads on Android 11+. Cancelling the picker leaves the prepared backup available for retry without claiming it was saved. **Share via app** remains available separately. Folder saving requires an Android rebuild containing the native save-dialog addition; restarting Metro alone does not add native functionality.

Settings is organized into compact **Appearance**, **Security**, and **Backups** groups. **Backup files** lists documents saved through **Save to files**, with their actual provider-reported names, sizes, and locations. Use **Open existing** to add older `.vault` files or copies saved through another app; Android does not allow silently discovering every backup on the device. Tap a file for a read-only, soft-wrapped view of its stored text. No additional password is requested: encrypted files display their encrypted envelope, not decrypted records. Expand the location to see the exact document URI; some providers expose only their name and URI rather than an absolute filesystem path.

The file list retains per-document read access across app/device restarts, where permitted by Android. It stores only filenames, locations, URIs, sizes, and the time each document was added in the app's local preferences, not another copy of file contents. Moved/deleted files or revoked permissions produce an explicit error; select the file again using **Open existing**. Files are read afresh, bounded to 12 MB, and long raw content is rendered in virtualized blocks. Rebuild Android to include the native document-metadata/read-access addition. Sharing a backup does not reveal the receiving app's final save location to Cardvault.

For import, choose a local `.vault` file. Unencrypted exports are detected automatically and go straight to the record-count review without asking for a password. Encrypted files still need the same password used to encrypt that file. Review the counts and choose **Merge into my vault**; there is no additional master-password or fingerprint confirmation. File selection, saving, and sharing do not lock the current session. Imported records get fresh identifiers and never replace existing ones; importing twice creates duplicates. Either format is validated and re-encrypted with the receiving vault's local payload key, not the backup password.

Existing backups remain compatible: enter the password originally used to encrypt the file. If an older backup was exported using the old master-password option, that original password still decrypts it; the new app only removes that option when creating new exports.

The local vault supports up to 8 MB of serialized plaintext, 5,000 cards, and 5,000 notes. Each note supports 100,000 characters. Backup inputs are bounded to 12 MB; encrypted backups allow 600,000-2,000,000 KDF iterations. Limits produce explicit errors; data is never silently truncated.

Prepared exports stay in memory until a save/share action is chosen. Saving writes directly to the chosen document without an additional app-cache copy. Sharing creates a temporary `.vault` file, encrypted or explicitly unencrypted, retained until the next cold launch so the recipient has time to open its URI. Selected encrypted imports use the owned cache and are removed after merging, explicit discard, or the next cold launch. Unencrypted imports are reviewed only in memory without an app-cache copy. Cache cleanup targets only Cardvault-owned `.vault` files and cannot erase saved files or copies held by another app.

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

The template release signing configuration is for local installation and verification. Automated GitHub APK releases use the persistent EAS signing credentials configured above; the `release` profile produces four CPU-specific APKs for direct installation, not a Google Play app bundle. Do not commit signing keys or passwords.

### Verification scope

Run the validation commands for the checkout being released rather than treating an earlier successful build as a guarantee. A local ARM64 build does not verify the other three release architectures or physical-device behavior.

The current session policy intentionally replaces the earlier per-action confirmations and background locking. Routine writes require an unlocked session, but not a fresh credential. Backgrounded sessions remain in memory until the app closes or the operating system terminates the process. Screen-capture prevention, clipboard expiry, local-vault encryption, revision checks, and encrypted-backup password requirements remain independent controls.

Password-boundary checks should cover rejection below five characters, acceptance at exactly five characters including digits, mismatched confirmation, and dedicated-backup password handling. Never use real credentials or vault records as test fixtures.

Inspect the actual APK's manifest and assets: HTTPS internet permission is expected for optional lookup; network-state/Wi-Fi-state and broad-storage permissions should remain blocked. Release builds should not be debuggable, should disable cleartext/automatic backup, and should exclude all nine configured backup domains from cloud and device transfer. Do not clear an existing vault or emulator to perform verification.

Hardware-backed biometric success/enrollment invalidation and manufacturer-specific screen-recording behavior require physical Android-device verification. No independent security audit or PCI compliance certification is claimed. Distributed APKs use the persistent EAS signing key, not the local template's development key.

## Architecture

```text
src/app                 Providers and locked/unlocked navigation
src/core/crypto         KDF policy, key separation, GCM, authenticated envelopes
src/core/storage        SQLite migrations, ciphertext repository, UI preferences
src/core/security       Volatile keyring, session lifecycle, opening-only biometric unlock
src/core/vault          Runtime schemas, typed models, serialized mutations
src/features            Auth, cards, notes, settings, backups
src/shared              Theme tokens, accessible controls, formatting, haptics
modules/vault-security  Android window, privacy, clipboard, actual-key inspection
plugins                 Reproducible Android hardening through Expo CNG
```

See [SECURITY.md](./SECURITY.md) for security guarantees, metadata, and platform limitations.

Dependency adjustment from the proposal: `@hookform/resolvers` is pinned to 5.2.2 because 6.0.0 introduced an unrelated optional Effect/Typeschema peer conflict. The selected version supports the Zod 4 / React Hook Form 7 integration used here.

PBKDF2 runs through Android's native SecretKeyFactory on a background thread. The initial pure-JavaScript path was prohibitively slow under Hermes during emulator verification. The native path preserves the same SHA-256 algorithm, 600,000-iteration floor, salt size, and key size; it does not weaken the work factor. Noble remains responsible for HKDF and hashing.
