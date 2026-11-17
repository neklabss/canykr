import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/session.dart';
import '../../design/tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final session = AppScope.of(context).session;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) => Scaffold(
        appBar: AppBar(title: Text(t.navProfile), actions: [
          IconButton(tooltip: t.navSettings, icon: const Icon(Icons.settings_outlined), onPressed: () => context.push('/settings')),
        ]),
        body: ListView(padding: const EdgeInsets.all(BujSpace.s4), children: [
          if (session.signedIn) ...[
            Text(t.dashboardWelcome(session.user!['displayName'] as String), style: Theme.of(context).textTheme.headlineSmall),
            if (session.user!['emailVerified'] != true) ...[
              const SizedBox(height: BujSpace.s3),
              Card(child: Padding(padding: const EdgeInsets.all(BujSpace.s4), child: Text(t.dashboardVerifyEmailBanner))),
            ],
            const SizedBox(height: BujSpace.s6),
            OutlinedButton(onPressed: session.signOut, child: Text(t.authSignOut)),
          ] else ...[
            Text(t.appTagline, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: BujSpace.s6),
            FilledButton(onPressed: () => context.push('/sign-in'), child: Text(t.authSignIn)),
            const SizedBox(height: BujSpace.s3),
            OutlinedButton(onPressed: () => context.push('/sign-up'), child: Text(t.authSignUp)),
          ],
        ]),
      ),
    );
  }
}
