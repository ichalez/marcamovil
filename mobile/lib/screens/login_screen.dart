import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../theme.dart';
import 'manual_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _info;

  String _translate(Object e) {
    if (e is FirebaseAuthException) {
      switch (e.code) {
        case 'invalid-credential':
        case 'wrong-password':
        case 'user-not-found':
          return 'Email o contraseña incorrectos.';
        case 'invalid-email':
          return 'El email no es válido.';
        case 'too-many-requests':
          return 'Demasiados intentos. Espera un poco.';
        case 'network-request-failed':
          return 'Sin conexión a internet.';
      }
      return e.message ?? e.code;
    }
    return '$e';
  }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    try {
      await fn();
    } catch (e) {
      setState(() => _error = _translate(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text.rich(
                    TextSpan(children: [
                      const TextSpan(text: 'Marca'),
                      TextSpan(text: 'Móvil', style: TextStyle(color: kAccent)),
                    ]),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  const Text('Entra con la misma cuenta que en la web.', textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    decoration: const InputDecoration(labelText: 'Email'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Contraseña'),
                    onSubmitted: (_) => _login(),
                  ),
                  const SizedBox(height: 16),
                  if (_error != null) Text(_error!, style: const TextStyle(color: Color(0xFFFF8A8A))),
                  if (_info != null) Text(_info!, style: const TextStyle(color: Color(0xFFBCD4FF))),
                  const SizedBox(height: 8),
                  FilledButton(onPressed: _busy ? null : _login, child: const Text('Entrar')),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => _run(() async {
                              if (_email.text.trim().isEmpty) throw 'Escribe tu email primero.';
                              await FirebaseAuth.instance.sendPasswordResetEmail(email: _email.text.trim());
                              setState(() => _info =
                                  'Te hemos enviado un email para poner contraseña. Si entraste con Google en la web, '
                                  'así puedes crear una contraseña para la app.');
                            }),
                    child: const Text('¿No tienes contraseña o la olvidaste?'),
                  ),
                  const Divider(height: 32),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.settings_input_antenna),
                    label: const Text('Emisión manual (sin cuenta)'),
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ManualScreen())),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _login() => _run(() => FirebaseAuth.instance
      .signInWithEmailAndPassword(email: _email.text.trim(), password: _password.text));
}
