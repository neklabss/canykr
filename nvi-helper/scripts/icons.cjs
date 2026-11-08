// Simgeleri tek bir SVG'den üretir (genel "form + doldurma" işareti; kurum logosu değildir).
// Kullanım: node scripts/icons.cjs  →  icons/icon-{16,32,48,128}.png
'use strict';
const path = require('node:path');
const fs = require('node:fs');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="4" y="4" width="120" height="120" rx="24" fill="#0b5cad"/>
  <rect x="26" y="24" width="76" height="80" rx="8" fill="#fff"/>
  <rect x="36" y="38" width="56" height="9" rx="3" fill="#0b5cad"/>
  <rect x="36" y="55" width="56" height="9" rx="3" fill="#0b5cad"/>
  <rect x="36" y="72" width="34" height="9" rx="3" fill="#9db9db"/>
  <path d="M74 86 l9 9 l17-21" fill="none" stroke="#1a7f37" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function main() {
  const { chromium } = require('playwright');
  const out = path.resolve(__dirname, '../icons');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const size of [16, 32, 48, 128]) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(`<html><body style="margin:0;background:transparent">${SVG.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
      await page.screenshot({ path: path.join(out, `icon-${size}.png`), omitBackground: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { SVG };
