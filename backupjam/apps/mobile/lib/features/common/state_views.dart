import 'package:flutter/material.dart';

import '../../design/tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';

enum ViewState { loading, empty, error, offline, permissionDenied }

/// Shared loading / empty / error / offline / permission-denied states (docs/06 §components).
class StateView extends StatelessWidget {
  const StateView(this.state, {super.key, this.onRetry, this.title, this.body});
  final ViewState state;
  final VoidCallback? onRetry;
  final String? title;
  final String? body;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    if (state == ViewState.loading) {
      return Center(child: Semantics(label: t.statesLoading, child: const CircularProgressIndicator()));
    }
    final (icon, defTitle, defBody) = switch (state) {
      ViewState.empty => (Icons.music_note_outlined, t.statesEmptyTitle, t.statesEmptyBody),
      ViewState.error => (Icons.error_outline, t.statesErrorTitle, t.statesErrorBody),
      ViewState.offline => (Icons.wifi_off_outlined, t.statesOfflineTitle, t.statesOfflineBody),
      ViewState.permissionDenied => (Icons.lock_outline, t.statesPermissionDeniedTitle, t.statesPermissionDeniedBody),
      ViewState.loading => throw StateError('unreachable'),
    };
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(BujSpace.s6),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 40, color: Theme.of(context).colorScheme.secondary),
          const SizedBox(height: BujSpace.s4),
          Text(title ?? defTitle, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: BujSpace.s2),
          Text(body ?? defBody, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
          if (onRetry != null && state != ViewState.empty) ...[
            const SizedBox(height: BujSpace.s4),
            OutlinedButton(onPressed: onRetry, child: Text(t.statesRetry)),
          ],
        ]),
      ),
    );
  }
}
