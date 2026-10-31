import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Configuración que se pasa al compilar con `--dart-define-from-file=config.json`.
/// Ver `mobile/config.example.json` y `docs/SETUP.md`.
class AppConfig {
  static const firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const firebaseMessagingSenderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const firebaseStorageBucket = String.fromEnvironment('FIREBASE_STORAGE_BUCKET');
  static const firebaseAndroidAppId = String.fromEnvironment('FIREBASE_ANDROID_APP_ID');
  static const firebaseIosAppId = String.fromEnvironment('FIREBASE_IOS_APP_ID');
  static const firebaseIosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID', defaultValue: 'com.marcamovil.marcamovil');

  /// URL pública de la web (donde está /overlay/:id). Por defecto, el hosting de Firebase.
  static const webUrlDefine = String.fromEnvironment('WEB_URL');

  static String get defaultWebUrl {
    if (webUrlDefine.isNotEmpty) return webUrlDefine;
    if (firebaseProjectId.isNotEmpty) return 'https://$firebaseProjectId.web.app';
    return '';
  }

  static String get _appId =>
      defaultTargetPlatform == TargetPlatform.iOS ? firebaseIosAppId : firebaseAndroidAppId;

  static bool get firebaseConfigured => firebaseApiKey.isNotEmpty && firebaseProjectId.isNotEmpty && _appId.isNotEmpty;

  static FirebaseOptions get firebaseOptions => FirebaseOptions(
        apiKey: firebaseApiKey,
        appId: _appId,
        messagingSenderId: firebaseMessagingSenderId,
        projectId: firebaseProjectId,
        storageBucket: firebaseStorageBucket.isEmpty ? null : firebaseStorageBucket,
        iosBundleId: firebaseIosBundleId,
      );
}
