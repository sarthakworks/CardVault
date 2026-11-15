package com.cardvault.security

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns

internal object BackupDocumentAccess {
  fun remember(context: Context, value: String): Map<String, Any?> {
    val uri = Uri.parse(value)
    require(uri.scheme == "content") { "Choose a file using the system file picker" }
    val resolver = context.contentResolver
    resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    val cursor = requireNotNull(resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)) {
      "The document provider did not return file information"
    }
    return cursor.use {
      check(it.moveToFirst()) { "This backup file is no longer available" }
      val name = requireNotNull(it.getString(it.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME))) {
        "The document provider did not return a filename"
      }
      val sizeColumn = it.getColumnIndex(OpenableColumns.SIZE)
      val size = if (sizeColumn < 0 || it.isNull(sizeColumn)) null else it.getLong(sizeColumn).takeIf { bytes -> bytes >= 0 }
      mapOf("uri" to uri.toString(), "name" to name, "location" to location(context, uri), "size" to size)
    }
  }

  private fun location(context: Context, uri: Uri): String {
    if (uri.authority == "com.android.externalstorage.documents" && DocumentsContract.isDocumentUri(context, uri)) {
      val documentId = DocumentsContract.getDocumentId(uri)
      val volume = documentId.substringBefore(':')
      val parent = documentId.substringAfter(':', "").substringBeforeLast('/', "")
      val root = if (volume == "primary") "Internal storage" else "Storage $volume"
      return if (parent.isEmpty()) root else "$root / ${parent.replace("/", " / ")}"
    }
    if (uri.authority == "com.android.providers.downloads.documents") return "Downloads"
    val provider = context.packageManager.resolveContentProvider(requireNotNull(uri.authority), 0)
    return provider?.loadLabel(context.packageManager)?.toString() ?: requireNotNull(uri.authority)
  }
}
