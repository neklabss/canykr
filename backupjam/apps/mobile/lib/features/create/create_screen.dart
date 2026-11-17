import 'package:flutter/material.dart';

import '../../design/tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';

class CreateScreen extends StatelessWidget {
  const CreateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final items = [
      (Icons.work_outline, t.createJob),
      (Icons.handshake_outlined, t.createService),
      (Icons.groups_outlined, t.createBand),
      (Icons.event_outlined, t.createEvent),
      (Icons.emoji_events_outlined, t.createChallenge),
      (Icons.storefront_outlined, t.createVenue),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(t.createTitle)),
      body: ListView.separated(
        padding: const EdgeInsets.all(BujSpace.s4),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: BujSpace.s2),
        itemBuilder: (context, i) => Card(
          child: ListTile(
            minTileHeight: 64,
            leading: Icon(items[i].$1),
            title: Text(items[i].$2),
            subtitle: Text(t.commonComingSoon),
          ),
        ),
      ),
    );
  }
}
