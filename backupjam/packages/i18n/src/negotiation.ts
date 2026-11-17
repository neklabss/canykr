import { REGISTRY } from './generated/registry';

export type TextDirection = 'ltr' | 'rtl';
export type LocaleStatus = 'reviewed' | 'machine_draft';

export interface LocaleInfo {
  tag: string;
  name: string;
  nativeName: string;
  dir: TextDirection;
  status: LocaleStatus;
  flutter: string;
}

export const DEFAULT_LOCALE: string = REGISTRY.defaultLocale;
export const LOCALES: readonly LocaleInfo[] = REGISTRY.locales as unknown as LocaleInfo[];
export const SUPPORTED_LOCALE_TAGS: readonly string[] = LOCALES.map((l) => l.tag);

const byLower = new Map(LOCALES.map((l) => [l.tag.toLowerCase(), l]));

/** Region/script aliases → best available supported locale. Data-driven so new locales need no code. */
const ZH_HANT_REGIONS = new Set(['tw', 'hk', 'mo']);

export function getLocaleInfo(tag: string): LocaleInfo | undefined {
  return byLower.get(tag.toLowerCase());
}

export function isRtl(tag: string): boolean {
  return (getLocaleInfo(resolveLocale(tag)) ?? getLocaleInfo(DEFAULT_LOCALE)!).dir === 'rtl';
}

/**
 * Resolves one BCP-47 tag to the best supported locale, or undefined if no reasonable match.
 * Order: exact → Chinese script inference → language + same script → language only.
 */
export function matchLocale(requested: string): string | undefined {
  const raw = requested.trim().replace(/_/g, '-');
  if (!raw || raw === '*') return undefined;
  const exact = byLower.get(raw.toLowerCase());
  if (exact) return exact.tag;

  let canonical: Intl.Locale;
  try {
    canonical = new Intl.Locale(raw);
  } catch {
    return undefined;
  }
  const lang = canonical.language.toLowerCase();
  const script = canonical.script?.toLowerCase();
  const region = canonical.region?.toLowerCase();

  if (lang === 'zh') {
    const hant = script === 'hant' || (!script && region !== undefined && ZH_HANT_REGIONS.has(region));
    const target = byLower.get(hant ? 'zh-hant' : 'zh-hans');
    if (target) return target.tag;
  }
  const withRegion = region ? byLower.get(`${lang}-${region}`) : undefined;
  if (withRegion) return withRegion.tag;
  const sameLang = LOCALES.filter((l) => new Intl.Locale(l.tag).language === lang);
  if (sameLang.length === 0) return undefined;
  if (script) {
    const scripted = sameLang.find((l) => new Intl.Locale(l.tag).script?.toLowerCase() === script);
    if (scripted) return scripted.tag;
  }
  return (sameLang.find((l) => l.tag.toLowerCase() === lang) ?? sameLang[0]!).tag;
}

/** Parses an HTTP Accept-Language header into tags ordered by quality (stable for equal q). */
export function parseAcceptLanguage(header: string | undefined | null): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: (tag ?? '').trim(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((x) => x.tag && x.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((x) => x.tag);
}

export interface NegotiationInput {
  /** Explicit user choice persisted on the account (wins when supported). */
  userPreference?: string | null;
  /** Ordered device / browser preferences (e.g. navigator.languages or parsed Accept-Language). */
  preferred?: readonly string[];
}

/** Manual preference → device preferences → English. Always returns a supported tag. */
export function negotiateLocale(input: NegotiationInput): string {
  if (input.userPreference) {
    const m = matchLocale(input.userPreference);
    if (m) return m;
  }
  for (const p of input.preferred ?? []) {
    const m = matchLocale(p);
    if (m) return m;
  }
  return DEFAULT_LOCALE;
}

export function resolveLocale(tag: string | undefined | null): string {
  return (tag && matchLocale(tag)) || DEFAULT_LOCALE;
}

