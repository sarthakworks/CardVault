package com.cardvault.security

import android.os.Build
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.SecretKeyFactory

object KeystoreSecurityInspector {
  @Suppress("DEPRECATION")
  fun inspect(service: String): Map<String, Boolean> {
    require(service.matches(Regex("[a-zA-Z0-9_.-]{1,80}"))) { "Invalid keychain service" }
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = "AES/GCM/NoPadding:$service:keystoreAuthenticated"
    val entry = keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry
      ?: return mapOf("hardwareBacked" to false, "authenticationRequired" to false, "perUseAuthentication" to false)
    val factory = SecretKeyFactory.getInstance(entry.secretKey.algorithm, "AndroidKeyStore")
    val info = factory.getKeySpec(entry.secretKey, KeyInfo::class.java) as KeyInfo
    val hardwareBacked = if (Build.VERSION.SDK_INT >= 31) {
      info.securityLevel == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT ||
        info.securityLevel == KeyProperties.SECURITY_LEVEL_STRONGBOX
    } else {
      info.isInsideSecureHardware
    }
    return mapOf(
      "hardwareBacked" to hardwareBacked,
      "authenticationRequired" to (info.isUserAuthenticationRequired && info.isUserAuthenticationRequirementEnforcedBySecureHardware),
      "perUseAuthentication" to (info.userAuthenticationValidityDurationSeconds == -1)
    )
  }
}
