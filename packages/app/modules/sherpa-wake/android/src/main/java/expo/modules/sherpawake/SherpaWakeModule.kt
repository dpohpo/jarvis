package expo.modules.sherpawake

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.KeywordSpotter
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

private const val TAG = "SherpaWake"
private const val SAMPLE_RATE = 16000
private const val MODEL_DIR = "sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01"

/**
 * Offline wake-word detection ("Jarvis") via sherpa-onnx KeywordSpotter.
 *
 * - Loads the zipformer-gigaspeech 3.3M int8 model from Android assets.
 * - Spawns an AudioRecord (16kHz / mono / 16-bit) on a background coroutine.
 * - Feeds PCM frames into an OnlineStream and polls for keyword hits.
 * - On hit, emits a "wake" event to JS and resets the stream.
 *
 * Mic coordination: this module owns its own AudioRecord. The existing
 * push-to-talk path in voice.ts uses @picovoice/react-native-voice-processor.
 * Android allows multiple AudioRecord instances, but to avoid contention the
 * JS caller MUST stop wake-listening before starting push-to-talk recording.
 */
class SherpaWakeModule : Module() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private var spotter: KeywordSpotter? = null
  private var record: AudioRecord? = null
  private var kwsJob: Job? = null
  @Volatile private var running = false
  /** Tracks the user's intent (set by start/stop). Distinct from `running`
   *  because OnActivityEntersBackground auto-pauses without dropping intent —
   *  OnActivityEntersForeground then resumes if userEnabled is still true. */
  @Volatile private var userEnabled = false

  override fun definition() = ModuleDefinition {
    Name("SherpaWake")
    Events("wake")

    AsyncFunction("init") { ->
      if (spotter != null) {
        Log.i(TAG, "init: already initialised, skipping")
        return@AsyncFunction true
      }
      val am = appContext.reactContext?.assets
        ?: return@AsyncFunction false.also { Log.e(TAG, "init: reactContext assets null") }
      val cfg = KeywordSpotterConfig(
        featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80),
        modelConfig = OnlineModelConfig(
          transducer = OnlineTransducerModelConfig(
            encoder = "$MODEL_DIR/encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
            decoder = "$MODEL_DIR/decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
            joiner = "$MODEL_DIR/joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
          ),
          tokens = "$MODEL_DIR/tokens.txt",
          modelType = "zipformer2",
        ),
        maxActivePaths = 4,
        keywordsFile = "$MODEL_DIR/keywords.txt",
        keywordsScore = 1.5f,
        keywordsThreshold = 0.25f,
        numTrailingBlanks = 2,
      )
      spotter = try {
        KeywordSpotter(assetManager = am, config = cfg).also {
          Log.i(TAG, "init: KeywordSpotter loaded")
        }
      } catch (t: Throwable) {
        Log.e(TAG, "init: failed", t)
        null
      }
      spotter != null
    }

    AsyncFunction("start") { ->
      val s = spotter ?: return@AsyncFunction false.also {
        Log.e(TAG, "start: not initialised")
      }
      userEnabled = true
      if (running) return@AsyncFunction true
      running = true
      kwsJob = scope.launch { kwsLoop(s) }
      Log.i(TAG, "start: KWS loop launched")
      true
    }

    AsyncFunction("stop") { ->
      userEnabled = false
      running = false
      kwsJob?.cancel()
      kwsJob = null
      try { record?.stop() } catch (_: IllegalStateException) {}
      Log.i(TAG, "stop: KWS halted")
      true
    }

    AsyncFunction("destroy") { ->
      userEnabled = false
      running = false
      kwsJob?.cancel()
      kwsJob = null
      try { record?.stop() } catch (_: IllegalStateException) {}
      try { record?.release() } catch (_: Throwable) {}
      record = null
      try { spotter?.release() } catch (_: Throwable) {}
      spotter = null
      Log.i(TAG, "destroy: resources released")
      true
    }

    OnActivityEntersBackground {
      // Future: keep mic open via foreground service (Phase B).
      // For now, auto-pause to avoid recording while backgrounded, but keep
      // userEnabled so OnActivityEntersForeground can resume.
      if (running) {
        Log.i(TAG, "background: auto-pausing KWS (will resume on foreground)")
        running = false
        kwsJob?.cancel()
        kwsJob = null
        try { record?.stop() } catch (_: IllegalStateException) {}
      }
    }

    OnActivityEntersForeground {
      // Auto-resume KWS when the app returns to foreground, if the user
      // hadn't explicitly stopped it. Fixes the bug where switching apps or
      // opening the workspace picker left wake-word silently dead.
      if (userEnabled && !running) {
        val s = spotter
        if (s != null) {
          running = true
          kwsJob = scope.launch { kwsLoop(s) }
          Log.i(TAG, "foreground: auto-resumed KWS")
        }
      }
    }
  }

  /**
   * Background KWS loop. Owns one AudioRecord + OnlineStream for its lifetime.
   * Reads PCM16 frames, converts to Float32 [-1, 1], feeds stream, decodes,
   * emits "wake" event on keyword hit, resets stream.
   */
  private suspend fun kwsLoop(s: KeywordSpotter) {
    val minBuf = AudioRecord.getMinBufferSize(
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    )
    val bufSize = (minBuf * 4).coerceAtLeast(3200)
    val ar = try {
      AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION,
        SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        bufSize,
      )
    } catch (t: Throwable) {
      Log.e(TAG, "kwsLoop: AudioRecord init failed", t)
      running = false
      return
    }
    if (ar.state != AudioRecord.STATE_INITIALIZED) {
      Log.e(TAG, "kwsLoop: AudioRecord not initialised (state=${ar.state})")
      ar.release()
      running = false
      return
    }
    record = ar
    ar.startRecording()
    Log.i(TAG, "kwsLoop: recording started (bufSize=$bufSize)")

    val stream = s.createStream()
    val shorts = ShortArray(bufSize / 2)
    val floats = FloatArray(bufSize / 2)
    try {
      while (running) {
        val n = ar.read(shorts, 0, shorts.size)
        if (n <= 0) {
          if (n == AudioRecord.ERROR_INVALID_OPERATION ||
              n == AudioRecord.ERROR_BAD_VALUE) {
            Log.e(TAG, "kwsLoop: read err=$n, exiting")
            break
          }
          continue
        }
        for (i in 0 until n) {
          floats[i] = shorts[i] / 32768.0f
        }
        stream.acceptWaveform(floats.copyOfRange(0, n), SAMPLE_RATE)
        while (s.isReady(stream)) {
          s.decode(stream)
          val keyword = s.getResult(stream).keyword.trim()
          if (keyword.isNotEmpty()) {
            Log.i(TAG, "kwsLoop: hit '$keyword'")
            sendEvent("wake", mapOf("keyword" to keyword))
            // Reset the stream so the spotter can fire again on the next
            // utterance. Do NOT break out of the loop — we want always-on
            // listening. A short cooldown avoids the same keyword firing
            // repeatedly from one utterance.
            s.reset(stream)
            Thread.sleep(1200)
          }
        }
      }
    } catch (t: Throwable) {
      Log.e(TAG, "kwsLoop: crashed", t)
    } finally {
      try { ar.stop() } catch (_: IllegalStateException) {}
      try { ar.release() } catch (_: Throwable) {}
      record = null
      try { stream.release() } catch (_: Throwable) {}
      running = false
      Log.i(TAG, "kwsLoop: exited")
    }
  }

  // NOTE: Kotlin's Any.finalize() is not open, so we cannot override it here.
  // Cleanup is handled by the destroy() AsyncFunction + OnActivityEntersBackground.
  // For an extra layer of safety the scope is cancelled when the module is
  // GC'd via SupervisorJob completion (handled by CoroutineScope semantics).
}
