package com.cardvault.reader

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Size
import android.util.Log
import android.view.Surface
import androidx.camera.core.CameraSelector
import androidx.camera.core.Camera
import androidx.camera.core.CameraState
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.TorchState
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.Observer
import com.google.android.gms.common.moduleinstall.InstallStatusListener
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.ExecutionException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.CancellationException
import java.util.concurrent.TimeUnit

class CardCameraView(context: Context, private val moduleContext: AppContext) : ExpoView(context, moduleContext) {
  override val shouldUseAndroidLayout = true
  private val onText by EventDispatcher()
  private val onStatus by EventDispatcher()
  private val main = Handler(Looper.getMainLooper())
  private val mainExecutor = ContextCompat.getMainExecutor(context)
  private val installer = ModuleInstall.getClient(context)
  private var installListener: InstallStatusListener? = null
  private var modelTimeout: Runnable? = null
  private var executor: ExecutorService? = null
  private var provider: ProcessCameraProvider? = null
  private var preview: Preview? = null
  private var analysis: ImageAnalysis? = null
  private var recognizer: TextRecognizer? = null
  private var lifecycleOwner: LifecycleOwner? = null
  private var boundCamera: Camera? = null
  private var cameraObserver: Observer<CameraState>? = null
  @Volatile private var epoch = 0
  @Volatile private var enabled = false
  var requestId = 0
  private var binding = false
  private var lastAnalysis = 0L
  private var lastDiagnostics = 0L
  private var torchRequested = false
  private var torchPending = false
  private var torchRequest = 0
  private var focusRequest = 0
  @Volatile private var enhanceRequested = false
  @Volatile private var enhancementAvailable = true
  private var enhancedNext = true

  private val previewView = PreviewView(context).also {
    it.implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    it.scaleType = PreviewView.ScaleType.FILL_CENTER
    addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }
  private val lifecycleObserver = object : DefaultLifecycleObserver {
    override fun onStop(owner: LifecycleOwner) {
      if (enabled) {
        stop()
        status("error", "Camera paused. Return to Cardvault and tap Try again.")
      }
    }
  }

  fun setActive(value: Boolean) {
    if (enabled == value) return
    enabled = value
    if (value && isAttachedToWindow) start() else stop()
  }

  fun setEnhancement(value: Boolean) {
    enhanceRequested = value
  }

  fun setTorch(value: Boolean) {
    if (torchRequested == value) return
    torchRequested = value
    updateTorch()
  }

  private fun updateTorch() {
    val camera = boundCamera ?: return
    if (!camera.cameraInfo.hasFlashUnit()) {
      torchRequested = false
      status("hint", "This camera has no light. Move to a brighter area and avoid reflections.")
      return
    }
    val id = epoch
    val request = ++torchRequest
    torchPending = true
    watchControl(camera.cameraControl.enableTorch(torchRequested), { current(id) && torchRequest == request }, {
      torchPending = false
      torchRequested = camera.cameraInfo.torchState.value == TorchState.ON
      status("hint", "The camera light could not be changed. Try again or move to better lighting.")
    }) {
      torchPending = false
      status("ready", "Keep the whole card number sharp. Tilt slightly if the light creates glare.")
    }
  }

