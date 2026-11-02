import type { Metadata, Viewport } from 'next';
import { LOCALES } from '@backupjam/i18n/negotiation';
import { I18nProvider } from '@/components/i18n-provider';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { requireLocale, serverI18n } from '@/lib/i18n-server';
import { alternates, SITE_URL } from '@/lib/site';
import '../globals.css';

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((l) => ({ locale: l.tag }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const { t } = serverI18n(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${t('app.name')} — ${t('app.tagline')}`, template: `%s · ${t('app.name')}` },
    description: t('landing.heroBody'),
    alternates: alternates('', locale),
    openGraph: { siteName: t('app.name'), locale: locale.replace('-', '_'), type: 'website' },
  };
}

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#0B0D12' }, { media: '(prefers-color-scheme: light)', color: '#F7F8FA' }],
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = requireLocale((await params).locale);
  const { t, messages, dir } = serverI18n(locale);
  return (
    <html lang={locale} dir={dir}>
      <body>
        <a className="skip-link" href="#main">{t('common.skipToContent')}</a>
        <I18nProvider locale={locale} dir={dir} messages={messages}>
          <SiteHeader locale={locale} t={t} />
          <main id="main">{children}</main>
          <SiteFooter locale={locale} t={t} />
        </I18nProvider>
      </body>
    </html>
  );
}
