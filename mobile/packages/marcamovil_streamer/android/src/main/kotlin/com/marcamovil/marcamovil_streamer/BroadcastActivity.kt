package com.marcamovil.marcamovil_streamer

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.TypedValue
import android.view.Gravity
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.pedro.common.ConnectChecker
import com.pedro.common.StreamingStatsReport
import com.pedro.encoder.input.gl.render.filters.`object`.ImageFilterRender
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.video.Camera2Source
import com.pedro.library.rtmp.RtmpStream
import com.pedro.library.util.QueueAwareBitrateAdapter
import java.util.Locale

/**
 * Pantalla de emisión: cámara + overlay HTML + envío RTMP.
 *
 * El overlay se carga en un WebView transparente del tamaño exacto del vídeo. Varias veces por
 * segundo se dibuja en un Bitmap y se pasa a un filtro OpenGL que lo superpone a cada fotograma,
 * de modo que la vista previa muestra exactamente lo que se emite.
 */
class BroadcastActivity : Activity(), ConnectChecker {

    companion object {
        const val RESULT_SECONDS = "streamedSeconds"
        const val RESULT_ERROR = "error"
        private const val PERMISSIONS_REQUEST = 7
        private const val MAX_RETRIES = 30
        private const val RETRY_DELAY_MS = 3000L
    }

    private lateinit var config: BroadcastConfig
    private var stream: RtmpStream? = null
    private val main = Handler(Looper.getMainLooper())

    // Vistas
    private lateinit var root: FrameLayout
    private lateinit var surfaceView: SurfaceView
    private lateinit var webView: WebView
    private lateinit var statusText: TextView
    private lateinit var infoText: TextView
    private lateinit var startButton: Button
    private lateinit var muteButton: Button
    private lateinit var overlayButton: Button

    // Overlay
    private val overlayFilter = ImageFilterRender()
    private var overlayFilterAdded = false
    private val overlayBitmaps = ArrayList<Bitmap>()
    private var overlayIndex = 0
    private var overlayEnabled = true
    private var overlayLoaded = false

    // Estado de la emisión
    private var wantStreaming = false
    private var connected = false
    private var streamStartedAt = 0L
    private var accumulatedMs = 0L
    private var retries = 0
    private var lastBitrate = 0L
    private var lastError: String? = null
    private var bitrateAdapter: QueueAwareBitrateAdapter? = null

    private val overlayTick = object : Runnable {
        override fun run() {
            captureOverlay()
            main.postDelayed(this, (1000L / config.overlayFps.coerceIn(1, 15)))
        }
    }

    private val uiTick = object : Runnable {
        override fun run() {
            updateUi()
            main.postDelayed(this, 500)
        }
    }

