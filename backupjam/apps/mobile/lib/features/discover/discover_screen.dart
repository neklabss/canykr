import 'package:flutter/material.dart';

import '../../design/tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';

class DiscoverScreen extends StatelessWidget {
  const DiscoverScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final sections = [
      (Icons.music_note, t.navMusicians, t.onboardingInstruments),
      (Icons.groups, t.navBands, t.createBand),
      (Icons.storefront, t.navVenues, t.createVenue),
      (Icons.event, t.navEvents, t.createEvent),
      (Icons.emoji_events, t.navChallenges, t.createChallenge),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(t.appName, style: const TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(
        padding: const EdgeInsets.all(BujSpace.s4),
        children: [
          Text(t.landingHeroTitle, style: theme.textTheme.headlineLarge),
          const SizedBox(height: BujSpace.s3),
          Text(t.landingHeroBody, style: theme.textTheme.bodyLarge?.copyWith(color: theme.textTheme.bodyMedium?.color)),
          const SizedBox(height: BujSpace.s6),
          Wrap(spacing: BujSpace.s3, runSpacing: BujSpace.s3, children: [
            FilledButton(onPressed: () {}, child: Text(t.landingCtaFindMusicians)),
            OutlinedButton(onPressed: () {}, child: Text(t.landingCtaFindGigs)),
          ]),
          const SizedBox(height: BujSpace.s8),
          for (final (icon, title, subtitle) in sections)
            Card(
              margin: const EdgeInsets.only(bottom: BujSpace.s3),
              child: ListTile(
                minTileHeight: 64,
                leading: Icon(icon, color: theme.colorScheme.secondary),
                title: Text(title, style: theme.textTheme.titleMedium),
                subtitle: Text(subtitle),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t.commonComingSoon))),
              ),
            ),
        ],
      ),
    );
  }
}
