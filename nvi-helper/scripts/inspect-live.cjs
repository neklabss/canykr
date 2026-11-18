// Canlı NVI T.C. Kimlik No Doğrulama sayfasının BOŞ formunu Playwright ile SALT OKUNUR inceler.
//
// Ne yapar:  sayfayı gerçek tarayıcıda açar, JavaScript ile oluşan formu bekler, alanların yapısını
//            (id/name/etiket/readonly/maxlength) ve eklentinin eşleştirmesini (NviFiller.resolveFields)
//            raporlar; değerleri, gizli belirteçleri ve görselleri temizlenmiş boş form HTML'ini kaydeder.
// Ne yapmaz: hiçbir alana yazmaz, hiçbir öğeye tıklamaz, "Ben robot değilim"e ve Doğrula'ya dokunmaz,
//            form göndermez. (test/inspect-live.test.cjs bu betikte etkileşim API'si olmadığını denetler.)
//
// Kullanım (kendi bilgisayarınızda, NVI'ye erişebilen bağlantıyla):
//   node scripts/inspect-live.cjs                  # tarayıcı görünür açılır
//   node scripts/inspect-live.cjs --sanal-klavye   # ilk rapordan sonra "Sanal Klavye Kullan"a SİZ
//                                                  # tıklarsınız, Enter'a basınca ikinci rapor alınır
//   seçenekler: --headless  --out <klasör>  --wait <sn>
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const NVI_URL = 'https://tckimlik.nvi.gov.tr/Modul/TcKimlikNoDogrula';
const FILLER_SRC = fs.readFileSync(path.join(__dirname, '../src/filler.js'), 'utf8');

function parseArgs(argv) {
  const a = { headless: false, out: 'nvi-inspect', wait: 30, vk: false, url: NVI_URL, noPrompt: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--headless') a.headless = true;
    else if (k === '--sanal-klavye') a.vk = true;
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--wait') a.wait = Number(argv[++i]);
    else if (k === '--url') a.url = argv[++i]; // yalnızca yerel test içindir; aşağıda sınırlanır
    else if (k === '--no-prompt') a.noPrompt = true;
  }
  const u = new URL(a.url);
  const local = u.protocol === 'http:' && u.hostname === '127.0.0.1';
  if (!local && u.href.split('?')[0] !== NVI_URL) throw new Error('Yalnızca NVI T.C. Kimlik No Doğrulama sayfası incelenebilir.');
  return a;
}

// Sayfa içinde çalışır: yalnızca okur. Değer döndürmez, yalnızca "dolu mu" bilgisini döndürür.
function collectInFrame() {
  const F = globalThis.NviFiller;
  const txt = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const describe = (el) => ({
    tag: el.localName,
    type: el.getAttribute('type') || '',
    id: el.id || '',
    name: el.getAttribute('name') || '',
    class: txt(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className),
    placeholder: el.getAttribute('placeholder') || '',
    ariaLabel: el.getAttribute('aria-label') || '',
    maxLength: el.maxLength > 0 ? el.maxLength : null,
    readOnly: !!el.readOnly,
    disabled: !!el.disabled,
    autocomplete: el.getAttribute('autocomplete') || '',
    inputmode: el.getAttribute('inputmode') || '',
    labels: el.labels ? Array.from(el.labels).map((l) => txt(l.textContent)) : [],
    hasValue: 'value' in el && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'hidden' ? !!el.value : undefined,
    checked: el.type === 'checkbox' || el.type === 'radio' ? el.checked : undefined
  });
  const resolved = F.resolveFields(document);
  const mapping = {};
  for (const [k, r] of Object.entries(resolved)) mapping[k] = r.el ? { status: 'matched', element: describe(r.el) } : { status: r.status, count: r.count };
  const controls = Array.from(document.querySelectorAll('input:not([type=hidden]), select, textarea')).map(describe);
  const hidden = Array.from(document.querySelectorAll('input[type=hidden]')).map((e) => e.getAttribute('name') || e.id);
  const buttons = Array.from(document.querySelectorAll('button, input[type=submit], input[type=button], a[role=button], [role=button]'))
    .map((e) => ({ tag: e.localName, id: e.id || '', text: txt(e.textContent || e.value), ariaPressed: e.getAttribute('aria-pressed'), class: txt(e.className) }));
  const vk = Array.from(document.querySelectorAll('a, button, label, span, div, input'))
    .filter((e) => /sanal\s*klavye/i.test(e.textContent || e.getAttribute('aria-label') || '') && e.children.length < 4)
    .slice(0, 5)
    .map((e) => ({ tag: e.localName, id: e.id || '', class: txt(e.className), text: txt(e.textContent), ariaPressed: e.getAttribute('aria-pressed'), outer: txt(e.outerHTML).slice(0, 120) }));
  const keyboards = Array.from(document.querySelectorAll('[class*="keyboard" i], [id*="keyboard" i], [class*="klavye" i], [id*="klavye" i]'))
    .filter((e) => e.getClientRects().length > 0).slice(0, 5).map((e) => ({ tag: e.localName, id: e.id || '', class: txt(e.className) }));
  const iframes = Array.from(document.querySelectorAll('iframe')).map((f) => { try { const u = new URL(f.src, location.href); return u.host + u.pathname; } catch (e) { return ''; } });
  const scripts = Array.from(document.scripts).filter((s) => s.src).map((s) => { const u = new URL(s.src, location.href); return u.host + u.pathname; });
  const forms = Array.from(document.forms).map((f) => ({ id: f.id || '', name: f.getAttribute('name') || '', method: f.method, action: (() => { try { const u = new URL(f.action, location.href); return u.host + u.pathname; } catch (e) { return ''; } })() }));
  return {
    url: location.host + location.pathname,
    title: document.title,
    probe: F.probe(),
    mapping, controls, hiddenInputNames: hidden, buttons, virtualKeyboardToggles: vk, visibleKeyboards: keyboards,
    virtualKeyboardDetected: !!(F.detectVirtualKeyboard && F.detectVirtualKeyboard(document)),
    forms, iframes, scripts,
    inputsWithValue: controls.filter((c) => c.hasValue).length
  };
}

