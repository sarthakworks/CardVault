package com.cardvault.reader

import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

internal class CardReadException(message: String) : Exception(message)

internal data class ReadCard(val number: String, val expiry: String?, val holder: String?) {
  fun asMap(): Map<String, String> = buildMap {
    put("number", number)
    expiry?.let { put("expiry", it) }
    holder?.let { put("holder", it) }
  }
}

internal class EmvCardDecoder(private val transport: (ByteArray) -> ByteArray) {
  private data class Element(val tag: Int, val value: ByteArray, val children: List<Element>)
  private var commands = 0

  fun read(): ReadCard {
    val directory = exchange(select("2PAY.SYS.DDF01".toByteArray(Charsets.US_ASCII)))
    val advertised = directory?.let { findAll(parse(it), 0x4F).map { element -> element.value } }.orEmpty()
      .filter { it.size in 5..16 }
    val aids = (advertised + defaultAids.map(::hexBytes)).distinctBy(::hex).take(12)
    for (aid in aids) {
      val selected = exchange(select(aid)) ?: continue
      val selectedElements = parse(selected)
      details(selectedElements)?.let { return it }
      val pdol = find(selectedElements, 0x9F38)?.value ?: byteArrayOf()
      val terminalData = dataObjects(pdol)
      val objectLength = if (terminalData.size < 128) byteArrayOf(terminalData.size.toByte()) else byteArrayOf(0x81.toByte(), terminalData.size.toByte())
      val payload = byteArrayOf(0x83.toByte()) + objectLength + terminalData
      val processing = exchange(byteArrayOf(0x80.toByte(), 0xA8.toByte(), 0, 0, payload.size.toByte()) + payload + byteArrayOf(0)) ?: continue
      val processingElements = parse(processing)
      details(processingElements)?.let { return it }
      val compact = find(processingElements, 0x80)?.value
      val afl = find(processingElements, 0x94)?.value ?: compact?.takeIf { it.size >= 2 }?.copyOfRange(2, compact.size) ?: continue
      if (afl.size % 4 != 0 || afl.size > 128) throw CardReadException("This card returned unsupported record information.")
      val records = mutableListOf<Element>()
      for (offset in afl.indices step 4) {
        val sfi = (afl[offset].toInt() and 0xFF) ushr 3
        val first = afl[offset + 1].toInt() and 0xFF
        val last = afl[offset + 2].toInt() and 0xFF
        if (sfi !in 1..30 || first !in 1..32 || last !in first..32) throw CardReadException("This card returned invalid record information.")
        for (record in first..last) {
          val response = exchange(byteArrayOf(0, 0xB2.toByte(), record.toByte(), ((sfi shl 3) or 4).toByte(), 0)) ?: continue
          records += parse(response)
        }
      }
      details(records)?.let { return it }
    }
    throw CardReadException("This card did not share a supported card number. Use the camera or enter it manually.")
  }

  private fun details(elements: List<Element>): ReadCard? {
    val pan = find(elements, 0x5A)?.value?.let(::hex)?.trimEnd('F')
    val track = find(elements, 0x57)?.value?.let(::hex)
    val trackPan = track?.substringBefore('D')?.takeIf { track.contains('D') }
    val number = listOfNotNull(pan, trackPan).firstOrNull { it.length in 13..19 && it.all(Char::isDigit) } ?: return null
    val expiryDigits = find(elements, 0x5F24)?.value?.let(::hex)?.take(4)
      ?: track?.substringAfter('D', "")?.take(4)
    val expiry = expiryDigits?.takeIf { it.length == 4 && it.all(Char::isDigit) && it.takeLast(2).toInt() in 1..12 }
      ?.let { "${it.takeLast(2)}/${it.take(2)}" }
    val holder = find(elements, 0x5F20)?.value?.toString(Charsets.ISO_8859_1)
      ?.replace('/', ' ')?.trim()?.takeIf { it.length in 1..80 && it.none(Char::isISOControl) }
    return ReadCard(number, expiry, holder)
  }

