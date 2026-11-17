'use client';
import { useEffect, useMemo, useState } from 'react';
import { IntlMessageFormat } from 'intl-messageformat';
import { negotiateLocale } from '@backupjam/i18n/negotiation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Loads the localized catalog from the API (single source of truth) for the staff member's browser language. */
export function useAdminI18n(preferred?: string | null) {
  const [state, setState] = useState<{ locale: string; dir: 'ltr' | 'rtl'; messages: Record<string, string> } | null>(null);
  useEffect(() => {
    const locale = negotiateLocale({ userPreference: preferred, preferred: typeof navigator !== 'undefined' ? navigator.languages : [] });
    fetch(`${API}/v1/i18n/messages/${encodeURIComponent(locale)}`)
      .then((r) => r.json())
      .then((b) => {
        setState(b);
        document.documentElement.lang = b.locale;
        document.documentElement.dir = b.dir;
      })
      .catch(() => setState({ locale: 'en', dir: 'ltr', messages: {} }));
  }, [preferred]);
  return useMemo(() => {
    const cache = new Map<string, IntlMessageFormat>();
    const t = (key: string, values?: Record<string, string | number>) => {
      const src = state?.messages[key];
      if (src === undefined) return key;
      let f = cache.get(key);
      if (!f) { f = new IntlMessageFormat(src, state!.locale); cache.set(key, f); }
      return String(f.format(values));
    };
    return { ready: state !== null, locale: state?.locale ?? 'en', t };
  }, [state]);
}
