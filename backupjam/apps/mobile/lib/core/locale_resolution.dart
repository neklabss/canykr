import 'dart:ui';

/// Mirrors packages/i18n `negotiateLocale`: manual override → device preferences → English.
/// Script/region aware: zh-TW/HK/MO → zh-Hant, other zh → zh-Hans, pt-* → pt-BR.
Locale resolveAppLocale({
  required List<Locale> supported,
  Locale? override,
  List<Locale>? devicePreferred,
}) {
  for (final candidate in [?override, ...?devicePreferred]) {
    final match = matchLocale(candidate, supported);
    if (match != null) return match;
  }
  return const Locale('en');
}

const _hantRegions = {'TW', 'HK', 'MO'};

Locale? matchLocale(Locale requested, List<Locale> supported) {
  bool same(Locale a, Locale b) =>
      a.languageCode == b.languageCode && a.scriptCode == b.scriptCode && a.countryCode == b.countryCode;

  final exact = supported.where((s) => same(s, requested));
  if (exact.isNotEmpty) return exact.first;

  final lang = requested.languageCode.toLowerCase();
  if (lang == 'zh') {
    final hant = requested.scriptCode == 'Hant' ||
        (requested.scriptCode == null && _hantRegions.contains(requested.countryCode));
    final script = hant ? 'Hant' : 'Hans';
    final z = supported.where((s) => s.languageCode == 'zh' && s.scriptCode == script);
    if (z.isNotEmpty) return z.first;
  }
  final sameLang = supported.where((s) => s.languageCode == lang).toList();
  if (sameLang.isEmpty) return null;
  final withRegion = sameLang.where((s) => s.countryCode != null && s.countryCode == requested.countryCode);
  if (withRegion.isNotEmpty) return withRegion.first;
  // Prefer the most specific supported variant (pt → pt_BR, zh → zh_Hans) over bare fallback files.
  final specific = sameLang.where((s) => s.countryCode != null || s.scriptCode != null);
  return specific.isNotEmpty ? specific.first : sameLang.first;
}

/// Locales exposed in the language picker (bare `pt` / `zh` ARB files are only gen_l10n fallbacks).
List<Locale> pickerLocales(List<Locale> supported) => supported
    .where((l) => !((l.languageCode == 'pt' || l.languageCode == 'zh') && l.countryCode == null && l.scriptCode == null))
    .toList();

bool isRtl(Locale l) => const {'ar', 'he', 'fa', 'ur'}.contains(l.languageCode);

String localeTag(Locale l) => [l.languageCode, if (l.scriptCode != null) l.scriptCode, if (l.countryCode != null) l.countryCode].join('-');
