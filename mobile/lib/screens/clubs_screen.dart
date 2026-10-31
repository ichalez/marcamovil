import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models.dart';
import 'manual_screen.dart';
import 'matches_screen.dart';
import 'settings_screen.dart';

class ClubsScreen extends StatelessWidget {
  const ClubsScreen({super.key, required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    final query = FirebaseFirestore.instance.collection('clubs').where('memberUids', arrayContains: user.uid);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tus clubes'),
        actions: [
          IconButton(
            tooltip: 'Ajustes',
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SettingsScreen(user: user))),
          ),
        ],
      ),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: query.snapshots(),
        builder: (context, snap) {
          if (snap.hasError) return _Message('Error: ${snap.error}');
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final clubs = snap.data!.docs.map((d) => Club.fromMap(d.id, d.data(), user.uid)).toList()
            ..sort((a, b) => a.name.compareTo(b.name));
          if (clubs.length == 1) {
            // Con un solo club, vamos directos a sus partidos.
            return MatchesList(club: clubs.first);
          }
          if (clubs.isEmpty) {
            return const _Message('No perteneces a ningún club.\nCrea uno o acepta una invitación desde la web.');
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: clubs.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) => Card(
              child: ListTile(
                title: Text(clubs[i].name, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(clubs[i].role == 'admin' ? 'Administrador' : 'Operador'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MatchesScreen(club: clubs[i]))),
              ),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'manual',
        icon: const Icon(Icons.settings_input_antenna),
        label: const Text('Manual'),
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ManualScreen())),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message(this.text);

  final String text;

  @override
  Widget build(BuildContext context) =>
      Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(text, textAlign: TextAlign.center)));
}
