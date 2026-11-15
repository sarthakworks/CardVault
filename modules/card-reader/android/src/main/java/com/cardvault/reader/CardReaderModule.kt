package com.cardvault.reader

import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CardReaderModule : Module() {
  private var nfc: NfcCardReader? = null

  private fun reader(): NfcCardReader {
    return nfc ?: NfcCardReader(requireNotNull(appContext.reactContext) { "Application context unavailable" }).also { nfc = it }
  }

  override fun definition() = ModuleDefinition {
    Name("CardReader")

    View(CardCameraView::class) {
      Events("onText", "onStatus")
      Prop("requestId") { view: CardCameraView, requestId: Int -> view.requestId = requestId }
      Prop("active") { view: CardCameraView, active: Boolean -> view.setActive(active) }
      Prop("torch") { view: CardCameraView, torch: Boolean -> view.setTorch(torch) }
      Prop("focusPoint") { view: CardCameraView, point: Map<String, Double> -> view.focusCamera(point["x"], point["y"]) }
      Prop("enhance") { view: CardCameraView, enhance: Boolean -> view.setEnhancement(enhance) }
    }

    AsyncFunction("getNfcStatus") { reader().status() }.runOnQueue(Queues.MAIN)

    AsyncFunction("readNfcCard") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) promise.reject("E_NFC_WINDOW", "Return to Cardvault before reading a card.", null)
      else reader().start(activity, promise)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cancelNfcRead") { nfc?.cancel() }.runOnQueue(Queues.MAIN)

    AsyncFunction("openNfcSettings") {
      requireNotNull(appContext.currentActivity) { "Return to Cardvault before opening NFC settings" }
        .startActivity(Intent(Settings.ACTION_NFC_SETTINGS))
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersBackground { nfc?.cancel() }
    OnActivityDestroys { nfc?.cancel() }
    OnDestroy {
      nfc?.close()
      nfc = null
    }
  }
}
