package com.marcamovil.marcamovil_streamer

import android.app.Activity
import android.content.Intent
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import io.flutter.plugin.common.MethodChannel.Result
import io.flutter.plugin.common.PluginRegistry

/** Puente Flutter → pantalla nativa de emisión. */
class MarcamovilStreamerPlugin : FlutterPlugin, MethodCallHandler, ActivityAware,
    PluginRegistry.ActivityResultListener {

    private lateinit var channel: MethodChannel
    private var activity: Activity? = null
    private var binding: ActivityPluginBinding? = null
    private var pending: Result? = null

    override fun onAttachedToEngine(flutterPluginBinding: FlutterPlugin.FlutterPluginBinding) {
        channel = MethodChannel(flutterPluginBinding.binaryMessenger, "marcamovil_streamer")
        channel.setMethodCallHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: Result) {
        when (call.method) {
            "openBroadcast" -> {
                val act = activity
                if (act == null) {
                    result.error("NO_ACTIVITY", "No hay actividad", null)
                    return
                }
                if (pending != null) {
                    result.error("BUSY", "Ya hay una emisión abierta", null)
                    return
                }
                val args = call.arguments as? Map<*, *> ?: emptyMap<String, Any>()
                val config = BroadcastConfig.fromMap(args)
                pending = result
                act.startActivityForResult(config.toIntent(act), REQUEST_CODE)
            }
            else -> result.notImplemented()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQUEST_CODE) return false
        val summary = HashMap<String, Any?>()
        summary["streamedSeconds"] = data?.getLongExtra(BroadcastActivity.RESULT_SECONDS, 0L) ?: 0L
        summary["error"] = data?.getStringExtra(BroadcastActivity.RESULT_ERROR)
        pending?.success(summary)
        pending = null
        return true
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        this.binding = binding
        activity = binding.activity
        binding.addActivityResultListener(this)
    }

    override fun onDetachedFromActivityForConfigChanges() = onDetachedFromActivity()

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) =
        onAttachedToActivity(binding)

    override fun onDetachedFromActivity() {
        binding?.removeActivityResultListener(this)
        binding = null
        activity = null
    }

    companion object {
        private const val REQUEST_CODE = 0x4D4D
    }
}
