package com.cardvault.security

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues

class VaultSecurityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VaultSecurity")

    Events("onAppClosed")

    lateinit var backupDocumentLauncher: AppContextActivityResultLauncher<String, String?>

    RegisterActivityContracts {
      backupDocumentLauncher = registerForActivityResult(BackupDocumentContract())
    }

    AsyncFunction("createBackupDocument") Coroutine { name: String ->
      backupDocumentLauncher.launch(name)
    }

    AsyncFunction("rememberBackupDocument") { uri: String ->
      val context = requireNotNull(appContext.reactContext) { "Application context unavailable" }
      BackupDocumentAccess.remember(context, uri)
    }

    OnActivityDestroys {
      if (appContext.currentActivity?.isChangingConfigurations == false) {
        sendEvent("onAppClosed")
      }
    }

    Function("getActivitySessionId") {
      PrivacyController.sessionId
    }

    Function("isWindowFocused") {
      appContext.currentActivity?.hasWindowFocus() ?: false
    }

    AsyncFunction("releasePrivacyShield") {
      appContext.currentActivity?.let { PrivacyController.reveal(it) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("armClipboardExpiry") { hash: String ->
      val context = requireNotNull(appContext.reactContext) { "Application context unavailable" }
      ClipboardExpiryController.arm(context.applicationContext, hash)
      if (appContext.currentActivity?.hasWindowFocus() != true) {
        ClipboardExpiryController.clearOwned(context.applicationContext)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("clearOwnedClipboard") {
      val context = requireNotNull(appContext.reactContext) { "Application context unavailable" }
      ClipboardExpiryController.clearOwned(context.applicationContext)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("inspectWrappingKey") { service: String ->
      KeystoreSecurityInspector.inspect(service)
    }

    AsyncFunction("deriveRootKey") { password: String, salt: String, iterations: Int ->
      PasswordKeyDeriver.derive(password, salt, iterations)
    }
  }
}
