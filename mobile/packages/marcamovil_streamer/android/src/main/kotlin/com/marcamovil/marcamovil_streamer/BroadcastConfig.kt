package com.marcamovil.marcamovil_streamer

import android.content.Context
import android.content.Intent

/** Parámetros de una emisión, recibidos desde Flutter. */
data class BroadcastConfig(
    val rtmpUrl: String,
    val streamKey: String,
    val overlayUrl: String,
    val title: String,
    val width: Int,
    val height: Int,
    val fps: Int,
    val videoBitrate: Int,
    val audioBitrate: Int,
    val adaptiveBitrate: Boolean,
    val overlayFps: Int,
) {
    /** URL completa: servidor + "/" + clave. */
    val endpoint: String
        get() {
            val base = rtmpUrl.trim().trimEnd('/')
            val key = streamKey.trim()
            return if (key.isEmpty()) base else "$base/$key"
        }

    fun toIntent(context: Context): Intent = Intent(context, BroadcastActivity::class.java).apply {
        putExtra("rtmpUrl", rtmpUrl)
        putExtra("streamKey", streamKey)
        putExtra("overlayUrl", overlayUrl)
        putExtra("title", title)
        putExtra("width", width)
        putExtra("height", height)
        putExtra("fps", fps)
        putExtra("videoBitrate", videoBitrate)
        putExtra("audioBitrate", audioBitrate)
        putExtra("adaptiveBitrate", adaptiveBitrate)
        putExtra("overlayFps", overlayFps)
    }

    companion object {
        fun fromMap(m: Map<*, *>): BroadcastConfig = BroadcastConfig(
            rtmpUrl = m["rtmpUrl"] as? String ?: "",
            streamKey = m["streamKey"] as? String ?: "",
            overlayUrl = m["overlayUrl"] as? String ?: "",
            title = m["title"] as? String ?: "",
            width = (m["width"] as? Number)?.toInt() ?: 1280,
            height = (m["height"] as? Number)?.toInt() ?: 720,
            fps = (m["fps"] as? Number)?.toInt() ?: 30,
            videoBitrate = (m["videoBitrate"] as? Number)?.toInt() ?: 2_500_000,
            audioBitrate = (m["audioBitrate"] as? Number)?.toInt() ?: 128_000,
            adaptiveBitrate = m["adaptiveBitrate"] as? Boolean ?: true,
            overlayFps = (m["overlayFps"] as? Number)?.toInt() ?: 4,
        )

        fun fromIntent(i: Intent): BroadcastConfig = BroadcastConfig(
            rtmpUrl = i.getStringExtra("rtmpUrl") ?: "",
            streamKey = i.getStringExtra("streamKey") ?: "",
            overlayUrl = i.getStringExtra("overlayUrl") ?: "",
            title = i.getStringExtra("title") ?: "",
            width = i.getIntExtra("width", 1280),
            height = i.getIntExtra("height", 720),
            fps = i.getIntExtra("fps", 30),
            videoBitrate = i.getIntExtra("videoBitrate", 2_500_000),
            audioBitrate = i.getIntExtra("audioBitrate", 128_000),
            adaptiveBitrate = i.getBooleanExtra("adaptiveBitrate", true),
            overlayFps = i.getIntExtra("overlayFps", 4),
        )
    }
}
