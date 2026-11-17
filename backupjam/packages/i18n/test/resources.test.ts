import { describe, expect, it } from 'vitest';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { DEFAULT_LOCALE, LOCALES, MESSAGES } from '../src';

const en = MESSAGES[DEFAULT_LOCALE]!;
const enKeys = Object.keys(en).sort();

function args(els: MessageFormatElement[], out = new Set<string>()): Set<string> {
  for (const el of els) {
    if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) out.add(el.value);
    if (el.type === TYPE.plural || el.type === TYPE.select) {
      out.add(el.value);
      Object.values(el.options).forEach((o) => args(o.value, out));
    }
  }
  return out;
}

function plurals(els: MessageFormatElement[]): { name: string; options: string[] }[] {
  return els.flatMap((el) =>
    el.type === TYPE.plural ? [{ name: el.value, options: Object.keys(el.options) }] : [],
  );
}

/** Categories a locale actually uses for realistic integer counts (0–10,000). */
function requiredCategories(tag: string): Set<string> {
  const pr = new Intl.PluralRules(tag);
  const s = new Set<string>();
  for (let n = 0; n <= 10_000; n++) s.add(pr.select(n));
  return s;
}

describe('locale resources', () => {
  it('registry lists every launch locale exactly once', () => {
    const tags = LOCALES.map((l) => l.tag);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags).toEqual(
      expect.arrayContaining(['en', 'tr', 'es', 'pt-BR', 'fr', 'de', 'it', 'ar', 'ru', 'uk', 'hi', 'id', 'ja', 'ko', 'zh-Hans', 'zh-Hant']),
    );
  });

  it('only Arabic is RTL among launch locales', () => {
    expect(LOCALES.filter((l) => l.dir === 'rtl').map((l) => l.tag)).toEqual(['ar']);
  });

  describe.each(LOCALES.map((l) => l.tag))('%s', (tag) => {
    const msgs = MESSAGES[tag]!;

    it('has exactly the same keys as English (complete, no orphans)', () => {
      expect(Object.keys(msgs).sort()).toEqual(enKeys);
    });

    it('has no empty values', () => {
      for (const [k, v] of Object.entries(msgs)) expect(v.trim(), k).not.toBe('');
    });

    it('every message is valid ICU and uses the same arguments as English', () => {
      for (const key of enKeys) {
        const ast = parse(msgs[key]!);
        expect([...args(ast)].sort(), `${tag}:${key}`).toEqual([...args(parse(en[key]!))].sort());
      }
    });

    it('plural messages cover all CLDR categories used by this locale and include "other"', () => {
      const required = requiredCategories(tag);
      for (const key of enKeys) {
        for (const p of plurals(parse(msgs[key]!))) {
          expect(p.options, `${tag}:${key}`).toContain('other');
          for (const cat of required) expect(p.options, `${tag}:${key} missing "${cat}"`).toContain(cat);
        }
      }
    });
  });
});
