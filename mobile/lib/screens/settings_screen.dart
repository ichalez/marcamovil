import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../config.dart';
import '../services/prefs.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.user});

  final User user;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _web = TextEditingController();

  @override
  void initState() {
    super.initState();
    Prefs.webUrl().then((v) => setState(() => _web.text = v));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ajustes')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _web,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'URL de la web',
              helperText: 'De aquí se carga el marcador. Por defecto: ${AppConfig.defaultWebUrl.isEmpty ? '—' : AppConfig.defaultWebUrl}',
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () async {
              await Prefs.setWebUrl(_web.text);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Guardado')));
              }
            },
            child: const Text('Guardar'),
          ),
          const Divider(height: 40),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.person),
            title: Text(widget.user.displayName ?? widget.user.email ?? ''),
            subtitle: Text(widget.user.email ?? ''),
          ),
          OutlinedButton.icon(
            icon: const Icon(Icons.logout),
            label: const Text('Cerrar sesión'),
            onPressed: () async {
              await FirebaseAuth.instance.signOut();
              if (context.mounted) Navigator.of(context).popUntil((r) => r.isFirst);
            },
          ),
        ],
      ),
    );
  }
}
