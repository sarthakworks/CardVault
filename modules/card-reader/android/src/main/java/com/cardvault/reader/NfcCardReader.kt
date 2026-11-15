package com.cardvault.reader

import android.app.Activity
import android.content.Context
import android.nfc.NfcAdapter
import android.nfc.NfcManager
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import expo.modules.kotlin.Promise
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

internal class NfcCardReader(private val context: Context) {
  private class Operation(val activity: Activity, val promise: Promise) {
    val reading = AtomicBoolean(false)
    @Volatile var connection: IsoDep? = null
  }
  private val main = Handler(Looper.getMainLooper())
  private val executor = Executors.newFixedThreadPool(2)
  @Volatile private var operation: Operation? = null
  private var timeout: Runnable? = null
  private val adapter: NfcAdapter?
    get() = context.getSystemService(NfcManager::class.java)?.defaultAdapter

  fun status(): String = when {
    adapter == null -> "unsupported"
    adapter?.isEnabled == true -> "ready"
    else -> "disabled"
  }

  fun start(activity: Activity, promise: Promise) {
    if (operation != null) {
      promise.reject("E_NFC_BUSY", "Finish the current NFC read before starting another.", null)
      return
    }
    val nfc = adapter
    if (nfc == null || !nfc.isEnabled || !activity.hasWindowFocus()) {
      promise.reject("E_NFC_UNAVAILABLE", "Enable NFC and return to Cardvault, or use the camera or manual entry.", null)
      return
    }
    val request = Operation(activity, promise)
    operation = request
    try {
      nfc.enableReaderMode(activity, { tag -> read(request, tag) },
        NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
        Bundle().apply { putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250) })
      timeout = Runnable { fail(request, "E_NFC_TIMEOUT", "No readable card was found. Hold one contactless card against the phone and try again.") }.also {
        main.postDelayed(it, 35_000)
      }
    } catch (_: SecurityException) {
      fail(request, "E_NFC_PERMISSION", "NFC access is unavailable in this build. Use camera or manual entry.")
    } catch (_: IllegalStateException) {
      fail(request, "E_NFC_UNAVAILABLE", "NFC is unavailable. Return to Cardvault and try again.")
    }
  }

  private fun read(request: Operation, tag: Tag) {
    if (operation !== request || !request.reading.compareAndSet(false, true)) return
    executor.execute {
      val connection = IsoDep.get(tag)
      if (connection == null) {
        main.post { fail(request, "E_NFC_UNSUPPORTED", "This is not a supported contactless payment card. Use camera or manual entry.") }
        return@execute
      }
      request.connection = connection
      try {
        if (operation !== request) return@execute
        connection.timeout = 3_000
        connection.connect()
        val started = SystemClock.elapsedRealtime()
        val result = EmvCardDecoder { command ->
          if (operation !== request || SystemClock.elapsedRealtime() - started > 15_000) {
            throw CardReadException("Reading stopped or timed out. Keep the card still and try again.")
          }
          connection.transceive(command)
        }.read()
        connection.close()
        request.connection = null
        main.post {
          if (operation === request) {
            val stopError = finish(request)
            if (stopError == null) request.promise.resolve(result.asMap())
            else request.promise.reject("E_NFC_CLOSE", stopError, null)
          }
        }
      } catch (error: CardReadException) {
        main.post { fail(request, "E_NFC_CARD", error.message ?: "This card could not be read. Enter its details manually.") }
      } catch (_: IOException) {
        main.post { fail(request, "E_NFC_REMOVED", "The card moved or stopped responding. Keep it against the phone and try again.") }
      } catch (_: SecurityException) {
        main.post { fail(request, "E_NFC_PERMISSION", "NFC access was interrupted. Return to Cardvault and try again.") }
      } finally {
        if (request.connection === connection) {
          request.connection = null
          try {
            connection.close()
          } catch (_: IOException) {
            main.post { fail(request, "E_NFC_CLOSE", "The NFC connection could not close cleanly. Remove the card and retry.") }
          }
        }
      }
    }
  }

  private fun finish(request: Operation): String? {
    if (operation !== request) return null
    operation = null
    timeout?.let(main::removeCallbacks)
    timeout = null
    var stopError: String? = null
    try {
      adapter?.disableReaderMode(request.activity)
    } catch (_: IllegalStateException) {
      stopError = "NFC could not stop cleanly. Remove the card, turn NFC off and on, then retry."
    } catch (_: SecurityException) {
      stopError = "NFC access changed. Remove the card and reopen Cardvault."
    }
    val connection = request.connection
    request.connection = null
    connection?.let {
      executor.execute {
        try {
          connection.close()
        } catch (_: IOException) {
          // Reader mode is already disabled; a concurrent transceive may have closed it.
        }
      }
    }
    return stopError
  }

  private fun fail(request: Operation, code: String, message: String) {
    if (operation !== request) return
    val stopError = finish(request)
    request.promise.reject(code, if (stopError == null) message else "$message $stopError", null)
  }

  fun cancel() {
    operation?.let { fail(it, "E_NFC_CANCELED", "NFC reading stopped. Tap Try again when ready.") }
  }

  fun close() {
    cancel()
    executor.shutdown()
  }
}
