package com.cardvault.reader

import java.nio.ByteBuffer
import kotlin.math.floor

internal data class EnhancedCameraFrame(val data: ByteArray, val width: Int, val height: Int, val removedRules: Int)

internal object CameraFrameEnhancer {
  fun enhance(source: ByteBuffer, width: Int, height: Int, rowStride: Int, pixelStride: Int): EnhancedCameraFrame {
    require(width in 2..16_384 && height in 2..16_384 && rowStride > 0 && pixelStride > 0)
    val input = source.duplicate()
    val base = input.position()
    val last = base.toLong() + (height - 1).toLong() * rowStride + (width - 1).toLong() * pixelStride
    require(last < input.limit()) { "Incomplete camera luminance plane" }
    val largest = maxOf(width, height)
    val outputWidth = ((if (largest > 1600) width * 1600 / largest else width) and -2).coerceAtLeast(2)
    val outputHeight = ((if (largest > 1600) height * 1600 / largest else height) and -2).coerceAtLeast(2)
    val pixels = outputWidth * outputHeight
    val data = ByteArray(pixels + pixels / 2)
    val columns = IntArray(outputWidth) { it * width / outputWidth * pixelStride }
    for (y in 0 until outputHeight) {
      val row = base + y * height / outputHeight * rowStride
      for (x in 0 until outputWidth) data[y * outputWidth + x] = input.get(row + columns[x])
    }
    localContrast(data, outputWidth, outputHeight)
    val removedRules = removeRulingLines(data, outputWidth, outputHeight)
    data.fill(128.toByte(), pixels)
    return EnhancedCameraFrame(data, outputWidth, outputHeight, removedRules)
  }

  private fun removeRulingLines(data: ByteArray, width: Int, height: Int): Int {
    if (minOf(width, height) < 64) return 0
    val scale = (maxOf(width, height) + 799) / 800
    val columns = (width + scale - 1) / scale
    val rows = (height + scale - 1) / scale
    val gray = ByteArray(columns * rows)
    val integral = IntArray((columns + 1) * (rows + 1))
    val mask = ByteArray(gray.size)
    val queue = IntArray(gray.size)
    var removedComponents = 0
    try {
      for (y in 0 until rows) for (x in 0 until columns) {
        var total = 0
        var count = 0
        for (dy in 0 until scale) for (dx in 0 until scale) {
          val px = x * scale + dx
          val py = y * scale + dy
          if (px < width && py < height) { total += data[py * width + px].toInt() and 255; count++ }
        }
        gray[y * columns + x] = (total / count).toByte()
      }
      val stride = columns + 1
      for (y in 0 until rows) {
        var total = 0
        for (x in 0 until columns) {
          total += gray[y * columns + x].toInt() and 255
          integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + total
        }
      }
      fun mean(x: Int, y: Int): Int {
        val left = maxOf(0, x - 12)
        val top = maxOf(0, y - 12)
        val right = minOf(columns, x + 13)
        val bottom = minOf(rows, y + 13)
        val sum = integral[bottom * stride + right] - integral[top * stride + right] -
          integral[bottom * stride + left] + integral[top * stride + left]
        return sum / ((right - left) * (bottom - top))
      }
      val minimumSpan = maxOf(24, minOf(columns, rows) / 6)
      val minimumThickness = maxOf(12, minOf(columns, rows) / 12)
      val neighbors = IntArray(9)
      var removedPixels = 0
      for (bright in listOf(true, false)) {
        for (y in 0 until rows) for (x in 0 until columns) {
          val difference = (gray[y * columns + x].toInt() and 255) - mean(x, y)
          mask[y * columns + x] = if (if (bright) difference > 8 else difference < -8) 1 else 0
        }
        for (start in mask.indices) {
          if (mask[start] == 0.toByte()) continue
          var head = 0
          var tail = 1
          queue[0] = start
          mask[start] = 0
          var left = start % columns
          var right = left
          var top = start / columns
          var bottom = top
          while (head < tail) {
            val pixel = queue[head++]
            val x = pixel % columns
            val y = pixel / columns
            left = minOf(left, x); right = maxOf(right, x)
            top = minOf(top, y); bottom = maxOf(bottom, y)
            for (ny in maxOf(0, y - 1)..minOf(rows - 1, y + 1)) for (nx in maxOf(0, x - 1)..minOf(columns - 1, x + 1)) {
              val next = ny * columns + nx
              if (mask[next] != 0.toByte()) { mask[next] = 0; queue[tail++] = next }
            }
          }
          val boxWidth = right - left + 1
          val boxHeight = bottom - top + 1
          // Remove only large, sparse connected rules, not isolated character strokes.
          if (maxOf(boxWidth, boxHeight) < minimumSpan || minOf(boxWidth, boxHeight) < minimumThickness ||
            tail.toLong() * 12 >= boxWidth.toLong() * boxHeight ||
            removedComponents >= 4 || removedPixels + tail > gray.size / 16) continue
          removedComponents++
          removedPixels += tail
          for (index in 0 until tail) {
            val x = queue[index] % columns
            val y = queue[index] / columns
            var sample = 0
            for (dy in -1..1) for (dx in -1..1) neighbors[sample++] =
              gray[(y + dy * 8).coerceIn(0, rows - 1) * columns + (x + dx * 8).coerceIn(0, columns - 1)].toInt() and 255
            neighbors.sort()
            val background = if (bright) minOf(mean(x, y), neighbors[4]) else maxOf(mean(x, y), neighbors[4])
            for (dy in 0 until scale) for (dx in 0 until scale) {
              val px = x * scale + dx
              val py = y * scale + dy
              if (px < width && py < height) {
                val value = data[py * width + px].toInt() and 255
                if (if (bright) value > background + 2 else value < background - 2) data[py * width + px] = background.toByte()
              }
            }
          }
        }
      }
    } finally {
      gray.fill(0); integral.fill(0); mask.fill(0); queue.fill(0)
    }
    return removedComponents
  }

