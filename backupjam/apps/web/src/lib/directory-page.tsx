import type { Metadata } from 'next';
import { EmptyState } from '@/components/site-chrome';
import { requireLocale, serverI18n } from '@/lib/i18n-server';
import { alternates } from '@/lib/site';

type Params = { params: Promise<{ locale: string }> };

/**
 * Server-rendered, indexable directory shell. Listings + filters (geo radius, instrument, genre,
 * budget, availability, verification) arrive with the Phase 2 search API; until then the page
 * renders a truthful "coming soon" state instead of placeholder data.
 */
export function directoryPage(titleKey: string, path: string) {
  async function generateMetadata({ params }: Params): Promise<Metadata> {
    const locale = requireLocale((await params).locale);
    const { t } = serverI18n(locale);
    return { title: t(titleKey), alternates: alternates(path, locale) };
  }
  async function Page({ params }: Params) {
    const locale = requireLocale((await params).locale);
    const { t } = serverI18n(locale);
    return (
      <div className="container page">
        <h1>{t(titleKey)}</h1>
        <EmptyState title={t('states.emptyTitle')} body={t('common.comingSoon')} />
      </div>
    );
  }
  return { generateMetadata, Page };
}
