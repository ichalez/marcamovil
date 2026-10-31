/// Abre la pantalla nativa de emisión (cámara + overlay HTML + RTMP).
library;

import 'package:flutter/services.dart';

/// Calidades de emisión disponibles.
enum StreamQuality {
  q480p30('480p30', 854, 480, 30, 1200000),
  q720p30('720p30', 1280, 720, 30, 2500000),
  q1080p30('1080p30', 1920, 1080, 30, 4500000);

  const StreamQuality(this.id, this.width, this.height, this.fps, this.videoBitrate);

  /// Identificador compartido con la web (`Match.stream.quality`).
  final String id;
  final int width;
  final int height;
  final int fps;
  final int videoBitrate;

  String get label => '${height}p · $fps fps · ${(videoBitrate / 1000000).toStringAsFixed(1)} Mbps';

  static StreamQuality fromId(String? id) =>
      StreamQuality.values.firstWhere((q) => q.id == id, orElse: () => StreamQuality.q720p30);
}

class BroadcastConfig {
  const BroadcastConfig({
    required this.rtmpUrl,
    required this.streamKey,
    required this.overlayUrl,
    this.title = '',
    this.quality = StreamQuality.q720p30,
    this.audioBitrate = 128000,
    this.adaptiveBitrate = true,
    this.overlayFps = 4,
  });

  final String rtmpUrl;
  final String streamKey;
  final String overlayUrl;
  final String title;
  final StreamQuality quality;
  final int audioBitrate;
  final bool adaptiveBitrate;

  /// Veces por segundo que se recaptura el overlay (el vídeo va siempre a 30 fps).
  final int overlayFps;

  Map<String, Object?> toMap() => {
        'rtmpUrl': rtmpUrl,
        'streamKey': streamKey,
        'overlayUrl': overlayUrl,
        'title': title,
        'width': quality.width,
        'height': quality.height,
        'fps': quality.fps,
        'videoBitrate': quality.videoBitrate,
        'audioBitrate': audioBitrate,
        'adaptiveBitrate': adaptiveBitrate,
        'overlayFps': overlayFps,
      };
}

class BroadcastResult {
  const BroadcastResult({required this.streamedSeconds, this.error});

  final int streamedSeconds;
  final String? error;
}

class MarcamovilStreamer {
  static const MethodChannel _channel = MethodChannel('marcamovil_streamer');

  /// Abre la pantalla de emisión y espera a que el usuario la cierre.
  static Future<BroadcastResult> openBroadcast(BroadcastConfig config) async {
    final res = await _channel.invokeMapMethod<String, Object?>('openBroadcast', config.toMap());
    return BroadcastResult(
      streamedSeconds: (res?['streamedSeconds'] as num?)?.toInt() ?? 0,
      error: res?['error'] as String?,
    );
  }
}
