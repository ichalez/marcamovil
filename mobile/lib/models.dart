import 'package:marcamovil_streamer/marcamovil_streamer.dart';

/// Club del usuario (`clubs/{id}`).
class Club {
  Club({required this.id, required this.name, required this.role});

  final String id;
  final String name;
  final String role;

  factory Club.fromMap(String id, Map<String, dynamic> m, String uid) => Club(
        id: id,
        name: (m['name'] as String?) ?? 'Club',
        role: ((m['roles'] as Map?)?[uid] as String?) ?? 'operator',
      );
}

/// Partido (`clubs/{clubId}/matches/{id}`). Contiene la clave de emisión.
class Match {
  Match({
    required this.id,
    required this.clubId,
    required this.homeName,
    required this.awayName,
    required this.competition,
    required this.round,
    required this.venue,
    required this.scheduledAt,
    required this.status,
    required this.rtmpUrl,
    required this.streamKey,
    required this.quality,
    required this.adaptiveBitrate,
  });

  final String id;
  final String clubId;
  final String homeName;
  final String awayName;
  final String competition;
  final String round;
  final String venue;
  final DateTime? scheduledAt;
  final String status;
  final String rtmpUrl;
  final String streamKey;
  final StreamQuality quality;
  final bool adaptiveBitrate;

  String get title => '$homeName – $awayName';

  factory Match.fromMap(String id, String clubId, Map<String, dynamic> m) {
    final stream = (m['stream'] as Map?)?.cast<String, dynamic>() ?? const {};
    return Match(
      id: id,
      clubId: clubId,
      homeName: (m['homeName'] as String?) ?? 'Local',
      awayName: (m['awayName'] as String?) ?? 'Visitante',
      competition: (m['competition'] as String?) ?? '',
      round: (m['round'] as String?) ?? '',
      venue: (m['venue'] as String?) ?? '',
      scheduledAt: DateTime.tryParse((m['scheduledAt'] as String?) ?? ''),
      status: (m['status'] as String?) ?? 'scheduled',
      rtmpUrl: (stream['rtmpUrl'] as String?) ?? 'rtmp://a.rtmp.youtube.com/live2',
      streamKey: (stream['streamKey'] as String?) ?? '',
      quality: StreamQuality.fromId(stream['quality'] as String?),
      adaptiveBitrate: (stream['adaptiveBitrate'] as bool?) ?? true,
    );
  }
}
