// Generates dist/tokens.css (web/admin) and apps/mobile/lib/design/tokens.g.dart from tokens.json.
// `--check` also verifies WCAG AA contrast for core text/background pairs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const t = JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8'));
const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function flatten(obj, prefix = []) {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, [...prefix, k]) : [[[...prefix, k], v]]));
}
const colorVars = (theme) => flatten(t.color[theme]).map(([p, v]) => `  --color-${p.map(kebab).join('-')}: ${v};`).join('\n');
const common = [
  ...Object.entries(t.space).map(([k, v]) => `  --space-${k}: ${v}px;`),
  ...Object.entries(t.radius).map(([k, v]) => `  --radius-${k}: ${v}px;`),
  ...Object.entries(t.motion.duration).map(([k, v]) => `  --motion-${k}: ${v}ms;`),
  ...Object.entries(t.motion.easing).map(([k, v]) => `  --easing-${k}: ${v};`),
  ...Object.entries(t.elevation.light).map(([k, v]) => `  --elevation-${k}: ${v};`),
  `  --font-sans: ${t.font.family.sans.map((f) => (f.includes(' ') ? `"${f}"` : f)).join(', ')};`,
  `  --touch-target: ${t.size.touchTarget.web}px;`,
  `  --button-height: ${t.size.button.heightWeb}px;`,
  `  --input-height: ${t.size.input.height}px;`,
].join('\n');

const css = `/* AUTO-GENERATED from packages/design-tokens/tokens.json — do not edit. */
:root {
${common}
${colorVars('light')}
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${colorVars('dark').replace(/^/gm, '  ')}
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
${colorVars('dark')}
  color-scheme: dark;
}
`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/tokens.css'), css);

const camel = (p) => p.map((s, i) => (i === 0 ? s : s[0].toUpperCase() + s.slice(1))).join('');
const dartColor = (v) => {
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(v);
  if (rgba) return `Color.fromRGBO(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${rgba[4]})`;
  return `Color(0xFF${v.slice(1).toUpperCase()})`;
};
const dartTheme = (theme) => flatten(t.color[theme]).map(([p, v]) => `  static const ${camel(p)} = ${dartColor(v)};`).join('\n');
const dart = `// AUTO-GENERATED from packages/design-tokens/tokens.json — do not edit.
// ignore_for_file: constant_identifier_names
import 'package:flutter/painting.dart';

class BujDarkColors {
${dartTheme('dark')}
}

class BujLightColors {
${dartTheme('light')}
}

class BujSpace {
${Object.entries(t.space).map(([k, v]) => `  static const double s${k} = ${v};`).join('\n')}
}

class BujRadius {
${Object.entries(t.radius).map(([k, v]) => `  static const double ${k} = ${v};`).join('\n')}
}

class BujSize {
  static const double touchTargetAndroid = ${t.size.touchTarget.android};
  static const double touchTargetIos = ${t.size.touchTarget.ios};
  static const double buttonHeight = ${t.size.button.heightMobile};
  static const double buttonHeightEmergency = ${t.size.button.heightEmergency};
  static const double inputHeight = ${t.size.input.height};
}

class BujMotion {
${Object.entries(t.motion.duration).map(([k, v]) => `  static const Duration ${k} = Duration(milliseconds: ${v});`).join('\n')}
}
`;
const dartOut = join(root, '../../apps/mobile/lib/design');
mkdirSync(dartOut, { recursive: true });
writeFileSync(join(dartOut, 'tokens.g.dart'), dart);

if (process.argv.includes('--check')) {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const pairs = [['text.primary', 'bg.canvas'], ['text.primary', 'bg.surface'], ['text.secondary', 'bg.canvas'], ['text.secondary', 'bg.surface'], ['accent.text', 'bg.canvas'], ['text.onAccent', 'accent.primary'], ['status.danger', 'bg.surface']];
  const get = (theme, path) => path.split('.').reduce((o, k) => o[k], t.color[theme]);
  let failed = 0;
  for (const theme of ['light', 'dark']) for (const [fg, bg] of pairs) {
    const r = ratio(get(theme, fg), get(theme, bg));
    const ok = r >= 4.5;
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${theme.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)}:1`);
  }
  if (failed) { console.error(`${failed} pair(s) below WCAG AA 4.5:1`); process.exit(1); }
}
console.log('design tokens generated');
