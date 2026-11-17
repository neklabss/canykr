import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';

import 'core/locale_resolution.dart';
import 'core/session.dart';
import 'core/settings_controller.dart';
import 'design/theme.dart';
import 'features/auth/auth_screens.dart';
import 'features/create/create_screen.dart';
import 'features/discover/discover_screen.dart';
import 'features/discover/placeholder_tab.dart';
import 'features/profile/profile_screen.dart';
import 'features/settings/settings_screen.dart';
import 'features/shell/shell.dart';
import 'l10n/gen/app_localizations.dart';

GoRouter buildRouter() => GoRouter(
      initialLocation: '/discover',
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, shell) => AppShell(shell: shell),
          branches: [
            StatefulShellBranch(routes: [GoRoute(path: '/discover', builder: (_, _) => const DiscoverScreen())]),
            StatefulShellBranch(routes: [
              GoRoute(path: '/jobs', builder: (c, _) => PlaceholderTab(title: AppLocalizations.of(c).navJobs, body: AppLocalizations.of(c).commonComingSoon)),
            ]),
            StatefulShellBranch(routes: [GoRoute(path: '/create', builder: (_, _) => const CreateScreen())]),
            StatefulShellBranch(routes: [
              GoRoute(path: '/messages', builder: (c, _) => PlaceholderTab(title: AppLocalizations.of(c).navMessages, body: AppLocalizations.of(c).commonComingSoon)),
            ]),
            StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen())]),
          ],
        ),
        GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
        GoRoute(path: '/sign-in', builder: (_, _) => const AuthScreen(signUp: false)),
        GoRoute(path: '/sign-up', builder: (_, _) => const AuthScreen(signUp: true)),
      ],
    );

class BackUpJamApp extends StatefulWidget {
  const BackUpJamApp({super.key, required this.settings, required this.session, this.deviceLocalesOverride});
  final SettingsController settings;
  final Session session;

  /// Tests inject device locales; production reads them from the platform.
  final List<Locale>? deviceLocalesOverride;

  @override
  State<BackUpJamApp> createState() => _BackUpJamAppState();
}

class _BackUpJamAppState extends State<BackUpJamApp> with WidgetsBindingObserver {
  late final GoRouter _router = buildRouter();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Device language changed in system settings → re-resolve (only matters when no manual override).
  @override
  void didChangeLocales(List<Locale>? locales) => setState(() {});

  /// Resolved explicitly (not via localeListResolutionCallback) so a manual change applies immediately.
  Locale _resolve() => resolveAppLocale(
        supported: AppLocalizations.supportedLocales,
        override: widget.settings.localeOverride,
        devicePreferred: widget.deviceLocalesOverride ?? WidgetsBinding.instance.platformDispatcher.locales,
      );

  @override
  Widget build(BuildContext context) {
    return AppScope(
      settings: widget.settings,
      session: widget.session,
      child: ListenableBuilder(
        listenable: widget.settings,
        builder: (context, _) => MaterialApp.router(
          onGenerateTitle: (c) => AppLocalizations.of(c).appName,
          debugShowCheckedModeBanner: false,
          theme: BujTheme.light(),
          darkTheme: BujTheme.dark(),
          themeMode: widget.settings.themeMode,
          routerConfig: _router,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          // Manual override → device preference list → English (same rules as web/API).
          locale: _resolve(),
        ),
      ),
    );
  }
}
