import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

/// Ajustes locales del dispositivo.
class Prefs {
  static Future<SharedPreferences> get _p => SharedPreferences.getInstance();

  static Future<String> webUrl() async => (await _p).getString('webUrl') ?? AppConfig.defaultWebUrl;
  static Future<void> setWebUrl(String v) async => (await _p).setString('webUrl', v.trim().replaceAll(RegExp(r'/+$'), ''));

  static Future<Map<String, String>> manual() async {
    final p = await _p;
    return {
      'rtmpUrl': p.getString('manual.rtmpUrl') ?? 'rtmp://a.rtmp.youtube.com/live2',
      'streamKey': p.getString('manual.streamKey') ?? '',
      'overlayUrl': p.getString('manual.overlayUrl') ?? '',
      'quality': p.getString('manual.quality') ?? '720p30',
    };
  }

  static Future<void> setManual(Map<String, String> v) async {
    final p = await _p;
    for (final e in v.entries) {
      await p.setString('manual.${e.key}', e.value);
    }
  }
}
