'use strict';
// filler.js'in simüle edilmiş (SİMÜLASYON) NVI benzeri form üzerindeki davranışı.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { start } = require('../scripts/serve.cjs');
const { makeTckn } = require('./helpers.cjs');

const DATA = { tckn: makeTckn('123456789'), ad: 'DENEME', soyad: 'KULLANICI', dogumYili: '1990' };
const FILLER = path.resolve(__dirname, '../src/filler.js');

let browser, server, base;
test.before(async () => {
  server = await start(0);
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); server?.close(); });

async function run(scenario, opts = {}) {
  const page = await browser.newPage();
  await page.goto(`${base}/test/fixtures/nvi-like.html?scenario=${scenario}`);
  await page.addScriptTag({ path: FILLER });
  const result = await page.evaluate(([d, o]) => window.NviFiller.fill(d, o), [opts.data || DATA, { timeoutMs: opts.timeoutMs ?? 3000 }]);
  const state = await page.evaluate(() => ({
    values: Object.fromEntries([...document.querySelectorAll('input[type=text]')].map((i) => [i.id, i.value])),
    submitted: window.__submitted,
    events: window.__events
  }));
  await page.close();
  return { result, state };
}

const statuses = (r) => Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, v.status]));

test('normal form: dört alan doldurulur, CAPTCHA ve gönder düğmesine dokunulmaz', async () => {
  const { result, state } = await run('normal');
  assert.deepEqual(statuses(result), { tckn: 'filled', ad: 'filled', soyad: 'filled', dogumYili: 'filled' });
  assert.equal(result.ok, true);
  assert.equal(result.filledCount, 4);
  assert.equal(state.values.txtTc, DATA.tckn);
  assert.equal(state.values.txtAd, 'DENEME');
  assert.equal(state.values.txtSoyad, 'KULLANICI');
  assert.equal(state.values.txtYil, '1990');
  assert.equal(state.values.txtAnneAdi, '', '"Anne Adı" alanı "Ad" ile karıştırılmaz');
  assert.equal(state.values.txtGuvenlik, '', 'CAPTCHA alanı boş kalır');
  assert.equal(state.submitted, 0, 'form gönderilmez');
  assert.ok(state.events.includes('input:txtTc') && state.events.includes('change:txtTc'), 'input/change olayları tetiklenir');
});

test('sonuç nesnesi kişisel veri içermez', async () => {
  const { result } = await run('normal');
  const json = JSON.stringify(result);
  for (const v of Object.values(DATA)) assert.ok(!json.includes(v), 'sonuçta değer sızmamalı');
});

test('dolu alan korunur, aynı değer "unchanged" sayılır', async () => {
  const kept = await run('prefilled');
  assert.equal(kept.result.fields.ad.status, 'kept');
  assert.equal(kept.state.values.txtAd, 'ÖNCEDEN');
  assert.equal(kept.result.ok, false);
  const same = await run('prefilled', { data: { ...DATA, ad: 'ÖNCEDEN' } });
  assert.equal(same.result.fields.ad.status, 'unchanged');
  assert.equal(same.result.ok, true);
});

test('belirsiz alan atlanır ve hiçbiri doldurulmaz', async () => {
  const { result, state } = await run('ambiguous');
  assert.equal(result.fields.soyad.status, 'ambiguous');
  assert.equal(state.values.txtSoyad, '');
  assert.equal(state.values.txtSoyad2, '');
  assert.equal(result.fields.ad.status, 'filled');
});

test('geç yüklenen alanlar beklenir', async () => {
  const { result } = await run('late', { timeoutMs: 4000 });
  assert.equal(result.ok, true);
  assert.equal(result.timedOut, false);
  assert.ok(result.durationMs >= 1000, 'alanların gelmesi beklendi');
});

test('hiç gelmeyen alanlar zaman aşımıyla "missing" döner', async () => {
  const { result } = await run('never', { timeoutMs: 600 });
  assert.equal(result.timedOut, true);
  assert.equal(result.ok, false);
  assert.deepEqual(statuses(result), { tckn: 'missing', ad: 'missing', soyad: 'missing', dogumYili: 'missing' });
});

test('form yoksa zaman aşımı ve missing', async () => {
  const { result } = await run('noform', { timeoutMs: 300 });
  assert.equal(result.timedOut, true);
  assert.equal(result.filledCount, 0);
});

test('sanal klavye açıkken readonly alanlar zorla değiştirilmez', async () => {
  const { result, state } = await run('vkeyboard');
  assert.equal(result.virtualKeyboard, true);
  assert.deepEqual(statuses(result), { tckn: 'readonly', ad: 'readonly', soyad: 'readonly', dogumYili: 'readonly' });
  assert.equal(state.values.txtTc, '');
});

test('disabled alan atlanır, diğerleri doldurulur', async () => {
  const { result, state } = await run('disabled');
  assert.equal(result.fields.soyad.status, 'disabled');
  assert.equal(state.values.txtSoyad, '');
  assert.equal(result.filledCount, 3);
});

test('sayfa değeri reddederse "rejected" bildirilir', async () => {
  const { result } = await run('rejecting');
  assert.equal(result.fields.dogumYili.status, 'rejected');
});

test('etiketsiz, yalnızca id/name ile tanımlı alanlar eşleşir', async () => {
  const { result, state } = await run('idonly');
  assert.equal(result.ok, true);
  assert.equal(state.values.TCKimlikNo, DATA.tckn);
  assert.equal(state.values.DogumYili, '1990');
});

test('maxlength aşılırsa alan atlanır', async () => {
  const { result } = await run('normal', { data: { ...DATA, dogumYili: '19900' } });
  assert.equal(result.fields.dogumYili.status, 'too_long');
});

test('demo.html: simülasyon etiketi görünür ve demo panel doldurur', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/demo/demo.html`);
  assert.match(await page.locator('.banner').innerText(), /SİMÜLASYON/);
  await page.frameLocator('#target').locator('#txtTc').waitFor();
  await page.click('#sample-btn');
  await page.click('#fill-btn');
  await page.waitForFunction(() => document.querySelectorAll('#field-results li').length === 4);
  assert.match(await page.locator('#status').innerText(), /SİMÜLASYON.*kimlik doğrulaması değildir/s);
  const filled = await page.locator('#field-results li[data-status="filled"]').count();
  assert.equal(filled, 4);
  await page.close();
});
