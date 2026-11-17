import 'package:backupjam/core/locale_resolution.dart';
import 'package:backupjam/l10n/gen/app_localizations.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final supported = AppLocalizations.supportedLocales;
  String tag(Locale l) => localeTag(l);
  Locale resolve(List<Locale> device, [Locale? override]) =>
      resolveAppLocale(supported: supported, devicePreferred: device, override: override);

  test('all 16 launch locales are generated', () {
    expect(pickerLocales(supported).map(tag).toSet(), {
      'en', 'tr', 'es', 'pt-BR', 'fr', 'de', 'it', 'ar', 'ru', 'uk', 'hi', 'id', 'ja', 'ko', 'zh-Hans', 'zh-Hant',
    });
  });

  test('matches device locales like the web/API negotiator', () {
    expect(tag(resolve([const Locale('tr', 'TR')])), 'tr');
    expect(tag(resolve([const Locale('pt', 'PT')])), 'pt-BR');
    expect(tag(resolve([const Locale('zh', 'TW')])), 'zh-Hant');
    expect(tag(resolve([const Locale('zh', 'CN')])), 'zh-Hans');
    expect(tag(resolve([const Locale.fromSubtags(languageCode: 'zh', scriptCode: 'Hant', countryCode: 'CN')])), 'zh-Hant');
    expect(tag(resolve([const Locale('de', 'AT')])), 'de');
  });

  test('falls back through the device list, then to English', () {
    expect(tag(resolve([const Locale('sw'), const Locale('ja', 'JP')])), 'ja');
    expect(tag(resolve([const Locale('sw'), const Locale('xh')])), 'en');
  });

  test('manual override wins over the device language', () {
    expect(tag(resolve([const Locale('de', 'DE')], const Locale('tr'))), 'tr');
  });

  test('RTL detection', () {
    expect(isRtl(const Locale('ar')), isTrue);
    expect(isRtl(const Locale('en')), isFalse);
  });
}
