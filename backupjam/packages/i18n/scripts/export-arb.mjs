// Exports the shared ICU JSON resources to Flutter ARB files (apps/mobile/lib/l10n/app_<locale>.arb).
// Dotted keys become lowerCamelCase identifiers: "nav.discover" -> "navDiscover".
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '../../apps/mobile/lib/l10n');
const registry = JSON.parse(readFileSync(join(root, 'locales/_registry.json'), 'utf8'));
const toId = (k) => k.split('.').map((p, i) => (i === 0 ? p : p[0].toUpperCase() + p.slice(1))).join('');

function placeholders(msg) {
  const found = {};
  const walk = (els) => {
    for (const el of els) {
      if (el.type === TYPE.argument) found[el.value] ??= { type: 'String' };
      if (el.type === TYPE.plural) { found[el.value] = { type: 'int', format: 'decimalPattern' }; Object.values(el.options).forEach((o) => walk(o.value)); }
      if (el.type === TYPE.select) { found[el.value] ??= { type: 'String' }; Object.values(el.options).forEach((o) => walk(o.value)); }
    }
  };
  walk(parse(msg));
  return found;
}

mkdirSync(outDir, { recursive: true });
const written = new Set();
const en = JSON.parse(readFileSync(join(root, 'locales/en.json'), 'utf8'));
for (const l of registry.locales) {
  const src = JSON.parse(readFileSync(join(root, 'locales', `${l.tag}.json`), 'utf8'));
  const arb = { '@@locale': l.flutter };
  for (const [key, value] of Object.entries(src)) {
    const id = toId(key);
    arb[id] = value;
    if (l.tag === registry.defaultLocale) {
      const ph = placeholders(en[key]);
      arb[`@${id}`] = { description: `Key: ${key}`, ...(Object.keys(ph).length ? { placeholders: ph } : {}) };
    }
  }
  writeFileSync(join(outDir, `app_${l.flutter}.arb`), JSON.stringify(arb, null, 2) + '\n');
  // Flutter gen_l10n requires a language-only fallback file for script/region variants (zh_Hans -> zh, pt_BR -> pt).
  const base = l.flutter.split('_')[0];
  if (base !== l.flutter && !registry.locales.some((o) => o.flutter === base) && !written.has(base)) {
    written.add(base);
    writeFileSync(join(outDir, `app_${base}.arb`), JSON.stringify({ ...arb, '@@locale': base }, null, 2) + '\n');
  }
}
console.log(`Exported ${registry.locales.length} ARB files to ${outDir}`);
