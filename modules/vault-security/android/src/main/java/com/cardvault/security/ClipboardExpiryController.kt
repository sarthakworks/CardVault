package com.cardvault.security

import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.security.MessageDigest

object ClipboardExpiryController {
  private val handler = Handler(Looper.getMainLooper())
  private var ownedHash: String? = null
  private var expiry: Runnable? = null

  fun arm(context: Context, hash: String) {
    require(hash.matches(Regex("[a-f0-9]{64}"))) { "Invalid clipboard ownership hash" }
    expiry?.let { handler.removeCallbacks(it) }
    ownedHash = hash
    expiry = Runnable { clearOwned(context) }.also { handler.postDelayed(it, 30_000) }
  }

  fun clearOwned(context: Context) {
    val expected = ownedHash ?: return
    try {
      val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val current = manager.primaryClip?.getItemAt(0)?.text?.toString() ?: return
      val digest = MessageDigest.getInstance("SHA-256")
        .digest(current.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
      if (digest == expected) manager.clearPrimaryClip()
      ownedHash = null
      expiry?.let { handler.removeCallbacks(it) }
      expiry = null
    } catch (error: SecurityException) {
      Log.w("CardvaultSecurity", "Android prevented clipboard cleanup")
    }
  }
}
