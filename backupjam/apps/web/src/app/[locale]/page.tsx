import Link from 'next/link';
import { requireLocale, serverI18n } from '@/lib/i18n-server';
import { SITE_URL } from '@/lib/site';

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const locale = requireLocale((await params).locale);
  const { t } = serverI18n(locale);
  const sections: Array<[string, string, string]> = [
    ['/musicians', 'nav.musicians', 'onboarding.instruments'],
    ['/bands', 'nav.bands', 'create.band'],
    ['/venues', 'nav.venues', 'create.venue'],
    ['/jobs', 'nav.jobs', 'create.job'],
    ['/events', 'nav.events', 'create.event'],
    ['/challenges', 'nav.challenges', 'create.challenge'],
  ];
  const jsonLd = { '@context': 'https://schema.org', '@type': 'WebSite', name: t('app.name'), url: `${SITE_URL}/${locale}`, inLanguage: locale, description: t('landing.heroBody') };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <section className="container hero">
        <div className="eq" aria-hidden><span /><span /><span /><span /><span /></div>
        <h1>{t('landing.heroTitle')}</h1>
        <p>{t('landing.heroBody')}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href={`/${locale}/musicians`}>{t('landing.ctaFindMusicians')}</Link>
          <Link className="btn btn-secondary" href={`/${locale}/jobs`}>{t('landing.ctaFindGigs')}</Link>
        </div>
      </section>
      <section className="container" aria-labelledby="discover-heading" style={{ paddingBottom: 64 }}>
        <h2 id="discover-heading" style={{ fontSize: 24 }}>{t('nav.discover')}</h2>
        <div className="grid">
          {sections.map(([href, title, body]) => (
            <Link key={href} href={`/${locale}${href}`} className="card stretched">
              <h3>{t(title)}</h3>
              <p>{t(body)}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
