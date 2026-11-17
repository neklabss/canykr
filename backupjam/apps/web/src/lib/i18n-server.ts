import 'server-only';
import { notFound } from 'next/navigation';
import { createTranslator, getMessages, getLocaleInfo, isRtl } from '@backupjam/i18n';

/** Validates the [locale] segment; unknown locales 404 (the middleware redirects bare paths). */
export function requireLocale(raw: string): string {
  const info = getLocaleInfo(raw);
  if (!info || info.tag !== raw) notFound();
  return info.tag;
}

export function serverI18n(locale: string) {
  return { t: createTranslator(locale), messages: getMessages(locale), dir: isRtl(locale) ? ('rtl' as const) : ('ltr' as const) };
}