  // Only selection, processing-options and record-reading commands are constructed.
  // No authorization, PIN, key-extraction, payment-cryptogram or write command is sent.
  private fun exchange(command: ByteArray): ByteArray? {
    var response = send(command)
    if ((response[response.size - 2].toInt() and 0xFF) == 0x6C) {
      val retry = command.copyOf()
      retry[retry.lastIndex] = response.last()
      response = send(retry)
    }
    var body = byteArrayOf()
    var continuation = 0
    while ((response[response.size - 2].toInt() and 0xFF) == 0x61) {
      if (++continuation > 4) throw CardReadException("This card returned too many response fragments.")
      body += response.copyOfRange(0, response.size - 2)
      if (body.size > 8_192) throw CardReadException("This card returned too much data.")
      response = send(byteArrayOf(0, 0xC0.toByte(), 0, 0, response.last()))
    }
    val status = ((response[response.size - 2].toInt() and 0xFF) shl 8) or (response.last().toInt() and 0xFF)
    if (body.size + response.size - 2 > 8_192) throw CardReadException("This card returned too much data.")
    return if (status == 0x9000) body + response.copyOfRange(0, response.size - 2) else null
  }

  private fun send(command: ByteArray): ByteArray {
    if (++commands > 64) throw CardReadException("This card needs an unsupported read sequence. Enter its details manually.")
    return transport(command).also {
      if (it.size !in 2..8_192) throw CardReadException("This card returned an invalid response.")
    }
  }

  private fun select(name: ByteArray) = byteArrayOf(0, 0xA4.toByte(), 4, 0, name.size.toByte()) + name + byteArrayOf(0)

  private fun dataObjects(pdol: ByteArray): ByteArray {
    var offset = 0
    val output = ArrayList<Byte>()
    while (offset < pdol.size) {
      val (tag, end) = readTag(pdol, offset)
      offset = end
      if (offset >= pdol.size) throw CardReadException("This card returned an invalid data request.")
      val length = pdol[offset++].toInt() and 0xFF
      if (length > 64 || output.size + length > 128) throw CardReadException("This card requested too much terminal data.")
      val value = when (tag) {
        0x9F66 -> byteArrayOf(0x26, 0, 0, 0)
        0x9F37 -> ByteArray(length).also { SecureRandom().nextBytes(it) }
        0x9A -> hexBytes(SimpleDateFormat("yyMMdd", Locale.ROOT).format(Date()))
        else -> byteArrayOf()
      }
      repeat(length) { output.add(value.getOrElse(it) { 0 }) }
    }
    return output.toByteArray()
  }

  private fun parse(bytes: ByteArray, depth: Int = 0): List<Element> {
    if (depth > 8) throw CardReadException("This card returned nested data that is too complex.")
    val output = mutableListOf<Element>()
    var offset = 0
    while (offset < bytes.size) {
      val first = bytes[offset].toInt() and 0xFF
      if (first == 0 || first == 0xFF) { offset++; continue }
      val (tag, end) = readTag(bytes, offset)
      offset = end
      if (offset >= bytes.size) throw CardReadException("This card returned incomplete data.")
      var length = bytes[offset++].toInt() and 0xFF
      if (length and 0x80 != 0) {
        val count = length and 0x7F
        if (count !in 1..2 || offset + count > bytes.size) throw CardReadException("This card returned an invalid data length.")
        length = 0
        repeat(count) { length = (length shl 8) or (bytes[offset++].toInt() and 0xFF) }
      }
      if (length > bytes.size - offset || output.size >= 256) throw CardReadException("This card returned data outside supported limits.")
      val value = bytes.copyOfRange(offset, offset + length)
      output.add(Element(tag, value, if (first and 0x20 != 0) parse(value, depth + 1) else emptyList()))
      offset += length
    }
    return output
  }

  private fun readTag(bytes: ByteArray, start: Int): Pair<Int, Int> {
    if (start >= bytes.size) throw CardReadException("This card returned an incomplete tag.")
    var offset = start + 1
    var tag = bytes[start].toInt() and 0xFF
    if (tag and 0x1F == 0x1F) {
      do {
        if (offset >= bytes.size || offset - start >= 3) throw CardReadException("This card returned an invalid tag.")
        val next = bytes[offset++].toInt() and 0xFF
        tag = (tag shl 8) or next
      } while (next and 0x80 != 0)
    }
    return tag to offset
  }

  private fun find(elements: List<Element>, tag: Int): Element? {
    for (element in elements) {
      if (element.tag == tag) return element
      find(element.children, tag)?.let { return it }
    }
    return null
  }

  private fun findAll(elements: List<Element>, tag: Int): List<Element> = elements.flatMap {
    (if (it.tag == tag) listOf(it) else emptyList()) + findAll(it.children, tag)
  }

  companion object {
    private val defaultAids = listOf(
      "A0000000031010", "A0000000041010", "A0000000043060", "A00000002501",
      "A0000005241010", "A0000001523010", "A0000000651010", "A000000333010101",
    )
    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02X".format(it.toInt() and 0xFF) }
    private fun hexBytes(value: String) = value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
  }
}
