import 'package:flutter_test/flutter_test.dart';
import 'package:marcamovil/models.dart';
import 'package:marcamovil_streamer/marcamovil_streamer.dart';

void main() {
  test('lee un partido de Firestore con su configuración de emisión', () {
    final m = Match.fromMap('m1', 'c1', {
      'homeName': 'CD Río Verde',
      'awayName': 'UD Montesol',
      'competition': 'Liga',
      'scheduledAt': '2026-11-02T11:30',
      'status': 'live',
      'stream': {'rtmpUrl': 'rtmp://a.rtmp.youtube.com/live2', 'streamKey': 'abc', 'quality': '1080p30', 'adaptiveBitrate': false},
    });
    expect(m.title, 'CD Río Verde – UD Montesol');
    expect(m.scheduledAt, DateTime(2026, 11, 2, 11, 30));
    expect(m.quality, StreamQuality.q1080p30);
    expect(m.adaptiveBitrate, isFalse);
    expect(m.streamKey, 'abc');
  });

  test('valores por defecto si faltan datos', () {
    final m = Match.fromMap('m1', 'c1', {});
    expect(m.quality, StreamQuality.q720p30);
    expect(m.rtmpUrl, startsWith('rtmp://'));
    expect(m.status, 'scheduled');
  });

  test('la configuración se envía al código nativo con resolución y bitrate', () {
    const c = BroadcastConfig(rtmpUrl: 'rtmp://x/live', streamKey: 'k', overlayUrl: 'https://w/overlay/1', quality: StreamQuality.q480p30);
    final map = c.toMap();
    expect(map['width'], 854);
    expect(map['height'], 480);
    expect(map['videoBitrate'], 1200000);
  });
}
