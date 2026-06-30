package expo.modules.sherpavad

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
import com.k2fsa.sherpa.onnx.SileroVadModelConfig
import com.k2fsa.sherpa.onnx.Vad
import com.k2fsa.sherpa.onnx.VadModelConfig
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val TAG = "SherpaVad"
private const val SAMPLE_RATE = 16000
private const val WINDOW_SIZE = 512            // Silero VAD @ 16kHz requires 512 samples per call
private const val FRAME_MS = 32L               // 512 / 16000 * 1000
private const val CHUNK_FRAMES = 10            // 10 × 32ms = 320ms per chunk event (matches wire format)

class VadOptions : Record {
  @Field val threshold: Double = 0.5
  @Field val minSilenceDuration: Double = 1.0
  @Field val minSpeechDuration: Double = 0.1
  @Field val maxSpeechDuration: Double = 3600.0
}

class SherpaVadModule : Module() {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private var vad: Vad? = null
  private var record: AudioRecord? = null
  private var vadJob: Job? = null

  @Volatile private var running = false
  @Volatile private var userEnabled = false

  override fun definition() = ModuleDefinition {
    Name("SherpaVad")
    Events("chunk", "speechend", "error")

    AsyncFunction("init") { opts: VadOptions? ->
      if (vad != null) return@AsyncFunction true
      val am = appContext.reactContext?.assets
        ?: return@AsyncFunction false.also {
          Log.e(TAG, "init: reactContext assets null")
          sendError("reactContext assets null")
        }

      val o = opts ?: VadOptions()
      val cfg = VadModelConfig().apply {
        sileroVadModelConfig = SileroVadModelConfig().apply {
          model = "silero_vad.onnx"
          threshold = o.threshold.toFloat()
          minSilenceDuration = o.minSilenceDuration.toFloat()
          minSpeechDuration = o.minSpeechDuration.toFloat()
          maxSpeechDuration = o.maxSpeechDuration.toFloat()
          windowSize = WINDOW_SIZE
        }
        sampleRate = SAMPLE_RATE
        numThreads = 1
        provider = "cpu"
        debug = false
        tenVadModelConfig = com.k2fsa.sherpa.onnx.TenVadModelConfig()
      }

      vad = try {
        Vad(am, cfg).also { Log.i(TAG, "init: Silero VAD loaded (thr=${o.threshold}, silence=${o.minSilenceDuration}s)") }
      } catch (t: Throwable) {
        Log.e(TAG, "init: failed", t)
        sendError("init failed: ${t.message}")
        null
      }
      vad != null
    }

    AsyncFunction("start") { ->
      val v = vad ?: return@AsyncFunction false.also {
        Log.e(TAG, "start: not initialised")
        sendError("start called before successful init()")
      }
      userEnabled = true
      if (running) return@AsyncFunction true
      running = true
      vadJob = scope.launch { vadLoop(v) }
      Log.i(TAG, "start: VAD loop launched")
      true
    }

    AsyncFunction("stop") { ->
      userEnabled = false
      running = false
      vadJob?.cancel()
      vadJob = null
      try { record?.stop() } catch (_: IllegalStateException) {}
      Log.i(TAG, "stop: VAD halted")
      true
    }

    AsyncFunction("destroy") { ->
      userEnabled = false
      running = false
      vadJob?.cancel()
      vadJob = null
      try { record?.stop() } catch (_: IllegalStateException) {}
      try { record?.release() } catch (_: Throwable) {}
      record = null
      try { vad?.release() } catch (_: Throwable) {}
      vad = null
      Log.i(TAG, "destroy: resources released")
      true
    }

    OnActivityEntersBackground {
      if (running) {
        running = false
        vadJob?.cancel()
        vadJob = null
        try { record?.stop() } catch (_: IllegalStateException) {}
      }
    }

    OnActivityEntersForeground {
      if (userEnabled && !running && vad != null) {
        running = true
        vadJob = scope.launch { vadLoop(vad!!) }
      }
    }
  }

