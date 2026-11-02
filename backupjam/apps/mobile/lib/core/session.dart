import 'package:flutter/widgets.dart';

import 'api_client.dart';
import 'settings_controller.dart';

/// Signed-in account state.
class Session extends ChangeNotifier {
  Session(this.api);
  final ApiClient api;
  Map<String, dynamic>? user;

  bool get signedIn => user != null;

  Future<void> restore() async {
    if (await api.tokens.read() == null) return;
    try {
      user = await api.me();
    } catch (_) {
      user = null;
    }
    notifyListeners();
  }

  Future<void> signIn(String email, String password) async {
    user = await api.login(email, password);
    notifyListeners();
  }

  Future<void> signUp(String email, String password, String name, bool acceptTerms) async {
    user = await api.register(email: email, password: password, displayName: name, acceptTerms: acceptTerms);
    notifyListeners();
  }

  Future<void> signOut() async {
    await api.logout();
    user = null;
    notifyListeners();
  }
}

/// Dependency scope for the widget tree.
class AppScope extends InheritedWidget {
  const AppScope({super.key, required this.settings, required this.session, required super.child});
  final SettingsController settings;
  final Session session;

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;

  @override
  bool updateShouldNotify(AppScope old) => settings != old.settings || session != old.session;
}
