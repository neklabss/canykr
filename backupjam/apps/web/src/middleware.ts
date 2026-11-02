import { NextRequest, NextResponse } from 'next/server';
import { getLocaleInfo, negotiateLocale, parseAcceptLanguage } from '@backupjam/i18n/negotiation';

const LOCALE_COOKIE = 'buj_locale';

/**
 * Locale-prefixed URLs (/tr/musicians) keep pages crawlable per language. Bare paths redirect using:
 * manual choice (cookie) → browser Accept-Language → English.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const first = pathname.split('/')[1] ?? '';
  const info = getLocaleInfo(first);
  if (info) {
    if (info.tag !== first) {
      // Normalise case, e.g. /PT-br → /pt-BR
      const url = req.nextUrl.clone();
      url.pathname = `/${info.tag}${pathname.slice(first.length + 1)}`;
      return NextResponse.redirect(url, 308);
    }
    return NextResponse.next();
  }
  const locale = negotiateLocale({
    userPreference: req.cookies.get(LOCALE_COOKIE)?.value,
    preferred: parseAcceptLanguage(req.headers.get('accept-language')),
  });
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  url.search = search;
  const res = NextResponse.redirect(url, 307);
  res.headers.set('Vary', 'Accept-Language, Cookie');
  return res;
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
