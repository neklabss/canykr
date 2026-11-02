import { describe, expect, it } from 'vitest';
import {
  createTranslator, formatMoney, isRtl, matchLocale, negotiateLocale, parseAcceptLanguage, currencyExponent, formatDateTime,
} from '../src';

describe('locale negotiation', () => {
  it.each([
    ['en-US', 'en'], ['tr-TR', 'tr'], ['de-AT', 'de'], ['pt-BR', 'pt-BR'], ['pt-PT', 'pt-BR'], ['pt', 'pt-BR'],
    ['zh-CN', 'zh-Hans'], ['zh-SG', 'zh-Hans'], ['zh', 'zh-Hans'], ['zh-TW', 'zh-Hant'], ['zh-HK', 'zh-Hant'],
    ['zh-Hant-CN', 'zh-Hant'], ['zh_Hans', 'zh-Hans'], ['ar-EG', 'ar'], ['uk-UA', 'uk'], ['ja-JP', 'ja'], ['ko-KR', 'ko'],
    ['hi-IN', 'hi'], ['id-ID', 'id'], ['es-419', 'es'], ['fr-CA', 'fr'],
  ])('%s → %s', (input, expected) => {
    expect(matchLocale(input)).toBe(expected);
  });

  it('returns undefined for unsupported languages', () => {
    expect(matchLocale('sw-KE')).toBeUndefined();
    expect(matchLocale('not a locale!!')).toBeUndefined();
  });

  it('falls back to English when nothing matches', () => {
    expect(negotiateLocale({ preferred: ['sw', 'xh'] })).toBe('en');
    expect(negotiateLocale({})).toBe('en');
  });

  it('manual preference beats device preference', () => {
    expect(negotiateLocale({ userPreference: 'tr', preferred: ['de-DE'] })).toBe('tr');
  });

  it('ignores an unsupported manual preference and uses device order', () => {
    expect(negotiateLocale({ userPreference: 'sw', preferred: ['xx', 'de-DE', 'tr'] })).toBe('de');
  });

  it('parses Accept-Language by quality', () => {
    expect(parseAcceptLanguage('de;q=0.5, tr-TR, en;q=0.8, *;q=0.1')).toEqual(['tr-TR', 'en', 'de', '*']);
    expect(parseAcceptLanguage('fr;q=0, ja')).toEqual(['ja']);
    expect(parseAcceptLanguage(undefined)).toEqual([]);
  });

  it('detects RTL', () => {
    expect(isRtl('ar-SA')).toBe(true);
    expect(isRtl('en')).toBe(false);
    expect(isRtl('sw')).toBe(false);
  });
});

describe('translator', () => {
  it('formats placeholders', () => {
    expect(createTranslator('tr')('auth.verifyEmailSent', { email: 'a@b.co' })).toContain('a@b.co');
  });

  it('applies plural rules per locale', () => {
    const ru = createTranslator('ru');
    expect(ru('jobs.count', { count: 1 })).toBe('1 вакансия');
    expect(ru('jobs.count', { count: 3 })).toBe('3 вакансии');
    expect(ru('jobs.count', { count: 5 })).toBe('5 вакансий');
    const ar = createTranslator('ar');
    expect(ar('jobs.count', { count: 2 })).toBe('وظيفتان');
    const en = createTranslator('en');
    expect(en('jobs.count', { count: 1 })).toBe('1 job');
    expect(en('jobs.count', { count: 1200 })).toBe('1,200 jobs');
  });

  it('returns the key for unknown messages and English for unsupported locales', () => {
    expect(createTranslator('en')('does.not.exist')).toBe('does.not.exist');
    expect(createTranslator('sw')('nav.discover')).toBe('Discover');
  });
});

describe('money & dates', () => {
  it('knows currency exponents', () => {
    expect(currencyExponent('USD')).toBe(2);
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('KWD')).toBe(3);
  });

  it('formats minor units without float drift', () => {
    expect(formatMoney(1250000n, 'TRY', 'tr')).toMatch(/12\.500,00/);
    expect(formatMoney(999_999_999_999_99n, 'USD', 'en')).toBe('$999,999,999,999.99');
    expect(formatMoney(5000, 'JPY', 'ja')).toMatch(/5,000/);
    expect(formatMoney(-150, 'EUR', 'de')).toMatch(/-1,50/);
  });

  it('formats dates in the given time zone', () => {
    const d = new Date('2026-06-01T20:00:00Z');
    expect(formatDateTime(d, 'en', 'Europe/Istanbul', { hour: 'numeric', hourCycle: 'h23' })).toBe('23');
    expect(formatDateTime(d, 'en', 'America/New_York', { hour: 'numeric', hourCycle: 'h23' })).toBe('16');
  });
});
