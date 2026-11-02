import 'package:flutter/material.dart';

import 'tokens.g.dart';

/// Original BackUpJam theme built from shared design tokens (packages/design-tokens).
class BujTheme {
  static ThemeData dark() => _build(
        brightness: Brightness.dark,
        canvas: BujDarkColors.bgCanvas,
        surface: BujDarkColors.bgSurface,
        raised: BujDarkColors.bgRaised,
        text: BujDarkColors.textPrimary,
        textSecondary: BujDarkColors.textSecondary,
        accent: BujDarkColors.accentPrimary,
        accentText: BujDarkColors.accentText,
        onAccent: BujDarkColors.textOnAccent,
        border: BujDarkColors.borderSubtle,
        borderStrong: BujDarkColors.borderStrong,
        danger: BujDarkColors.statusDanger,
      );

  static ThemeData light() => _build(
        brightness: Brightness.light,
        canvas: BujLightColors.bgCanvas,
        surface: BujLightColors.bgSurface,
        raised: BujLightColors.bgSunken,
        text: BujLightColors.textPrimary,
        textSecondary: BujLightColors.textSecondary,
        accent: BujLightColors.accentPrimary,
        accentText: BujLightColors.accentText,
        onAccent: BujLightColors.textOnAccent,
        border: BujLightColors.borderSubtle,
        borderStrong: BujLightColors.borderStrong,
        danger: BujLightColors.statusDanger,
      );

  static ThemeData _build({
    required Brightness brightness,
    required Color canvas,
    required Color surface,
    required Color raised,
    required Color text,
    required Color textSecondary,
    required Color accent,
    required Color accentText,
    required Color onAccent,
    required Color border,
    required Color borderStrong,
    required Color danger,
  }) {
    final scheme = ColorScheme(
      brightness: brightness,
      primary: accent,
      onPrimary: onAccent,
      secondary: accentText,
      onSecondary: surface,
      error: danger,
      onError: surface,
      surface: surface,
      onSurface: text,
      surfaceContainerHighest: raised,
      outline: borderStrong,
      outlineVariant: border,
    );
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(BujRadius.full));
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: canvas,
      // Inter for Latin/Cyrillic; platform Noto fallbacks cover Arabic, Devanagari and CJK.
      fontFamilyFallback: const ['Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC'],
      materialTapTargetSize: MaterialTapTargetSize.padded,
      appBarTheme: AppBarTheme(backgroundColor: canvas, foregroundColor: text, elevation: 0, centerTitle: false),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(BujRadius.md), side: BorderSide(color: border)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: onAccent,
          minimumSize: const Size(88, BujSize.buttonHeight),
          shape: shape,
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: text,
          minimumSize: const Size(88, BujSize.buttonHeight),
          side: BorderSide(color: borderStrong),
          shape: shape,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(BujRadius.sm), borderSide: BorderSide(color: borderStrong)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(BujRadius.sm), borderSide: BorderSide(color: borderStrong)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(BujRadius.sm), borderSide: BorderSide(color: accentText, width: 2)),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: accent,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? onAccent : textSecondary)),
        labelTextStyle: WidgetStateProperty.all(TextStyle(fontSize: 12, color: text, fontWeight: FontWeight.w600)),
      ),
      textTheme: TextTheme(
        headlineLarge: TextStyle(fontSize: 32, height: 40 / 32, fontWeight: FontWeight.w700, color: text, letterSpacing: -0.25),
        headlineSmall: TextStyle(fontSize: 24, height: 32 / 24, fontWeight: FontWeight.w600, color: text),
        titleMedium: TextStyle(fontSize: 17, height: 24 / 17, fontWeight: FontWeight.w600, color: text),
        bodyLarge: TextStyle(fontSize: 17, height: 26 / 17, color: text),
        bodyMedium: TextStyle(fontSize: 15, height: 22 / 15, color: textSecondary),
      ),
    );
  }
}
