package com.cardvault.security

import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

object PasswordKeyDeriver {
  fun derive(password: String, salt: String, iterations: Int): String {
    require(password.isNotEmpty() && password.length <= 256) { "Password length is invalid" }
    require(salt.matches(Regex("[0-9a-f]{64}"))) { "A 32-byte salt is required" }
    require(iterations in 600_000..2_000_000) { "KDF work factor is unsupported" }
    val saltBytes = salt.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    val characters = password.toCharArray()
    val specification = PBEKeySpec(characters, saltBytes, iterations, 256)
    characters.fill('\u0000')
    var derived: ByteArray? = null
    try {
      derived = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        .generateSecret(specification).encoded
      return derived.joinToString("") { "%02x".format(it) }
    } finally {
      specification.clearPassword()
      derived?.fill(0)
      saltBytes.fill(0)
    }
  }
}
