import { IntlMessageFormat } from 'intl-messageformat';
import { MESSAGES, REGISTRY } from './generated/resources';
import { DEFAULT_LOCALE, resolveLocale } from './negotiation';

export * from './negotiation';

export function getMessages(tag: string): Record<string, string> {
  const resolved = resolveLocale(tag);
  return { ...MESSAGES[DEFAULT_LOCALE], ...MESSAGES[resolved] };
}

export type MessageKey = keyof (typeof MESSAGES)['en'] & string;
export type MessageValues = Record<string, string | number | Date>;
export type Translator = (key: string, values?: MessageValues) => string;

/** Creates a translator with English fallback per key; unknown keys return the key (visible in QA). */
export function createTranslator(tag: string): Translator {
  const locale = resolveLocale(tag);
  const cache = new Map<string, IntlMessageFormat>();
  const own = MESSAGES[locale] ?? {};
  const fallback = MESSAGES[DEFAULT_LOCALE] ?? {};
  return (key, values) => {
    const useOwn = key in own;
    const source = useOwn ? own[key] : fallback[key];
    if (source === undefined) return key;
    const cacheKey = `${useOwn ? locale : DEFAULT_LOCALE}:${key}`;
    let fmt = cache.get(cacheKey);
    if (!fmt) {
      fmt = new IntlMessageFormat(source, useOwn ? locale : DEFAULT_LOCALE);
      cache.set(cacheKey, fmt);
    }
    return String(fmt.format(values));
  };
}

/** ISO-4217 minor-unit exponent (e.g. USD 2, JPY 0, KWD 3) as reported by ICU. */
export function currencyExponent(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Formats an amount stored in minor units (bigint-safe) for display.
 * Display only: formatting/conversion never changes the settlement currency of an offer.
 */
export function formatMoney(amountMinor: bigint | number, currency: string, locale: string): string {
  const exp = currencyExponent(currency);
  const minor = BigInt(amountMinor);
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const divisor = 10n ** BigInt(exp);
  const major = abs / divisor;
  const frac = abs % divisor;
  const decimal = exp > 0 ? `${major}.${frac.toString().padStart(exp, '0')}` : `${major}`;
  const nf = new Intl.NumberFormat(resolveLocale(locale), { style: 'currency', currency });
  // Intl accepts decimal strings in modern runtimes (Node ≥ 20), avoiding float precision loss.
  return nf.format((negative ? `-${decimal}` : decimal) as unknown as number);
}

export function formatDateTime(
  date: Date,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return new Intl.DateTimeFormat(resolveLocale(locale), { ...options, timeZone }).format(date);
}

export { MESSAGES, REGISTRY };
