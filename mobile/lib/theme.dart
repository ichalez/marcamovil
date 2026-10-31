import 'package:flutter/material.dart';

const kBg = Color(0xFF0B1220);
const kCard = Color(0xFF152036);
const kAccent = Color(0xFFFFD400);
const kLive = Color(0xFFE11D2A);

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: const Color(0xFF3B82F6),
    brightness: Brightness.dark,
    surface: kBg,
  );
  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: kBg,
    useMaterial3: true,
    appBarTheme: const AppBarTheme(backgroundColor: kBg, centerTitle: false),
    cardTheme: CardThemeData(
      color: kCard,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF111A2C),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
    ),
  );
}