// Sayfa içinde çalışır: belgenin temizlenmiş KOPYASINI üretir (asıl sayfaya dokunmaz).
function sanitizedHtmlInFrame() {
  const root = document.body.cloneNode(true);
  root.querySelectorAll('script, noscript, iframe').forEach((e) => e.remove());
  root.querySelectorAll('img').forEach((e) => e.removeAttribute('src'));
  root.querySelectorAll('input, textarea').forEach((e) => {
    if (e.type === 'hidden') e.setAttribute('value', '');
    else if (!['checkbox', 'radio'].includes(e.type)) e.removeAttribute('value');
  });
  return '<!doctype html><html lang="tr"><meta charset="utf-8"><body>' + root.innerHTML + '</body></html>';
}

async function snapshot(page) {
  const frames = [];
  for (const frame of page.frames()) {
    let host = '';
    try { host = new URL(frame.url()).host; } catch (e) { /* about:blank vb. */ }
    if (host !== 'tckimlik.nvi.gov.tr' && host !== '127.0.0.1' && !host.startsWith('127.0.0.1:')) {
      frames.push({ url: host, skipped: 'NVI dışı çerçeve (ör. reCAPTCHA); incelenmedi' });
      continue;
    }
    try {
      await frame.evaluate(FILLER_SRC);
      frames.push(await frame.evaluate(collectInFrame));
    } catch (e) {
      frames.push({ url: host, error: String(e.message).split('\n')[0] });
    }
  }
  return frames;
}

async function waitForForm(page, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        await frame.evaluate(FILLER_SRC);
        const p = await frame.evaluate(() => globalThis.NviFiller.probe());
        if (p.found + p.ambiguous >= 3) return true;
      } catch (e) { /* çerçeve henüz hazır değil */ }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, () => { rl.close(); resolve(); }));
}

function summarize(frames) {
  const lines = [];
  for (const f of frames) {
    if (!f.mapping) { lines.push(`- ${f.url}: ${f.skipped || f.error}`); continue; }
    lines.push(`- Çerçeve ${f.url} (${f.title})`);
    for (const [k, m] of Object.entries(f.mapping)) {
      lines.push(m.status === 'matched'
        ? `    ✓ ${k} → <${m.element.tag} id="${m.element.id}" name="${m.element.name}"> etiket: ${m.element.labels.join(' / ') || '-'}${m.element.readOnly ? ' [readonly]' : ''}${m.element.maxLength ? ' maxlength=' + m.element.maxLength : ''}`
        : `    ✗ ${k} → ${m.status}${m.count ? ' (' + m.count + ' aday)' : ''}`);
    }
    lines.push(`    sanal klavye öğeleri: ${f.virtualKeyboardToggles.length}, açık algılandı: ${f.virtualKeyboardDetected}, görünür klavye: ${f.visibleKeyboards.length}`);
    if (f.inputsWithValue) lines.push(`    UYARI: ${f.inputsWithValue} alanda değer var; yalnızca BOŞ form paylaşılmalı.`);
  }
  return lines.join('\n');
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const { chromium } = require('playwright');
  fs.mkdirSync(args.out, { recursive: true });
  const browser = await chromium.launch({ headless: args.headless });
  const page = await (await browser.newContext({ locale: 'tr-TR' })).newPage();
  const report = { inspectedAt: new Date().toISOString(), url: args.url, note: 'Salt okunur inceleme; değer içermez.' };
  try {
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    report.formFound = await waitForForm(page, args.wait);
    report.before = await snapshot(page);
    console.log('\nİlk inceleme:\n' + summarize(report.before));
    const main = page.frames().find((f) => { try { return ['tckimlik.nvi.gov.tr', '127.0.0.1'].includes(new URL(f.url()).hostname); } catch (e) { return false; } }) || page.mainFrame();
    fs.writeFileSync(path.join(args.out, 'nvi-bos-form.html'), await main.evaluate(sanitizedHtmlInFrame));
    if (args.vk && !args.noPrompt) {
      await ask('\nŞimdi tarayıcıda "Sanal Klavye Kullan"a SİZ tıklayın, isterseniz bir alana tıklayıp klavyenin çıktığını görün (veri girmeyin). Sonra burada Enter\'a basın… ');
      report.afterVirtualKeyboard = await snapshot(page);
      console.log('\nSanal klavye sonrası:\n' + summarize(report.afterVirtualKeyboard));
      fs.writeFileSync(path.join(args.out, 'nvi-sanal-klavye.html'), await main.evaluate(sanitizedHtmlInFrame));
    }
  } catch (e) {
    report.error = String(e.message).split('\n')[0];
    console.error('Hata: ' + report.error);
  } finally {
    fs.writeFileSync(path.join(args.out, 'inspect-report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(`\nRapor: ${path.join(args.out, 'inspect-report.json')}\nBoş form: ${path.join(args.out, 'nvi-bos-form.html')}`);
  return report;
}

module.exports = { parseArgs, collectInFrame, sanitizedHtmlInFrame, NVI_URL, main };

if (require.main === module) main().then((r) => process.exit(r.error ? 2 : r.formFound ? 0 : 1));
