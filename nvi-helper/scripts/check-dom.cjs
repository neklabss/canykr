// Kaydedilmiş BOŞ NVI form HTML'inde alan eşleştirmesini raporlar.
// Kullanım: node scripts/check-dom.cjs <dosya.html> [--json]
// Sayfa betikleri çalıştırılmaz ve hiçbir ağ isteğine izin verilmez.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const FIELD_LABELS = { tckn: 'T.C. Kimlik No', ad: 'Ad', soyad: 'Soyad', dogumYili: 'Doğum Yılı' };

async function checkDom(html) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route('**/*', (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    // javaScriptEnabled:false yalnızca sayfa betiklerini kapatır; evaluate çalışır.
    await page.evaluate(fs.readFileSync(path.join(__dirname, '../src/filler.js'), 'utf8'));
    return await page.evaluate(() => {
      const F = globalThis.NviFiller;
      const describe = (el) => {
        const labels = el.labels ? [...el.labels].map((l) => l.textContent.trim().replace(/\s+/g, ' ')) : [];
        return {
          tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || '', id: el.id || '', name: el.name || '',
          placeholder: el.getAttribute('placeholder') || '', ariaLabel: el.getAttribute('aria-label') || '',
          labels, readOnly: el.readOnly, disabled: el.disabled, maxLength: el.maxLength,
          hasValue: !!el.value
        };
      };
      const resolved = F.resolveFields(document);
      const fields = {};
      for (const [k, r] of Object.entries(resolved)) fields[k] = r.el ? { status: 'matched', element: describe(r.el) } : { status: r.status, count: r.count };
      const used = new Set(Object.values(resolved).filter((r) => r.el).map((r) => r.el));
      const others = [...document.querySelectorAll('input,select,textarea')]
        .filter((el) => !used.has(el) && el.type !== 'hidden')
        .map(describe);
      return { fields, others, inputsWithValue: [...document.querySelectorAll('input,textarea')]
        .filter((e) => !['hidden', 'checkbox', 'radio', 'submit', 'button', 'image', 'reset'].includes(e.type) && e.value).length };
    });
  } finally {
    await browser.close();
  }
}

function format(report) {
  const lines = [];
  for (const [k, f] of Object.entries(report.fields)) {
    if (f.status === 'matched') {
      const e = f.element;
      lines.push(`✓ ${FIELD_LABELS[k]} → <${e.tag}${e.id ? ' id="' + e.id + '"' : ''}${e.name ? ' name="' + e.name + '"' : ''}> etiket: ${e.labels.join(' / ') || '-'}` +
        `${e.readOnly ? ' [readonly]' : ''}${e.disabled ? ' [disabled]' : ''}${e.maxLength > 0 ? ' maxlength=' + e.maxLength : ''}`);
    } else {
      lines.push(`✗ ${FIELD_LABELS[k]} → ${f.status}${f.count ? ' (' + f.count + ' aday)' : ''}`);
    }
  }
  lines.push('', 'Eşleşmeyen diğer alanlar:');
  for (const e of report.others) {
    lines.push(`  - <${e.tag} type="${e.type}"${e.id ? ' id="' + e.id + '"' : ''}${e.name ? ' name="' + e.name + '"' : ''}> etiket: ${e.labels.join(' / ') || e.placeholder || e.ariaLabel || '-'}`);
  }
  if (report.inputsWithValue) lines.push('', `UYARI: ${report.inputsWithValue} alanda değer var. Yalnızca BOŞ form paylaşılmalı.`);
  return lines.join('\n');
}

module.exports = { checkDom, format };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Kullanım: node scripts/check-dom.cjs <dosya.html> [--json]'); process.exit(2); }
  checkDom(fs.readFileSync(file, 'utf8')).then((r) => {
    console.log(process.argv.includes('--json') ? JSON.stringify(r, null, 2) : format(r));
    const ok = Object.values(r.fields).every((f) => f.status === 'matched');
    process.exit(ok ? 0 : 1);
  }, (e) => { console.error(e.message); process.exit(2); });
}
