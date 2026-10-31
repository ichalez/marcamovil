import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';
import 'match_screen.dart';

class MatchesScreen extends StatelessWidget {
  const MatchesScreen({super.key, required this.club});

  final Club club;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: Text(club.name)), body: MatchesList(club: club));
  }
}

String formatDate(DateTime? d) {
  if (d == null) return 'Sin fecha';
  const days = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  final hh = d.hour.toString().padLeft(2, '0');
  final mm = d.minute.toString().padLeft(2, '0');
  return '${days[d.weekday - 1]} ${d.day} ${months[d.month - 1]} · $hh:$mm';
}

class MatchesList extends StatelessWidget {
  const MatchesList({super.key, required this.club});

  final Club club;

  @override
  Widget build(BuildContext context) {
    final query = FirebaseFirestore.instance
        .collection('clubs')
        .doc(club.id)
        .collection('matches')
        .orderBy('scheduledAt', descending: true)
        .limit(50);
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: query.snapshots(),
      builder: (context, snap) {
        if (snap.hasError) return Center(child: Text('Error: ${snap.error}'));
        if (!snap.hasData) return const Center(child: CircularProgressIndicator());
        final matches = snap.data!.docs.map((d) => Match.fromMap(d.id, club.id, d.data())).toList();
        if (matches.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('No hay partidos. Créalos desde la web.', textAlign: TextAlign.center),
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          itemCount: matches.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final m = matches[i];
            return Card(
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                title: Text(m.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text([formatDate(m.scheduledAt), if (m.competition.isNotEmpty) m.competition].join(' · ')),
                trailing: StatusPill(status: m.status),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MatchScreen(match: m))),
              ),
            );
          },
        );
      },
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (status) {
      'live' => ('En directo', const Color(0xFF3A1414), const Color(0xFFFF8A8A)),
      'finished' => ('Finalizado', const Color(0xFF0F2E1A), const Color(0xFF7EE2A2)),
      _ => ('Programado', kCard, const Color(0xFF8EA0BD)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}
