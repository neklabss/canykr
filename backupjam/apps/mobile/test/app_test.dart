import 'package:backupjam/app.dart';
import 'package:backupjam/core/api_client.dart';
import 'package:backupjam/core/session.dart';
import 'package:backupjam/core/settings_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<SettingsController> settings([Map<String, Object> values = const {}]) async {
  SharedPreferences.setMockInitialValues(values);
  return SettingsController(await SharedPreferences.getInstance());
}

Session session() => Session(ApiClient(baseUrl: 'http://localhost:0', tokens: MemoryTokenStore(), locale: () => 'en'));

Future<void> pumpApp(WidgetTester tester, {required List<Locale> device, Map<String, Object> prefs = const {}, Size size = const Size(390, 844)}) async {
  tester.view.physicalSize = size * tester.view.devicePixelRatio;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(BackUpJamApp(settings: await settings(prefs), session: session(), deviceLocalesOverride: device));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('English: five primary tabs render', (tester) async {
    await pumpApp(tester, device: const [Locale('en', 'US')]);
    for (final label in ['Discover', 'Jobs', 'Create', 'Messages', 'Profile']) {
      expect(find.text(label), findsWidgets);
    }
    expect(find.text('The stage is set. Find who plays next.'), findsOneWidget);
  });

  testWidgets('Turkish device language is detected automatically', (tester) async {
    await pumpApp(tester, device: const [Locale('tr', 'TR')]);
    expect(find.text('Keşfet'), findsWidgets);
    expect(find.text('Sahne hazır. Sıradaki kim çalacak, bul.'), findsOneWidget);
  });

  testWidgets('Arabic renders right-to-left', (tester) async {
    await pumpApp(tester, device: const [Locale('ar', 'EG')]);
    final dir = Directionality.of(tester.element(find.text('استكشاف').first));
    expect(dir, TextDirection.rtl);
  });

  testWidgets('saved manual language overrides the device language', (tester) async {
    await pumpApp(tester, device: const [Locale('de', 'DE')], prefs: {'buj.locale': 'ja'});
    expect(find.text('見つける'), findsWidgets);
  });

  testWidgets('long German strings fit a 320pt-wide phone without overflow', (tester) async {
    await pumpApp(tester, device: const [Locale('de', 'DE')], size: const Size(320, 640));
    await tester.tap(find.text('Erstellen').last);
    await tester.pumpAndSettle();
    expect(find.text('Was möchtest du erstellen?'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('empty states are truthful (no fake data) on Jobs', (tester) async {
    await pumpApp(tester, device: const [Locale('en')]);
    await tester.tap(find.text('Jobs').last);
    await tester.pumpAndSettle();
    expect(find.text('This section opens in an upcoming release.'), findsOneWidget);
  });

  testWidgets('language can be changed manually from settings', (tester) async {
    await pumpApp(tester, device: const [Locale('en')]);
    await tester.tap(find.text('Profile').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Settings'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Español'), 200);
    await tester.tap(find.text('Español'));
    await tester.pumpAndSettle();
    expect(find.text('Ajustes'), findsOneWidget);
  });
}
