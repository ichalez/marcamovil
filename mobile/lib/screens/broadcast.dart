import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:marcamovil_streamer/marcamovil_streamer.dart';

/// Abre la pantalla nativa de emisión y muestra los errores de forma amable.
Future<BroadcastResult?> launchBroadcast(BuildContext context, BroadcastConfig config) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    final result = await MarcamovilStreamer.openBroadcast(config);
    if (result.streamedSeconds > 0) {
      final m = result.streamedSeconds ~/ 60;
      final s = result.streamedSeconds % 60;
      messenger.showSnackBar(SnackBar(content: Text('Emisión terminada: $m min $s s en directo.')));
    }
    return result;
  } on PlatformException catch (e) {
    messenger.showSnackBar(SnackBar(content: Text('No se pudo abrir la cámara: ${e.message ?? e.code}')));
  } on MissingPluginException {
    messenger.showSnackBar(const SnackBar(content: Text('La emisión solo funciona en Android e iPhone.')));
  }
  return null;
}

class QualityPicker extends StatelessWidget {
  const QualityPicker({super.key, required this.value, required this.onChanged});

  final StreamQuality value;
  final ValueChanged<StreamQuality> onChanged;

  static const _hints = {
    StreamQuality.q480p30: 'Conexión muy justa',
    StreamQuality.q720p30: 'Recomendado con 4G',
    StreamQuality.q1080p30: 'WiFi o 5G buenos',
  };

  @override
  Widget build(BuildContext context) {
    return RadioGroup<StreamQuality>(
      groupValue: value,
      onChanged: (q) => q == null ? null : onChanged(q),
      child: Column(
        children: [
          for (final q in StreamQuality.values)
            RadioListTile<StreamQuality>(
              value: q,
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(q.label),
              subtitle: Text(_hints[q]!),
            ),
        ],
      ),
    );
  }
}
