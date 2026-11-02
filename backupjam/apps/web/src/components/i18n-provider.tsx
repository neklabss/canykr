'use client';
import { createContext, useContext, useMemo } from 'react';
import { IntlMessageFormat } from 'intl-messageformat';

interface I18nValue {
  locale: string;
  dir: 'ltr' | 'rtl';
  t: (key: string, values?: Record<string, string | number>) => string;
}
const Ctx = createContext<I18nValue | null>(null);

/** Client-side translator over the (already merged) catalog sent by the server — no locale bundles shipped. */
export function I18nProvider({ locale, dir, messages, children }: { locale: string; dir: 'ltr' | 'rtl'; messages: Record<string, string>; children: React.ReactNode }) {
  const value = useMemo<I18nValue>(() => {
    const cache = new Map<string, IntlMessageFormat>();
    return {
      locale,
      dir,
      t: (key, values) => {
        const src = messages[key];
        if (src === undefined) return key;
        let f = cache.get(key);
        if (!f) { f = new IntlMessageFormat(src, locale); cache.set(key, f); }
        return String(f.format(values));
      },
    };
  }, [locale, dir, messages]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}
