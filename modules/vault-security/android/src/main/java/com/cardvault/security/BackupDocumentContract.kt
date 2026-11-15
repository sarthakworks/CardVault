package com.cardvault.security

import android.app.Activity
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.activityresult.AppContextActivityResultContract

internal class BackupDocumentContract : AppContextActivityResultContract<String, String?> {
  override fun createIntent(context: Context, input: String): Intent {
    require(input.startsWith("vault-export-") && input.endsWith(".vault") && !input.contains('/') && !input.contains('\\')) {
      "Invalid backup filename"
    }
    return Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "application/octet-stream"
      putExtra(Intent.EXTRA_TITLE, input)
    }
  }

  override fun parseResult(input: String, resultCode: Int, intent: Intent?): String? {
    if (resultCode == Activity.RESULT_CANCELED) return null
    check(resultCode == Activity.RESULT_OK) { "The save destination could not be selected" }
    val uri = requireNotNull(intent?.data) { "The save destination is missing" }
    require(uri.scheme == "content") { "The save destination must be a document" }
    return uri.toString()
  }
}
