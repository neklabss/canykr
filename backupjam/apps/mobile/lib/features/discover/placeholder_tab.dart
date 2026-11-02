import 'package:flutter/material.dart';

import '../common/state_views.dart';

/// Tabs whose features ship in later phases render a truthful empty state, never fake data.
class PlaceholderTab extends StatelessWidget {
  const PlaceholderTab({super.key, required this.title, required this.body});
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: StateView(ViewState.empty, body: body),
      );
}
