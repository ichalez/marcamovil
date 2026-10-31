import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'config.dart';
import 'screens/clubs_screen.dart';
import 'screens/login_screen.dart';
import 'screens/manual_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  String? firebaseError;
  if (AppConfig.firebaseConfigured) {
    try {
      await Firebase.initializeApp(options: AppConfig.firebaseOptions);
    } catch (e) {
      firebaseError = '$e';
    }
  }
  runApp(MarcaMovilApp(firebaseError: firebaseError));
}

class MarcaMovilApp extends StatelessWidget {
  const MarcaMovilApp({super.key, this.firebaseError});

  final String? firebaseError;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MarcaMóvil',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: AppConfig.firebaseConfigured && firebaseError == null
          ? const AuthGate()
          : ManualScreen(notice: firebaseError ?? 'Sin Firebase configurado: solo modo manual.'),
    );
  }
}

/// Muestra el inicio de sesión o la lista de clubes según el estado de la sesión.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return snap.data == null ? const LoginScreen() : ClubsScreen(user: snap.data!);
      },
    );
  }
}
