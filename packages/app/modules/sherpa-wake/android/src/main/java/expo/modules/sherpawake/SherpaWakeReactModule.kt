package expo.modules.sherpawake

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.k2fsa.sherpa.onnx.*
import kotlinx.coroutines.*

class SherpaWakeReactModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    companion object {
        private const val TAG = "SherpaWake"
        private const val SAMPLE_RATE = 16000
        private const val MODEL_DIR = "sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01"
    }

    override fun getName() = "SherpaWake"

    private var spotter: KeywordSpotter? = null
    private var record: AudioRecord? = null
    private var running = false
    private var userEnabled = false
    private var kwsJob: Job? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @ReactMethod
    fun init(promise: Promise) {
        if (spotter != null) { promise.resolve(true); return }
        val am = ctx.assets ?: run { promise.resolve(false); return }
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
        } catch (t: Throwable) { Log.e(TAG, "init: failed", t); null }
        promise.resolve(spotter != null)
    }

    @ReactMethod
    fun start(promise: Promise) {
        val s = spotter ?: run { promise.resolve(false); return }
        userEnabled = true
        if (running) { promise.resolve(true); return }
        running = true
        kwsJob = scope.launch { kwsLoop(s) }
        Log.i(TAG, "start: KWS loop launched")
        promise.resolve(true)
    }

    @ReactMethod
    fun stop(promise: Promise) {
        userEnabled = false; running = false; kwsJob?.cancel(); kwsJob = null
        try { record?.stop() } catch (_: IllegalStateException) {}
        promise.resolve(true)
    }

    @ReactMethod
    fun destroy(promise: Promise) {
        userEnabled = false; running = false; kwsJob?.cancel(); kwsJob = null
        try { record?.stop() } catch (_: IllegalStateException) {}
        try { record?.release() } catch (_: Throwable) {}
        record = null
        try { spotter?.release() } catch (_: Throwable) {}
        spotter = null
        promise.resolve(true)
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    private suspend fun kwsLoop(s: KeywordSpotter) {
        val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val bufSize = (minBuf * 4).coerceAtLeast(3200)
        val ar = try {
            AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufSize)
        } catch (t: Throwable) { Log.e(TAG, "kwsLoop: AudioRecord failed", t); running = false; return }
        if (ar.state != AudioRecord.STATE_INITIALIZED) { ar.release(); running = false; return }
        record = ar; ar.startRecording()
        val stream = s.createStream()
        val shorts = ShortArray(bufSize / 2); val floats = FloatArray(bufSize / 2)
        try {
            while (running) {
                val n = ar.read(shorts, 0, shorts.size)
                if (n <= 0) continue
                for (i in 0 until n) floats[i] = shorts[i] / 32768.0f
                stream.acceptWaveform(floats.copyOfRange(0, n), SAMPLE_RATE)
                while (s.isReady(stream)) {
                    s.decode(stream)
                    val keyword = s.getResult(stream).keyword.trim()
                    if (keyword.isNotEmpty()) {
                        Log.i(TAG, "hit: $keyword")
                        val params = Arguments.createMap(); params.putString("keyword", keyword)
                        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit("wake", params)
                        s.reset(stream); Thread.sleep(1200)
                    }
                }
            }
        } catch (t: Throwable) { Log.e(TAG, "kwsLoop crashed", t) }
        finally {
            try { ar.stop() } catch (_: Exception) {}
            try { ar.release() } catch (_: Throwable) {}
            record = null; try { stream.release() } catch (_: Throwable) {}
            running = false
        }
    }
}
