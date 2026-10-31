import 'package:flutter/material.dart';
import 'package:marcamovil_streamer/marcamovil_streamer.dart';

import '../services/prefs.dart';
import '../theme.dart';
import 'broadcast.dart';

/// Emisión sin cuenta: se escriben a mano el servidor RTMP, la clave y la URL del overlay.
/// Útil para probar (p. ej. con /overlay/demo) o si no hay Firebase configurado.
class ManualScreen extends StatefulWidget {
  const ManualScreen({super.key, this.notice});

  final String? notice;

  @override
  State<ManualScreen> createState() => _ManualScreenState();
}

class _ManualScreenState extends State<ManualScreen> {
  final _rtmp = TextEditingController();
  final _key = TextEditingController();
  final _overlay = TextEditingController();
  StreamQuality _quality = StreamQuality.q720p30;
  bool _adaptive = true;
  bool _showKey = false;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final m = await Prefs.manual();
    final web = await Prefs.webUrl();
    setState(() {
      _rtmp.text = m['rtmpUrl']!;
      _key.text = m['streamKey']!;
      _overlay.text = m['overlayUrl']!.isNotEmpty ? m['overlayUrl']! : (web.isNotEmpty ? '$web/overlay/demo' : '');
      _quality = StreamQuality.fromId(m['quality']);
      _loaded = true;
    });
  }

  Future<void> _start() async {
    await Prefs.setManual({
      'rtmpUrl': _rtmp.text.trim(),
      'streamKey': _key.text.trim(),
      'overlayUrl': _overlay.text.trim(),
      'quality': _quality.id,
    });
    if (!mounted) return;
    await launchBroadcast(
      context,
      BroadcastConfig(
        rtmpUrl: _rtmp.text.trim(),
        streamKey: _key.text.trim(),
        overlayUrl: _overlay.text.trim(),
        title: 'Manual',
        quality: _quality,
        adaptiveBitrate: _adaptive,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Emisión manual')),
      body: !_loaded
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (widget.notice != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(widget.notice!, style: const TextStyle(color: Color(0xFFBCD4FF))),
                  ),
                TextField(controller: _rtmp, decoration: const InputDecoration(labelText: 'Servidor RTMP')),
                const SizedBox(height: 12),
                TextField(
                  controller: _key,
                  obscureText: !_showKey,
                  autocorrect: false,
                  decoration: InputDecoration(
                    labelText: 'Clave de emisión',
                    suffixIcon: IconButton(
                      icon: Icon(_showKey ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showKey = !_showKey),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _overlay,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'URL del overlay',
                    helperText: 'p. ej. https://tu-proyecto.web.app/overlay/demo (vacío = sin marcador)',
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Calidad', style: TextStyle(fontWeight: FontWeight.w700)),
                QualityPicker(value: _quality, onChanged: (q) => setState(() => _quality = q)),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Bajar la calidad si la conexión empeora'),
                  value: _adaptive,
                  onChanged: (v) => setState(() => _adaptive = v),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: kLive, foregroundColor: Colors.white, minimumSize: const Size(0, 60)),
                  icon: const Icon(Icons.videocam),
                  label: const Text('Abrir cámara', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  onPressed: _start,
                ),
              ],
            ),
    );
  }
}
