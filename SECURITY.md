# Security model

## At-rest protection

The master passphrase is used only in memory. Android's native PBKDF2-HMAC-SHA-256 derives a 256-bit root with a random 32-byte salt and 600,000 iterations on a background thread. HKDF-SHA-256 separates payload and verification keys. Password character arrays/specifications, root material, derived verification material, and mutable session key buffers are overwritten when their work is finished.

New master and dedicated backup passwords allow 5-256 characters, including digits. This shorter minimum does not weaken the encryption algorithms or reduce the KDF iteration count, but short passwords, especially five-digit numeric choices, are substantially easier to guess offline. Longer passphrases are strongly recommended. Existing passwords and backup decryption credentials are unchanged.

The encrypted verification token binds the vault identifier. AES-256-GCM authenticates both the verifier and the complete vault snapshot. Every encryption uses a fresh 96-bit nonce and 128-bit tag. Authenticated additional data binds the format, KDF parameters, vault identifier, purpose, scope, and revision through a fixed array encoding.

SQLite receives only ciphertext and public headers. Card/note fields, record timestamps, owner labels, categories, and searchable content are not stored in plaintext columns, journal entries, or indexes. Non-sensitive UI preferences remain unencrypted. Format metadata, ciphertext size, revision, and the existence of a vault remain observable.

Card values are user-controlled text, not verified payment credentials. Runtime schemas enforce required fields, supported network labels, record identifiers, and resource-size limits, but do not enforce Luhn, card-network/PAN-length matching, CVV rules, expiry formatting, or expiry freshness. Imported and locally restored records use the same permissive card schemas. Removing financial validation does not bypass encryption or fresh-action authentication.

New backups require a dedicated, confirmed export password, a new salt, and a separate HKDF purpose label. There is no master-password export mode or stored backup password. The same export password is required to decrypt that file; fingerprints cannot substitute for a portable file's decryption password. Existing backup formats and their original passwords remain compatible. Imported data is validated and re-encrypted with the receiving session's local payload key. An authenticated snapshot can still be replayed by an attacker with full filesystem control; this fully offline design does not claim external rollback detection.

## Session and writes

Decrypted records exist in a non-persisted Zustand session. The payload key is held separately in a private volatile keyring. There is no session persistence or development-tools middleware.

Card/note editor drafts, including incomplete values, are held in the same volatile session with separate new-record and per-record keys. Form updates and editor closure retain the latest values without persisting them. Successful saves and record deletion remove the applicable draft. Locking/backgrounding clears every draft; generation checks prevent late form or dismissal callbacks from repopulating cleared state. Drafts are excluded from encrypted snapshot serialization and backups. Authentication and backup-password inputs are not cached in this draft store.

Backgrounding or an inactive AppState invalidates the session generation, clears the keyring and state, and unmounts sensitive navigation, editors, and the bottom-sheet portal host. Android focus loss also shields the native window and locks an unlocked session, except while an app-initiated authenticated SecureStore biometric operation is pending in the same active session. That narrow focus-only exception preserves the editor while Android prompts; it never exempts actual backgrounding from locking. A stale asynchronous callback cannot publish records into a later session.

Creating, editing, or deleting a card/note and saving an import merge requires fresh master-password verification or an authenticated biometric key read. Single-use authorization binds the operation, an existing record's target identifier when applicable, generation, revision, and a 60-second validity period. A biometric read must pass actual hardware-protection checks and return the exact payload key for the current session before an authorization is issued. Cancellation, invalidation, mismatch, or a generation/revision change cannot authorize a write. The password remains available as a fallback. Writes are serialized, encrypted before persistence, revision-checked, and transactionally committed.

## Biometric storage

Biometrics are off by default. SecureStore protects the exported payload key with an Android Keystore AES wrapping key that requires authentication for each operation. The native adapter inspects the actual SecureStore key alias for hardware protection and authentication policy. It fails closed if those properties cannot be verified. Each biometric confirmation performs a new authentication-bound SecureStore read, rather than trusting a separate biometric-success boolean or reusing a previous approval.

Initial setup requires the master password. Once enabled, disabling fingerprints accepts a fresh fingerprint or master-password authorization. Enabling fingerprints still clears the active session before storing the hardware-protected key.

The alias adapter is pinned to expo-secure-store 58.0.2 and must be revalidated during an Expo upgrade. Unsupported devices remain password-only.

The wrapped vault key is not itself a non-exportable Keystore key: it must enter application memory to decrypt the vault. Root and password-verification keys are not stored alongside it. Enrollment invalidation/cancellation does not delete the vault.

## Android leakage controls

- FLAG_SECURE is installed at activity startup, before the React surface loads.
- expo-screen-capture also blocks capture at the application root.
- A native opaque shield covers the activity on pause/focus loss without waiting for JavaScript.
- Sensitive clipboard entries are flagged and cleared by a native ownership-aware timer/lifecycle guard.
- Sensitive text fields disable correction, spellcheck, autofill, autocomplete, and unrestricted context menus. The native activity applies IME_FLAG_NO_PERSONALIZED_LEARNING to its editable views.
- Release internet/network-state permissions are blocked, cleartext traffic is disabled, and Android cloud/device-transfer backups are excluded.
- All JavaScript, icons, and fonts are embedded. No application telemetry or remote crash-reporting service is configured.

Expo SDK 58's screen-capture module registers an Android capture observer during native initialization. Its normal DETECT_SCREEN_CAPTURE permission is retained because removing it causes a native startup abort, even when the app only requests capture prevention. READ_MEDIA_IMAGES is explicitly removed; no photo-library permission is requested. This permission does not grant network access or access to screenshot files.

## Explicit limits

This is application-level zero-knowledge storage, not protection against a compromised operating system.

JavaScript strings, React/runtime copies, and native crypto handles cannot be provably zeroized. Buffer overwriting and reference removal are best effort; no forensic RAM-erasure claim is made.

Process death can prevent application timers from firing. Clipboard cleanup is attempted earlier on lifecycle loss, retained for retry when Android denies access, and retried on foreground restoration. Cardvault cannot erase copies already made by a keyboard, accessibility service, clipboard manager, or another application.

FLAG_SECURE cannot block an external camera, a rooted OS, or every manufacturer bug. Physical-device verification remains necessary, particularly for biometric enrollment invalidation and lifecycle/screen-recording behavior. An emulator does not prove hardware-backed key protection.

Sharing encrypted files and choosing a document provider delegates to applications with their own network permissions. Only Cardvault's own release process is denied network access.

No third-party security audit or PCI compliance certification is claimed. There is no cloud recovery, password escrow, or backdoor. Maintain independent encrypted backups and a safe record of the master passphrase.
