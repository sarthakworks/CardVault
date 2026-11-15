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
    val authenticationRequired = info.isUserAuthenticationRequired
    val authenticationType = if (Build.VERSION.SDK_INT >= 30) info.userAuthenticationType else null
    return mapOf(
      "hardwareBacked" to hardwareBacked,
      "authenticationRequired" to (authenticationRequired && info.isUserAuthenticationRequirementEnforcedBySecureHardware),
      "perUseAuthentication" to isPerUseBiometricAuthentication(
        authenticationRequired, info.userAuthenticationValidityDurationSeconds, authenticationType
      )
    )
  }

  internal fun isPerUseBiometricAuthentication(required: Boolean, validitySeconds: Int, authenticationType: Int?): Boolean {
    if (!required) return false
    if (authenticationType == null) return validitySeconds == -1
    if (authenticationType != KeyProperties.AUTH_BIOMETRIC_STRONG) return false
    // Keystore2 reports an absent per-operation AUTH_TIMEOUT as 0; legacy KeyInfo uses -1.
    return validitySeconds == -1 || validitySeconds == 0
  }
}