  fun focusCamera(x: Double? = 0.5, y: Double? = 0.5) {
    val camera = boundCamera ?: return
    if (previewView.width <= 0 || previewView.height <= 0) return
    if (x == null || y == null || !x.isFinite() || !y.isFinite() || x !in 0.0..1.0 || y !in 0.0..1.0) {
      status("hint", "Tap inside the preview to focus on the printed card number.")
      return
    }
    val point = previewView.meteringPointFactory.createPoint(previewView.width * x.toFloat(), previewView.height * y.toFloat())
    val action = FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE)
      .setAutoCancelDuration(3, TimeUnit.SECONDS).build()
    val supported = camera.cameraInfo.isFocusMeteringSupported(action)
    if (Log.isLoggable("CardvaultScan", Log.DEBUG)) Log.i("CardvaultScan", "focus x=${(x * 100).toInt()} y=${(y * 100).toInt()} supported=$supported")
    if (!supported) {
      status("hint", "This camera cannot refocus here. Move the phone slightly farther from the card.")
      return
    }
    val id = epoch
    val request = ++focusRequest
    watchControl(camera.cameraControl.startFocusAndMetering(action), { current(id) && focusRequest == request }, {
      status("hint", "The camera could not refocus. Hold still, adjust the distance, and tap the preview again.")
    }) { result ->
      if (result.isFocusSuccessful) status("ready", "Focus adjusted. Keep the card still while we read it.")
      else status("hint", "Focus is not sharp yet. Move slightly farther away and tap the preview again.")
    }
  }

  private fun <T> watchControl(future: ListenableFuture<T>, valid: () -> Boolean, failure: () -> Unit, success: (T) -> Unit) {
    future.addListener({
      if (!valid()) return@addListener
      try {
        success(future.get())
      } catch (_: ExecutionException) {
        failure()
      } catch (_: CancellationException) {
        failure()
      } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
        failure()
      }
    }, mainExecutor)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (enabled) start()
  }

  override fun onDetachedFromWindow() {
    stop()
    super.onDetachedFromWindow()
  }

  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
    super.onWindowFocusChanged(hasWindowFocus)
    if (!hasWindowFocus && enabled && preview != null) {
      stop()
      status("error", "Camera paused. Return to Cardvault and tap Try again.")
    }
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    previewView.layout(0, 0, right - left, bottom - top)
  }

  private fun current(id: Int) = enabled && isAttachedToWindow && epoch == id
  private fun status(state: String, message: String) {
    val event = mutableMapOf<String, Any>(
      "requestId" to requestId, "status" to state, "message" to message,
      "torchAvailable" to (boundCamera?.cameraInfo?.hasFlashUnit() ?: false),
      "enhancementAvailable" to enhancementAvailable
    )
    if (!torchPending) event["torchEnabled"] = boundCamera?.cameraInfo?.torchState?.value == TorchState.ON
    onStatus(event)
  }

  private fun start() {
    stop()
    val id = epoch
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      fail(id, "Camera permission is needed to scan a card.")
      return
    }
    val owner = moduleContext.currentActivity as? LifecycleOwner
    if (owner == null) {
      fail(id, "The camera cannot start in this window. Reopen the card editor.")
      return
    }
    lifecycleOwner = owner
    owner.lifecycle.addObserver(lifecycleObserver)
    status("preparing", "Preparing on-device scanner. First use may need an internet connection.")
    val reader = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    recognizer = reader
    modelTimeout = Runnable { fail(id, "Scanner setup timed out. Connect to the internet, update Google Play services, and try again.") }.also {
      main.postDelayed(it, 60_000)
    }
    installer.areModulesAvailable(reader).addOnSuccessListener { response ->
      if (!current(id)) return@addOnSuccessListener
      if (response.areModulesAvailable()) modelReady(id) else downloadModel(id, reader)
    }.addOnFailureListener {
      fail(id, "Google Play services could not prepare the scanner. Update Play services or enter the card manually.")
    }
  }

  private fun downloadModel(id: Int, reader: TextRecognizer) {
    status("preparing", "Downloading the on-device scanner. Card images are not uploaded.")
    val listener = InstallStatusListener { update ->
      if (current(id)) {
        when (update.installState) {
          ModuleInstallStatusUpdate.InstallState.STATE_COMPLETED -> modelReady(id)
          ModuleInstallStatusUpdate.InstallState.STATE_FAILED,
          ModuleInstallStatusUpdate.InstallState.STATE_CANCELED -> fail(id, "Scanner download failed. Check your connection and Google Play services, then try again.")
        }
      }
    }
    installListener = listener
    installer.installModules(ModuleInstallRequest.newBuilder().addApi(reader).setListener(listener).build())
      .addOnSuccessListener { response ->
        if (current(id) && response.areModulesAlreadyInstalled()) modelReady(id)
      }.addOnFailureListener {
        fail(id, "The scanner could not be downloaded. Check your connection and Google Play services, then try again.")
      }
  }

  private fun modelReady(id: Int) {
    if (!current(id) || binding) return
    binding = true
    modelTimeout?.let(main::removeCallbacks)
    modelTimeout = null
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if (!current(id)) return@addListener
      try {
        val cameraProvider = future.get()
        val owner = lifecycleOwner ?: return@addListener
        val reader = recognizer ?: return@addListener
        val imageAnalysis = ImageAnalysis.Builder()
          .setResolutionSelector(ResolutionSelector.Builder().setResolutionStrategy(
            ResolutionStrategy(Size(1920, 1080), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER)
          ).build())
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .setTargetRotation(display?.rotation ?: Surface.ROTATION_0)
          .build()
        val cameraPreview = Preview.Builder().build()
        cameraPreview.setSurfaceProvider(previewView.surfaceProvider)
        val worker = Executors.newSingleThreadExecutor()
        executor = worker
        provider = cameraProvider
        preview = cameraPreview
        analysis = imageAnalysis
        imageAnalysis.setAnalyzer(worker) { image -> analyze(id, image, reader) }
        val camera = cameraProvider.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, cameraPreview, imageAnalysis)
        boundCamera = camera
        var reportedReady = false
        val observer = Observer<CameraState> { state ->
          if (current(id)) {
            if (state.error != null) fail(id, "The camera is unavailable. Close other camera apps and try again.")
            else if (state.type == CameraState.Type.OPEN && !reportedReady) {
              reportedReady = true
              if (torchRequested) updateTorch()
              status("ready", "Keep the number and expiry in view. Avoid glare and hold still.")
              previewView.post { if (current(id)) focusCamera() }
            }
          }
        }
        cameraObserver = observer
        camera.cameraInfo.cameraState.observe(owner, observer)
      } catch (_: ExecutionException) {
        fail(id, "The camera could not initialize. Close other camera apps and try again.")
      } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
        fail(id, "Camera startup was interrupted. Try again.")
      } catch (_: IllegalArgumentException) {
        fail(id, "This device cannot provide a compatible back-camera stream. Enter the card manually.")
      } catch (_: IllegalStateException) {
        fail(id, "The camera is unavailable. Close other camera apps and try again.")
      } catch (_: SecurityException) {
        fail(id, "Camera access was denied. Allow it in Android settings or enter the card manually.")
      }
    }, mainExecutor)
  }

  @androidx.annotation.OptIn(ExperimentalGetImage::class)
  private fun analyze(id: Int, image: androidx.camera.core.ImageProxy, reader: TextRecognizer) {
    val now = SystemClock.elapsedRealtime()
    if (!current(id) || now - lastAnalysis < 550) {
      image.close()
      return
    }
    lastAnalysis = now
    val mediaImage = image.image
    if (mediaImage == null) {
      image.close()
      return
    }
    var enhanced: EnhancedCameraFrame? = null
    var enhancementMs = 0L
    try {
      if (enhanceRequested && enhancementAvailable) {
        val useEnhanced = enhancedNext
        enhancedNext = !enhancedNext
        if (useEnhanced) {
          try {
            require(image.format == ImageFormat.YUV_420_888 && image.planes.isNotEmpty())
            val plane = image.planes[0]
            val started = SystemClock.elapsedRealtime()
            enhanced = CameraFrameEnhancer.enhance(plane.buffer, image.width, image.height, plane.rowStride, plane.pixelStride)
            enhancementMs = SystemClock.elapsedRealtime() - started
          } catch (_: IllegalArgumentException) {
            enhancementAvailable = false
            main.post { if (current(id)) status("hint", "Contrast enhancement is unavailable on this camera. Try the light, adjust the angle, or enter details manually.") }
          }
        }
      }
      val frame = enhanced
      val enhancementTime = enhancementMs
      val input = if (frame == null) InputImage.fromMediaImage(mediaImage, image.imageInfo.rotationDegrees)
        else InputImage.fromByteArray(frame.data, frame.width, frame.height, image.imageInfo.rotationDegrees, InputImage.IMAGE_FORMAT_NV21)
      reader.process(input)
        .addOnSuccessListener(mainExecutor) { text ->
          if (current(id)) {
            reportDiagnostics(text, frame?.width ?: image.width, frame?.height ?: image.height, image.imageInfo.rotationDegrees, frame != null, enhancementTime, frame?.removedRules ?: 0)
            val recognized = text.textBlocks.asSequence().flatMap { it.lines.asSequence() }.take(80).toList()
            val regions = recognized.asSequence().withIndex().flatMap { (lineIndex, line) ->
              line.elements.asSequence().mapNotNull { element ->
                element.boundingBox?.let { box ->
                  mapOf("text" to element.text.take(160), "line" to lineIndex, "left" to box.left, "top" to box.top, "right" to box.right, "bottom" to box.bottom)
                }
              }
            }.take(160).toList()
            onText(mapOf("requestId" to requestId, "lines" to recognized.map { it.text.take(160) }, "regions" to regions, "enhanced" to (frame != null)))
          }
        }.addOnFailureListener(mainExecutor) {
          if (frame != null && current(id)) {
            enhancementAvailable = false
            status("hint", "The contrast pass could not be processed. Normal scanning is still running; try the light or a different angle.")
          } else {
            fail(id, "The camera could not read this frame. Try again in better lighting or enter the card manually.")
          }
        }.addOnCompleteListener { frame?.data?.fill(0); image.close() }
    } catch (_: IllegalStateException) {
      enhanced?.data?.fill(0)
      image.close()
      main.post { fail(id, "Camera scanning was interrupted. Try again.") }
    } catch (_: IllegalArgumentException) {
      enhanced?.data?.fill(0)
      image.close()
      main.post { fail(id, "This camera frame could not be processed. Try again.") }
    }
  }

  private fun reportDiagnostics(text: Text, width: Int, height: Int, rotation: Int, enhanced: Boolean, enhancementMs: Long, removedRules: Int) {
    if (!Log.isLoggable("CardvaultScan", Log.DEBUG)) return
    val now = SystemClock.elapsedRealtime()
    if (now - lastDiagnostics < 2_000) return
    lastDiagnostics = now
    val lines = text.textBlocks.flatMap { it.lines }.take(24)
    Log.i("CardvaultScan", "frame=${width}x$height rotation=$rotation contrast=$enhanced lines=${lines.size} enhancementMs=$enhancementMs rules=$removedRules")
    // Opt-in diagnostics contain redacted metrics only, never OCR text or card values.
    lines.forEachIndexed { index, line ->
      val content = line.text.take(160)
      val groups = Regex("[0-9]+").findAll(content).map { it.value.length }.take(12).joinToString(".")
      val digits = content.filter { it in '0'..'9' }
      val checksum = if (digits.length in 13..19) digits.reversed().mapIndexed { position, digit ->
        val value = digit.digitToInt() * if (position % 2 == 1) 2 else 1
        if (value > 9) value - 9 else value
      }.sum() % 10 == 0 else null
      val shape = content.map { character ->
        when {
          character.isDigit() -> 'D'
          character in "OQIlL|BS" -> 'C'
          character.isLetter() -> 'A'
          character in " /.-:" -> character
          else -> '?'
        }
      }.joinToString("")
      val box = line.boundingBox
      val bounds = if (box == null) "unavailable" else "${box.left},${box.top},${box.right},${box.bottom}"
      Log.i("CardvaultScan", "line=$index chars=${content.length} digits=${digits.length} groups=$groups checksum=$checksum confidence=${(line.confidence * 100).toInt()} shape=$shape box=$bounds")
    }
  }

  private fun fail(id: Int, message: String) {
    if (!current(id)) return
    stop()
    status("error", message)
  }

  private fun stop() {
    epoch++
    torchPending = false
    modelTimeout?.let(main::removeCallbacks)
    modelTimeout = null
    installListener?.let { listener ->
      installListener = null
      installer.unregisterListener(listener)
    }
    analysis?.clearAnalyzer()
    cameraObserver?.let { boundCamera?.cameraInfo?.cameraState?.removeObserver(it) }
    cameraObserver = null
    boundCamera = null
    val useCases = listOfNotNull(preview, analysis)
    if (useCases.isNotEmpty()) provider?.unbind(*useCases.toTypedArray())
    preview = null
    analysis = null
    provider = null
    binding = false
    recognizer?.close()
    recognizer = null
    executor?.shutdown()
    executor = null
    lifecycleOwner?.lifecycle?.removeObserver(lifecycleObserver)
    lifecycleOwner = null
    lastAnalysis = 0
    lastDiagnostics = 0
    enhancementAvailable = true
    enhancedNext = true
  }
}
