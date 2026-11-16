# Cardvault

Keep your cards and private notes together, encrypted on your Android phone. No account needed.

[![Latest release](https://img.shields.io/github/v/release/sarthakworks/CardVault)](https://github.com/sarthakworks/CardVault/releases/latest)

**[Download for Android](https://github.com/sarthakworks/CardVault/releases/latest/download/cardvault.apk)** | [All versions](https://github.com/sarthakworks/CardVault/releases)

Requires Android 10 or newer. The main download works on most modern Android phones; other device versions are available on the releases page.

## Get started

1. Download and open the installation file. If Android asks, allow installation from the browser or file manager you used.
2. Open Cardvault and create your master password. Use a long, memorable password and keep it safe.
3. Add your cards and notes. You can turn on fingerprint unlock later in **Settings > Security > Fingerprint unlock**, if your device supports it.

**There is no password recovery.** Cardvault cannot reset your master password or recover your vault for you.

## Your everyday essentials

### Cards

Add a card, enter its details, and tap **Save card**. Use the pencil icon to edit it later, then **Save changes** to keep your edits.

On **New card**, choose **Scan card** for the camera or **NFC** to read a supported physical contactless card. In **Review the details**, correct the number or expiry and add/edit the cardholder name. CVV stays manual. **Use details** returns to the editor and looks up the corrected number's first eight digits; you still need to tap **Save card**.

The camera opens review automatically after it confirms the number, including common horizontal, stacked, and wrapped layouts. It also tries a contrast boost for faint text. Hold the card still, tap the printed number in the preview to focus on it, and use **Light** if your phone supports it. Tilt the card slightly to avoid reflections. Very blurred, hidden, or damaged details may still need manual entry.

Camera scanning needs camera permission, Google Play services, and an internet connection to prepare its on-device OCR model the first time. Photos are not saved or uploaded. NFC needs a compatible phone and card; some cards omit details or cannot be read. Manual entry is always available. Neither scanning nor the lookup proves ownership or that a card is active.

Cardvault can look up the first eight digits of a card number to suggest its bank, network, and other details. Review the suggestions and correct anything under **Card details**. You can always enter everything yourself, including when offline.

Use the copy icon beside a card number to copy it. Use **More** for sharing or deletion; deletion asks for confirmation. Tap outside an open action panel to slide the card back into place, whether it was swiped left or right. Cards always sort by bank name. **All names** and **All banks** filter the saved collection; the bank list contains only banks on your saved cards. Filters and search stay in memory while switching apps or minimizing, and reset when the app fully closes or its process ends. They are never saved to disk.

Search cards locally by bank, variant, name on card, tier, network, type, country or card number (including the last four digits). Combine words such as **fedral scapia credit**; text search tolerates small spelling mistakes. Common bank/network aliases also work, such as **AE/Amex**, **HSBC**, and **SBI**. Number matching is exact, and expiry, CVV and record timestamps are never searched.

Saved cards show their full number, expiry, CVV, and card type on the artwork. Expand **Card details** when creating or editing a card to add an optional **Variant** (up to 15 characters, such as Scapia, IOCL, or Flipkart); it appears beside the type. The name on card sits beside the chip.

The add/edit preview uses the same card design and updates as you type. Empty fields show placeholders such as **Your bank**, **MM/YY**, or **XXX**; placeholders are never saved. The preview has no copy or More icons. On the add screen, **Clear All** or the preview's bin icon clears every field and discards the draft without saving a card.

Use **More > Copy details** to copy only the number, CVV, expiry date, name on card, and bank. This uses the same protected, expiring clipboard as number-only copying. Keep your screen and clipboard private when viewing or copying card details.

Going Back from the card editor keeps an unsaved draft only while the app stays open. Save before closing the app.

### Notes

Create a note with a title, some text, or both. Notes save when you use **Back** or **Done**, not after every keystroke. Search your notes or switch between grid and list views.

Long-press a note or open **More** to edit, copy, share, or delete it.

### Make it yours

Choose a light or dark appearance in Settings. Fingerprint unlock is optional, and your master password remains available as a fallback.

## Back up what matters

Cardvault does not keep a cloud copy of your vault. Make backups regularly, especially before changing phones, uninstalling, or reinstalling.

To save a backup, open **Settings > Backups > Export backup**. Choose a separate backup password, then use **Save to files** or **Share via app**. Keep the backup somewhere safe outside the app, and keep its password safe too.

To restore, choose **Import backup**, select your saved `.vault` file, and enter that file's backup password if requested. Review the contents and tap **Merge into my vault**. Existing records stay in place; importing the same backup twice creates duplicates.

**Encrypted backups are the default.** The optional unencrypted export has no password protection: anyone with that file can read or change every card and note, including card numbers and security codes.

## A few important privacy notes

- Your saved vault stays encrypted on your device. Optional card lookup sends only the first eight digits to HandyAPI, not your complete card number, expiry, name, or security code. The service also sees your network address.
- Camera recognition runs on-device using Google's ML Kit. Its SDK may send usage/performance metrics to Google, but does not upload the input images or recognized text. NFC reading stays local and does not make a payment.
- Switching apps or turning off the screen does **not** lock an open vault. Closing the app ends the session; reopening asks for your password or fingerprint.
- Cardvault attempts to clear copied card numbers, security codes, and notes after 30 seconds, or sooner when you leave the app. It cannot remove copies already saved by another app.
- **Sharing is not an encrypted backup.** Sharing a card sends readable details, including its full number and security code, to the app you choose. Shared notes are readable too. Choose recipients carefully.

Cardvault has not undergone an independent security audit. See [Security and privacy](./SECURITY.md) for protections and limitations.

## Updating Cardvault

Download a newer version from [GitHub Releases](https://github.com/sarthakworks/CardVault/releases) and install it. Updates are not installed automatically, and older releases remain available.

**Back up before updating.** If Android requires you to uninstall first, stop and export a backup: uninstalling or clearing the app's data deletes the local vault. Keep your backup password so you can restore afterward.

## Building or contributing?

Development setup, release automation, API configuration, architecture, and other technical details live in [nerdy.md](./nerdy.md).

Released under the [MIT license](./LICENSE).