  private suspend fun vadLoop(v: Vad) {
    val minBuf = AudioRecord.getMinBufferSize(
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    )
    if (minBuf <= 0) {
      Log.e(TAG, "vadLoop: getMinBufferSize failed=$minBuf")
      sendError("AudioRecord.getMinBufferSize failed: $minBuf")
      running = false
      return
    }
    val bufSize = (minBuf * 4).coerceAtLeast(WINDOW_SIZE * 2 * 4)
    val ar = try {
      AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION,
        SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        bufSize,
      )
    } catch (t: Throwable) {
      Log.e(TAG, "vadLoop: AudioRecord init failed", t)
      sendError("AudioRecord init failed: ${t.message}")
      running = false
      return
    }
    if (ar.state != AudioRecord.STATE_INITIALIZED) {
      Log.e(TAG, "vadLoop: AudioRecord not initialised (state=${ar.state})")
      sendError("AudioRecord state != INITIALIZED")
      ar.release()
      running = false
      return
    }

    record = ar
    try {
      ar.startRecording()
    } catch (t: Throwable) {
      Log.e(TAG, "vadLoop: startRecording failed", t)
      sendError("startRecording failed: ${t.message}")
      ar.release()
      record = null
      running = false
      return
    }
    Log.i(TAG, "vadLoop: recording started (bufSize=$bufSize)")

    // Reusable buffers (read capacity rounded down to WINDOW_SIZE for clean framing).
    val readCap = (bufSize / (WINDOW_SIZE * 2)) * WINDOW_SIZE   // in samples
    val shorts = ShortArray(readCap.coerceAtLeast(WINDOW_SIZE))
    val floats = FloatArray(shorts.size)
    val win = FloatArray(WINDOW_SIZE)         // Silero input frame
    var winIdx = 0

    // Chunk batching: collect PCM16 bytes until CHUNK_FRAMES windows accumulated (~320ms).
    val chunkBytes = java.io.ByteArrayOutputStream(WINDOW_SIZE * 2 * CHUNK_FRAMES)
    var chunkWindows = 0

    try {
      while (running) {
        val n = ar.read(shorts, 0, shorts.size)
        if (n <= 0) {
          if (n == AudioRecord.ERROR_INVALID_OPERATION ||
              n == AudioRecord.ERROR_BAD_VALUE
          ) {
            Log.e(TAG, "vadLoop: read err=$n, exiting")
            sendError("AudioRecord read error: $n")
            break
          }
          continue
        }

        // Normalise PCM16 → float32 [-1, 1]
        for (i in 0 until n) floats[i] = shorts[i] / 32768.0f

        // Feed Silero in fixed 512-sample windows; accumulate residual across reads.
        var i = 0
        while (i < n) {
          val need = WINDOW_SIZE - winIdx
          val take = minOf(need, n - i)
          System.arraycopy(floats, i, win, winIdx, take)
          winIdx += take
          i += take
          if (winIdx == WINDOW_SIZE) {
            v.acceptWaveform(win)
            winIdx = 0

            // Append this complete window's PCM16 bytes to the chunk buffer.
            // (Reading from `win` is safe even when the window straddles two
            // AudioRecord reads — win always contains the last 512 samples.)
            for (k in 0 until WINDOW_SIZE) {
              val s = (win[k] * 32768.0f).toInt()
              chunkBytes.write(s and 0xFF)
              chunkBytes.write((s shr 8) and 0xFF)
            }
            chunkWindows++

            if (chunkWindows >= CHUNK_FRAMES) {
              val b64 = Base64.encodeToString(chunkBytes.toByteArray(), Base64.NO_WRAP)
              sendEvent("chunk", mapOf("b64" to b64))
              chunkBytes.reset()
              chunkWindows = 0
            }

            // Drain any completed speech segments (Silero emits them after
            // minSilenceDuration of trailing silence).
            while (!v.empty()) {
              val seg = v.front()
              v.pop()
              val start = seg?.start ?: 0
              val end = start + (seg?.samples?.size ?: 0)
              Log.i(TAG, "vadLoop: speech segment ended (samples $start..$end)")
              sendEvent("speechend", mapOf("start" to start, "end" to end))
            }
          }
        }
      }
    } catch (t: Throwable) {
      Log.e(TAG, "vadLoop: crashed", t)
      sendError("vadLoop crashed: ${t.message}")
    } finally {
      try { ar.stop() } catch (_: IllegalStateException) {}
      try { ar.release() } catch (_: Throwable) {}
      record = null
      running = false
      Log.i(TAG, "vadLoop: exited")
    }
  }

  private fun sendError(message: String) {
    try {
      sendEvent("error", mapOf("message" to message))
    } catch (t: Throwable) {
      Log.w(TAG, "sendError dropped: $t")
    }
  }
}
