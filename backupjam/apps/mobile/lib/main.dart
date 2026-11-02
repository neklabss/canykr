import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/api_client.dart';
import 'core/session.dart';
import 'core/settings_controller.dart';

/// API base URL is injected at build time: flutter run --dart-define=API_URL=https://api.example.com
const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final settings = SettingsController(await SharedPreferences.getInstance());
  late final ApiClient api;
  api = ApiClient(
    baseUrl: apiUrl,
    tokens: SecureTokenStore(),
    locale: () {
      final o = settings.localeOverride;
      final d = WidgetsBinding.instance.platformDispatcher.locale;
      return (o ?? d).toLanguageTag();
    },
  );
  final session = Session(api);
  await session.restore();
  runApp(BackUpJamApp(settings: settings, session: session));
}
