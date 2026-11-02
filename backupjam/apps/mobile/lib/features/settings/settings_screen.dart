import 'package:flutter/material.dart';

import '../../core/locale_resolution.dart';
import '../../core/session.dart';
import '../../design/tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';

/// Native names come from the shared registry (packages/i18n/locales/_registry.json).
const nativeNames = {
  'en': 'English', 'tr': 'Türkçe', 'es': 'Español', 'pt-BR': 'Português (Brasil)', 'fr': 'Français', 'de': 'Deutsch',
  'it': 'Italiano', 'ar': 'العربية', 'ru': 'Русский', 'uk': 'Українська', 'hi': 'हिन्दी', 'id': 'Bahasa Indonesia',
  'ja': '日本語', 'ko': '한국어', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文',
};

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final scope = AppScope.of(context);
    final settings = scope.settings;
    final current = settings.localeOverride == null ? null : localeTag(settings.localeOverride!);
    final options = pickerLocales(AppLocalizations.supportedLocales).map(localeTag).toList();

    Future<void> choose(String? tag) async {
      await settings.setLocaleOverride(tag);
      if (scope.session.signedIn) {
        try {
          await scope.session.api.setLocalePreference(tag); // follow the account across devices
        } catch (_) {}
      }
    }

    return Scaffold(
      appBar: AppBar(title: Text(t.navSettings)),
      body: ListView(padding: const EdgeInsets.symmetric(vertical: BujSpace.s2), children: [
        Padding(padding: const EdgeInsets.all(BujSpace.s4), child: Text(t.settingsLanguage, style: Theme.of(context).textTheme.titleMedium)),
        RadioGroup<String?>(
          groupValue: current,
          onChanged: choose,
          child: Column(children: [
            RadioListTile<String?>(value: null, title: Text(t.settingsLanguageAuto)),
            for (final tag in options)
              RadioListTile<String?>(value: tag, title: Text(nativeNames[tag] ?? tag), subtitle: Text(tag)),
          ]),
        ),
        const Divider(),
        Padding(padding: const EdgeInsets.all(BujSpace.s4), child: Text(t.settingsTheme, style: Theme.of(context).textTheme.titleMedium)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: BujSpace.s4),
          child: SegmentedButton<ThemeMode>(
            segments: [
              ButtonSegment(value: ThemeMode.system, label: Text(t.settingsThemeSystem)),
              ButtonSegment(value: ThemeMode.light, label: Text(t.settingsThemeLight)),
              ButtonSegment(value: ThemeMode.dark, label: Text(t.settingsThemeDark)),
            ],
            selected: {settings.themeMode},
            onSelectionChanged: (s) => settings.setThemeMode(s.first),
          ),
        ),
      ]),
    );
  }
}
