import Link from 'next/link';
import type { Translator } from '@backupjam/i18n';
import { AuthButton } from './auth-button';
import { LanguageSwitcher } from './language-switcher';

export function SiteHeader({ locale, t }: { locale: string; t: Translator }) {
  const nav: Array<[string, string]> = [
    ['/musicians', 'nav.musicians'], ['/bands', 'nav.bands'], ['/venues', 'nav.venues'], ['/jobs', 'nav.jobs'], ['/events', 'nav.events'], ['/challenges', 'nav.challenges'],
  ];
  return (
    <header className="header">
      <div className="container header-inner">
        <Link className="brand" href={`/${locale}`} aria-label={t('app.name')}>
          <span className="brand-mark" aria-hidden>BUJ</span>
          <span>{t('app.name')}</span>
        </Link>
        <nav className="nav" aria-label={t('nav.discover')}>
          {nav.map(([href, key]) => <Link key={href} href={`/${locale}${href}`}>{t(key)}</Link>)}
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <AuthButton />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ locale, t }: { locale: string; t: Translator }) {
  return (
    <footer className="footer">
      <div className="container">
        <nav aria-label={t('legal.terms')}>
          <Link href={`/${locale}/legal/privacy`}>{t('legal.privacy')}</Link>
          <Link href={`/${locale}/legal/terms`}>{t('legal.terms')}</Link>
          <Link href={`/${locale}/legal/guidelines`}>{t('legal.guidelines')}</Link>
          <Link href={`/${locale}/help`}>{t('help.center')}</Link>
          <Link href={`/${locale}/contact`}>{t('contact.us')}</Link>
        </nav>
        <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="state" role="status">
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}
