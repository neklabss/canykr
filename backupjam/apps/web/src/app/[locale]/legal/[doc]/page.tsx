import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LOCALES } from '@backupjam/i18n/negotiation';
import { requireLocale, serverI18n } from '@/lib/i18n-server';
import { alternates } from '@/lib/site';

const DOCS = { privacy: 'legal.privacy', terms: 'legal.terms', guidelines: 'legal.guidelines' } as const;
type Doc = keyof typeof DOCS;
type Params = { params: Promise<{ locale: string; doc: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.flatMap((l) => Object.keys(DOCS).map((doc) => ({ locale: l.tag, doc })));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await params;
  const locale = requireLocale(p.locale);
  const key = DOCS[p.doc as Doc];
  if (!key) notFound();
  return { title: serverI18n(locale).t(key), alternates: alternates(`/legal/${p.doc}`, locale) };
}

/** Legal texts are authored by counsel per country (docs/20); the master version is English. */
export default async function LegalPage({ params }: Params) {
  const p = await params;
  const locale = requireLocale(p.locale);
  const key = DOCS[p.doc as Doc];
  if (!key) notFound();
  const { t } = serverI18n(locale);
  return (
    <article className="container page">
      <h1>{t(key)}</h1>
      <p className="notice" role="note">{t('legal.draftNotice')}</p>
    </article>
  );
}