    // ---------------------------------------------------------------- ciclo de vida

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        config = BroadcastConfig.fromIntent(intent)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemBars()
        buildLayout()
        if (hasPermissions()) setUpStream() else requestPermissions(
            arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO), PERMISSIONS_REQUEST
        )
        main.post(uiTick)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != PERMISSIONS_REQUEST) return
        if (hasPermissions()) setUpStream()
        else fail("Hacen falta los permisos de cámara y micrófono para emitir.")
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        stream?.let {
            if (it.isStreaming) it.stopStream()
            if (it.isOnPreview) it.stopPreview()
            it.release()
        }
        stream = null
        webView.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        confirmExit()
    }

    private fun hasPermissions(): Boolean =
        checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
    }

    // ---------------------------------------------------------------- interfaz

    private fun dp(v: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    private fun pill(color: Int, radius: Int = 22): GradientDrawable = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius).toFloat()
    }

    private fun button(text: String, color: Int = 0xCC1B2842.toInt(), onClick: () -> Unit): Button =
        Button(this).apply {
            this.text = text
            isAllCaps = false
            setTextColor(Color.WHITE)
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            background = pill(color)
            setPadding(dp(16), 0, dp(16), 0)
            minHeight = dp(44)
            minimumHeight = dp(44)
            stateListAnimator = null
            setOnClickListener { onClick() }
        }

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildLayout() {
        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }

        // 1) WebView del overlay, al fondo y del tamaño exacto del vídeo. La SurfaceView de la
        //    cámara lo tapa, así que el usuario no lo ve directamente; se ve compuesto en el vídeo.
        webView = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) settings.offscreenPreRaster = true
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    overlayLoaded = true
                }
            }
        }
        root.addView(webView, FrameLayout.LayoutParams(config.width, config.height))

        // 2) Vista previa de la cámara (ya con el overlay aplicado por OpenGL).
        surfaceView = SurfaceView(this)
        root.addView(surfaceView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        // 3) Barra superior: estado + información.
        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(10), dp(12), 0)
        }
        statusText = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(12), dp(6), dp(12), dp(6))
            background = pill(0xCC333F55.toInt(), 8)
        }
        infoText = TextView(this).apply {
            setTextColor(0xFFDDE6F3.toInt())
            textSize = 13f
            setPadding(dp(10), dp(6), dp(10), dp(6))
            background = pill(0x99000000.toInt(), 8)
        }
        top.addView(statusText)
        top.addView(View(this), LinearLayout.LayoutParams(dp(8), 1))
        top.addView(infoText)
        root.addView(top, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP))

        // 4) Botones inferiores.
        val bottom = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), 0, dp(12), dp(12))
        }
        val gap = { View(this).also { bottom.addView(it, LinearLayout.LayoutParams(dp(8), 1)) } }
        bottom.addView(button("✕ Salir") { confirmExit() })
        gap()
        bottom.addView(button("⟲ Cámara") { switchCamera() })
        gap()
        muteButton = button("🎤 Micro: sí") { toggleMute() }
        bottom.addView(muteButton)
        gap()
        overlayButton = button("Marcador: sí") { toggleOverlay() }
        bottom.addView(overlayButton)
        bottom.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        startButton = button("● EMITIR", 0xFFE11D2A.toInt()) { toggleStream() }.apply {
            textSize = 17f
            minWidth = dp(150)
            minimumWidth = dp(150)
            minHeight = dp(56)
            minimumHeight = dp(56)
            background = pill(0xFFE11D2A.toInt(), 28)
        }
        bottom.addView(startButton)
        root.addView(bottom, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))

        setContentView(root)
    }

    // ---------------------------------------------------------------- emisión

    private fun setUpStream() {
        val s = RtmpStream(this, this, Camera2Source(this), MicrophoneSource())
        val prepared = try {
            s.prepareVideo(config.width, config.height, config.videoBitrate, config.fps, 2, 0) &&
                s.prepareAudio(44100, true, config.audioBitrate)
        } catch (e: IllegalArgumentException) {
            false
        }
        if (!prepared) {
            fail("Este móvil no admite ${config.width}×${config.height} a ${config.fps} fps. Prueba con una calidad menor.")
            return
        }
        s.getStreamClient().setReTries(MAX_RETRIES)
        stream = s

        if (config.adaptiveBitrate) {
            bitrateAdapter = QueueAwareBitrateAdapter(
                config.videoBitrate + config.audioBitrate,
                (config.videoBitrate / 6) + config.audioBitrate,
            ) { bitrate ->
                stream?.setVideoBitrateOnFly((bitrate - config.audioBitrate).coerceAtLeast(150_000))
            }
        }

        surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
            override fun surfaceCreated(holder: SurfaceHolder) {
                val st = stream ?: return
                if (!st.isOnPreview) st.startPreview(surfaceView)
                if (!overlayFilterAdded) {
                    st.getGlInterface().addFilter(overlayFilter)
                    overlayFilterAdded = true
                }
            }

            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
                stream?.getGlInterface()?.setPreviewResolution(width, height)
            }

            override fun surfaceDestroyed(holder: SurfaceHolder) {
                val st = stream ?: return
                if (st.isOnPreview) st.stopPreview()
                overlayFilterAdded = false
            }
        })

        // Bitmaps reutilizables (3 para que el hilo de OpenGL nunca lea uno que se está dibujando).
        repeat(3) { overlayBitmaps.add(Bitmap.createBitmap(config.width, config.height, Bitmap.Config.ARGB_8888)) }
        if (config.overlayUrl.isNotBlank()) webView.loadUrl(config.overlayUrl)
        main.post(overlayTick)
    }

    private fun toggleStream() {
        val s = stream ?: return
        if (wantStreaming) {
            AlertDialog.Builder(this)
                .setTitle("¿Parar la emisión?")
                .setMessage("Se cortará el directo en YouTube.")
                .setPositiveButton("Parar") { _, _ -> stopStreaming() }
                .setNegativeButton("Seguir emitiendo", null)
                .show()
            return
        }
        if (config.rtmpUrl.isBlank() || config.streamKey.isBlank()) {
            AlertDialog.Builder(this)
                .setTitle("Falta la clave de emisión")
                .setMessage("Configura el servidor RTMP y la clave de emisión de YouTube en el partido.")
                .setPositiveButton("Vale", null)
                .show()
            return
        }
        wantStreaming = true
        retries = 0
        lastError = null
        s.startStream(config.endpoint)
        updateUi()
    }

    private fun stopStreaming() {
        wantStreaming = false
        if (connected) accumulatedMs += SystemClock.elapsedRealtime() - streamStartedAt
        connected = false
        stream?.let { if (it.isStreaming) it.stopStream() }
        updateUi()
    }

    private fun switchCamera() {
        (stream?.videoSource as? Camera2Source)?.switchCamera()
    }

    private fun toggleMute() {
        val mic = stream?.audioSource as? MicrophoneSource ?: return
        if (mic.isMuted()) mic.unMute() else mic.mute()
        muteButton.text = if (mic.isMuted()) "🔇 Micro: no" else "🎤 Micro: sí"
    }

    private fun toggleOverlay() {
        overlayEnabled = !overlayEnabled
        overlayButton.text = if (overlayEnabled) "Marcador: sí" else "Marcador: no"
        if (!overlayEnabled) {
            val empty = overlayBitmaps.getOrNull(overlayIndex) ?: return
            overlayIndex = (overlayIndex + 1) % overlayBitmaps.size
            empty.eraseColor(Color.TRANSPARENT)
            overlayFilter.setImage(empty)
        }
    }

    /** Dibuja el WebView en un Bitmap y lo envía al filtro de OpenGL. */
    private fun captureOverlay() {
        if (!overlayEnabled || !overlayLoaded || overlayBitmaps.isEmpty()) return
        if (webView.width <= 0 || webView.height <= 0) return
        val bmp = overlayBitmaps[overlayIndex]
        overlayIndex = (overlayIndex + 1) % overlayBitmaps.size
        bmp.eraseColor(Color.TRANSPARENT)
        val canvas = Canvas(bmp)
        canvas.scale(bmp.width.toFloat() / webView.width, bmp.height.toFloat() / webView.height)
        try {
            webView.draw(canvas)
        } catch (_: Exception) {
            return
        }
        overlayFilter.setImage(bmp)
    }

    private fun confirmExit() {
        if (!wantStreaming) {
            finishWithResult()
            return
        }
        AlertDialog.Builder(this)
            .setTitle("¿Salir y parar la emisión?")
            .setPositiveButton("Salir") { _, _ ->
                stopStreaming()
                finishWithResult()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun finishWithResult() {
        val data = Intent()
        data.putExtra(RESULT_SECONDS, totalStreamedMs() / 1000)
        lastError?.let { data.putExtra(RESULT_ERROR, it) }
        setResult(RESULT_OK, data)
        finish()
    }

    private fun fail(message: String) {
        lastError = message
        AlertDialog.Builder(this)
            .setTitle("No se puede emitir")
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("Cerrar") { _, _ -> finishWithResult() }
            .show()
    }

    private fun totalStreamedMs(): Long =
        accumulatedMs + if (connected) SystemClock.elapsedRealtime() - streamStartedAt else 0L

    private fun updateUi() {
        val seconds = totalStreamedMs() / 1000
        val time = String.format(Locale.US, "%d:%02d:%02d", seconds / 3600, (seconds / 60) % 60, seconds % 60)
        val (label, color) = when {
            connected -> "● EN DIRECTO  $time" to 0xE6E11D2A.toInt()
            wantStreaming && retries > 0 -> "Reconectando… ($retries/$MAX_RETRIES)" to 0xE6D97706.toInt()
            wantStreaming -> "Conectando…" to 0xE6D97706.toInt()
            else -> "Vista previa" to 0xCC333F55.toInt()
        }
        statusText.text = label
        statusText.background = pill(color, 8)
        val kbps = if (connected && lastBitrate > 0) "  ·  ${lastBitrate / 1000} kbps" else ""
        val overlay = if (config.overlayUrl.isBlank()) "  ·  sin overlay" else if (!overlayLoaded) "  ·  cargando overlay…" else ""
        infoText.text = "${config.height}p${config.fps}$kbps$overlay" + (if (config.title.isNotBlank()) "  ·  ${config.title}" else "")
        startButton.text = if (wantStreaming) "■ PARAR" else "● EMITIR"
        startButton.background = pill(if (wantStreaming) 0xFF374151.toInt() else 0xFFE11D2A.toInt(), 28)
    }

    // ---------------------------------------------------------------- ConnectChecker (hilos de red)

    override fun onConnectionStarted(url: String) {
        bitrateAdapter?.reset()
    }

    override fun onConnectionSuccess() {
        main.post {
            connected = true
            retries = 0
            streamStartedAt = SystemClock.elapsedRealtime()
            updateUi()
        }
    }

    override fun onConnectionFailed(reason: String) {
        main.post {
            if (connected) accumulatedMs += SystemClock.elapsedRealtime() - streamStartedAt
            connected = false
            val s = stream
            if (wantStreaming && s != null && s.getStreamClient().reTry(RETRY_DELAY_MS, reason, null)) {
                retries++
            } else {
                wantStreaming = false
                s?.let { if (it.isStreaming) it.stopStream() }
                lastError = reason
                AlertDialog.Builder(this)
                    .setTitle("Se ha cortado la emisión")
                    .setMessage("No se pudo conectar con YouTube: $reason\n\nRevisa la conexión y la clave de emisión.")
                    .setPositiveButton("Vale", null)
                    .show()
            }
            updateUi()
        }
    }

    override fun onNewBitrate(bitrate: Long) {
        lastBitrate = bitrate
    }

    override fun onStreamingStats(report: StreamingStatsReport) {
        main.post { bitrateAdapter?.onStreamingStats(report) }
    }

    override fun onDisconnect() {
        main.post {
            if (connected) accumulatedMs += SystemClock.elapsedRealtime() - streamStartedAt
            connected = false
            updateUi()
        }
    }

    override fun onAuthError() {
        main.post {
            stopStreaming()
            lastError = "Error de autenticación"
            AlertDialog.Builder(this)
                .setTitle("Clave rechazada")
                .setMessage("El servidor ha rechazado la clave de emisión.")
                .setPositiveButton("Vale", null)
                .show()
        }
    }

    override fun onAuthSuccess() {}
}
