'use strict';
// Canlı inceleme betiğinin güvenlik sınırları ve yerel SİMÜLASYON üzerinde çalışması.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { start } = require('../scripts/serve.cjs');
const { parseArgs, main } = require('../scripts/inspect-live.cjs');
const { checkDom } = require('../scripts/check-dom.cjs');

const SRC = fs.readFileSync(path.join(__dirname, '../scripts/inspect-live.cjs'), 'utf8');

test('betik sayfayla etkileşime girmez: tıklama/yazma/gönderme API\'si yok', () => {
  const code = SRC.replace(/\/\/.*$/gm, ''); // yorumlar hariç
  for (const re of [/\.click\(/, /\.fill\(/, /\.type\(/, /\.press\(/, /\.check\(/, /\.setChecked\(/, /\.tap\(/,
    /\.selectOption\(/, /\.dispatchEvent\(/, /\.submit\(/, /\.keyboard\./, /\.mouse\./, /\.setInputFiles\(/, /\.focus\(/]) {
    assert.doesNotMatch(code, re, 'yasak çağrı: ' + re);
  }
  assert.doesNotMatch(code, /NviFiller\.fill\(/, 'doldurucu çağrılmaz, yalnızca resolveFields/probe');
});

test('yalnızca NVI T.C. Kimlik No Doğrulama sayfası (ve yerel test sunucusu) incelenebilir', () => {
  assert.equal(parseArgs([]).url, 'https://tckimlik.nvi.gov.tr/Modul/TcKimlikNoDogrula');
  assert.throws(() => parseArgs(['--url', 'https://example.com/']), /Yalnızca NVI/);
  assert.throws(() => parseArgs(['--url', 'https://tckimlik.nvi.gov.tr/Modul/BaskaModul']), /Yalnızca NVI/);
  assert.throws(() => parseArgs(['--url', 'http://127.0.0.1.evil.example/']), /Yalnızca NVI/);
  assert.equal(parseArgs(['--url', 'http://127.0.0.1:9/x']).url, 'http://127.0.0.1:9/x');
});

async function inspect(scenario) {
  const server = await start(0);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nvi-inspect-'));
  try {
    const url = `http://127.0.0.1:${server.address().port}/test/fixtures/nvi-like.html?scenario=${scenario}`;
    const report = await main(['--url', url, '--headless', '--out', out, '--wait', '10', '--no-prompt']);
    return { report, out, html: fs.readFileSync(path.join(out, 'nvi-bos-form.html'), 'utf8') };
  } finally {
    server.close();
  }
}

test('geç yüklenen formu bekler, eşleştirmeyi raporlar, temiz HTML check-dom ile aynı sonucu verir', async () => {
  const { report, out, html } = await inspect('late');
  try {
    assert.equal(report.formFound, true);
    const frame = report.before.find((f) => f.mapping);
    for (const k of ['tckn', 'ad', 'soyad', 'dogumGun', 'dogumAy', 'dogumYili']) assert.equal(frame.mapping[k].status, 'matched', k);
    assert.equal(frame.mapping.dogumYili.element.maxLength, 4);
    assert.ok(frame.buttons.some((b) => b.text === 'Doğrula'));
    assert.equal(frame.virtualKeyboardToggles.length > 0, true);
    assert.equal(frame.inputsWithValue, 0);
    assert.ok(!html.includes('<script'), 'betikler temizlendi');
    const dom = await checkDom(html);
    for (const k of ['tckn', 'ad', 'soyad', 'dogumGun', 'dogumAy', 'dogumYili']) assert.equal(dom.fields[k].status, 'matched', 'check-dom ' + k);
    assert.ok(fs.existsSync(path.join(out, 'inspect-report.json')));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('sanal klavye açık senaryosu: readonly ve açık durum raporlanır', async () => {
  const { report, out } = await inspect('vkeyboard');
  try {
    const frame = report.before.find((f) => f.mapping);
    assert.equal(frame.virtualKeyboardDetected, true);
    assert.equal(frame.mapping.tckn.element.readOnly, true);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
