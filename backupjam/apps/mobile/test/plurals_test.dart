import 'package:backupjam/l10n/gen/app_localizations.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

/// Guards the ARB export: ICU '#' must be rewritten so Flutter prints the number.
void main() {
  Future<AppLocalizations> load(Locale l) => AppLocalizations.delegate.load(l);

  test('English plural with grouping', () async {
    final t = await load(const Locale('en'));
    expect(t.jobsCount(1), '1 job');
    expect(t.jobsCount(1200), '1,200 jobs');
  });

  test('Russian one/few/many', () async {
    final t = await load(const Locale('ru'));
    expect(t.jobsCount(1), '1 вакансия');
    expect(t.jobsCount(3), '3 вакансии');
    expect(t.jobsCount(5), '5 вакансий');
  });

  test('Arabic dual and Japanese "other"-only', () async {
    expect((await load(const Locale('ar'))).jobsCount(2), 'وظيفتان');
    expect((await load(const Locale('ja'))).messagesUnread(4), '未読メッセージ4件');
  });

  test('placeholders are substituted', () async {
    final t = await load(const Locale('tr'));
    expect(t.authVerifyEmailSent('a@b.co'), 'a@b.co adresine bir doğrulama bağlantısı gönderdik.');
    expect(t.footerCopyright('2026'), '© 2026 BackUpJam. Tüm hakları saklıdır.');
  });
}
