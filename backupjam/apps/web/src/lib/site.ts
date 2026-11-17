import { DEFAULT_LOCALE, LOCALES } from '@backupjam/i18n/negotiation';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const LOCALE_TAGS = LOCALES.map((l) => l.tag);
export const LOCALE_COOKIE = 'buj_locale';

/** Public, indexable routes (also used for the sitemap). Private routes are excluded and marked noindex. */
export const PUBLIC_PATHS = ['', '/musicians', '/bands', '/venues', '/jobs', '/events', '/challenges', '/legal/privacy', '/legal/terms', '/legal/guidelines', '/help', '/contact'] as const;

/** hreflang alternates for a locale-less path, including x-default → English. */
export function alternates(path: string, locale: string) {
  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages: {
      ...Object.fromEntries(LOCALE_TAGS.map((l) => [l, `${SITE_URL}/${l}${path}`])),
      'x-default': `${SITE_URL}/${DEFAULT_LOCALE}${path}`,
    },
  };
}