  // Contrast-limited adaptive histogram equalization with interpolated tile maps.
  private fun localContrast(data: ByteArray, width: Int, height: Int) {
    val tileWidth = (width + 7) / 8
    val tileHeight = (height + 7) / 8
    val columns = (width + tileWidth - 1) / tileWidth
    val rows = (height + tileHeight - 1) / tileHeight
    val maps = Array(columns * rows) { IntArray(256) }
    for (row in 0 until rows) for (column in 0 until columns) {
      val left = column * tileWidth
      val top = row * tileHeight
      val count = tileWidth * tileHeight
      val histogram = IntArray(256)
      for (offsetY in 0 until tileHeight) for (offsetX in 0 until tileWidth) {
        val y = minOf(top + offsetY, height - 1)
        val x = minOf(left + offsetX, width - 1)
        histogram[data[y * width + x].toInt() and 255]++
      }
      val limit = maxOf(1, count * 4 / 256)
      var excess = 0
      for (value in histogram.indices) {
        if (histogram[value] > limit) { excess += histogram[value] - limit; histogram[value] = limit }
      }
      val uniform = excess / 256
      val residual = excess % 256
      var cumulative = 0
      for (value in histogram.indices) {
        cumulative += histogram[value] + uniform + (value + 1) * residual / 256 - value * residual / 256
        maps[row * columns + column][value] = (cumulative * 255 / count).coerceIn(0, 255)
      }
    }
    val xLow = IntArray(width)
    val xHigh = IntArray(width)
    val xWeight = IntArray(width)
    for (x in 0 until width) {
      val position = x.toFloat() / tileWidth - 0.5f
      val low = floor(position).toInt()
      xLow[x] = low.coerceIn(0, columns - 1)
      xHigh[x] = (low + 1).coerceIn(0, columns - 1)
      xWeight[x] = ((position - low) * 256).toInt()
    }
    for (y in 0 until height) {
      val position = y.toFloat() / tileHeight - 0.5f
      val low = floor(position).toInt()
      val top = low.coerceIn(0, rows - 1) * columns
      val bottom = (low + 1).coerceIn(0, rows - 1) * columns
      val weight = ((position - low) * 256).toInt()
      for (x in 0 until width) {
        val value = data[y * width + x].toInt() and 255
        val horizontal = xWeight[x]
        val first = (maps[top + xLow[x]][value] * (256 - horizontal) + maps[top + xHigh[x]][value] * horizontal) shr 8
        val second = (maps[bottom + xLow[x]][value] * (256 - horizontal) + maps[bottom + xHigh[x]][value] * horizontal) shr 8
        data[y * width + x] = ((first * (256 - weight) + second * weight) shr 8).toByte()
      }
    }
  }
}
