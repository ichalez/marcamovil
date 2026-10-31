import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:marcamovil_streamer/marcamovil_streamer.dart';

import '../models.dart';
import '../services/prefs.dart';
import '../theme.dart';
import 'broadcast.dart';
import 'matches_screen.dart';

class MatchScreen extends StatefulWidget {
  const MatchScreen({super.key, required this.match});

  final Match match;

  @override
  State<MatchScreen> createState() => _MatchScreenState();
}

class _MatchScreenState extends State<MatchScreen> {
  StreamQuality? _quality;
  bool? _adaptive;
  String _webUrl = '';

  DocumentReference<Map<String, dynamic>> get _ref => FirebaseFirestore.instance
      .collection('clubs')
      .doc(widget.match.clubId)
      .collection('matches')
      .doc(widget.match.id);

  @override
  void initState() {
    super.initState();
    Prefs.webUrl().then((v) => setState(() => _webUrl = v));
  }

  String get _overlayUrl => _webUrl.isEmpty ? '' : '$_webUrl/overlay/${widget.match.id}';

  Future<void> _broadcast(Match m) async {
    final quality = _quality ?? m.quality;
    if (m.status == 'scheduled') {
      await _ref.update({'status': 'live'}).catchError((_) {});
    }
    if (!mounted) return;
    final result = await launchBroadcast(
      context,
      BroadcastConfig(
        rtmpUrl: m.rtmpUrl,
        streamKey: m.streamKey,
        overlayUrl: _overlayUrl,
        title: m.title,
        quality: quality,
        adaptiveBitrate: _adaptive ?? m.adaptiveBitrate,
      ),
    );
    if (!mounted || result == null || result.streamedSeconds == 0) return;
    final finish = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('¿Ha terminado el partido?'),
        content: const Text('Puedes marcarlo como finalizado o dejarlo en directo si vas a seguir emitiendo.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Sigue en directo')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Finalizado')),
        ],
      ),
    );
    if (finish == true) await _ref.update({'status': 'finished'}).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: _ref.snapshots(),
      builder: (context, snap) {
        final m = snap.data?.data() != null ? Match.fromMap(widget.match.id, widget.match.clubId, snap.data!.data()!) : widget.match;
        final quality = _quality ?? m.quality;
        final problems = <String>[
          if (m.streamKey.isEmpty) 'Falta la clave de emisión de YouTube (edítala en la web, en el partido).',
          if (_webUrl.isEmpty) 'Falta la URL de la web para cargar el marcador (Ajustes).',
        ];
        return Scaffold(
          appBar: AppBar(title: Text(m.title)),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(child: Text(m.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
                        StatusPill(status: m.status),
                      ]),
                      const SizedBox(height: 6),
                      Text([
                        formatDate(m.scheduledAt),
                        if (m.competition.isNotEmpty) m.competition,
                        if (m.round.isNotEmpty) m.round,
                        if (m.venue.isNotEmpty) m.venue,
                      ].join(' · ')),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Calidad', style: TextStyle(fontWeight: FontWeight.w700)),
                      QualityPicker(value: quality, onChanged: (q) => setState(() => _quality = q)),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Bajar la calidad si la conexión empeora'),
                        value: _adaptive ?? m.adaptiveBitrate,
                        onChanged: (v) => setState(() => _adaptive = v),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Antes de empezar', style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      _Check(ok: m.streamKey.isNotEmpty, text: 'Clave de emisión configurada'),
                      _Check(ok: _webUrl.isNotEmpty, text: 'Marcador: ${_overlayUrl.isEmpty ? 'sin URL' : _overlayUrl}'),
                      const _Check(ok: true, text: 'Pon el móvil en horizontal y enchufado si puedes'),
                      const _Check(ok: true, text: 'Abre el panel de control en otro dispositivo'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              for (final p in problems)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(p, style: const TextStyle(color: Color(0xFFFFB4B4))),
                ),
              FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: kLive, foregroundColor: Colors.white, minimumSize: const Size(0, 60)),
                icon: const Icon(Icons.videocam),
                label: const Text('Abrir cámara', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                onPressed: () => _broadcast(m),
              ),
              const SizedBox(height: 8),
              const Text(
                'Se abre la cámara con el marcador encima. La emisión empieza al pulsar «EMITIR».',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF8EA0BD)),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Check extends StatelessWidget {
  const _Check({required this.ok, required this.text});

  final bool ok;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(ok ? Icons.check_circle : Icons.error, size: 20, color: ok ? const Color(0xFF22C55E) : const Color(0xFFEF4444)),
          const SizedBox(width: 8),
          Expanded(child: Text(text)),
        ]),
      );
}
