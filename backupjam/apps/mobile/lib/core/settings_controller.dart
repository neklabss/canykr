import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Device-local UI preferences. When signed in, the same values are synced to
/// PUT /v1/me/preferences so the manual language choice follows the account across devices.
class SettingsController extends ChangeNotifier {
  SettingsController(this._prefs);
  final SharedPreferences _prefs;

  static const _kLocale = 'buj.locale';
  static const _kTheme = 'buj.theme';

  /// null = follow the device language automatically.
  Locale? get localeOverride {
    final tag = _prefs.getString(_kLocale);
    if (tag == null) return null;
    final parts = tag.split('-');
    final script = parts.length > 1 && parts[1].length == 4 ? parts[1] : null;
    final country = parts.length > 1 && parts.last.length == 2 ? parts.last : null;
    return Locale.fromSubtags(languageCode: parts.first, scriptCode: script, countryCode: country);
  }

  ThemeMode get themeMode => switch (_prefs.getString(_kTheme)) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };

  Future<void> setLocaleOverride(String? tag) async {
    tag == null ? await _prefs.remove(_kLocale) : await _prefs.setString(_kLocale, tag);
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    await _prefs.setString(_kTheme, mode.name);
    notifyListeners();
  }
}
