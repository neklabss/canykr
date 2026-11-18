'use strict';
// filler.js'in simüle edilmiş (SİMÜLASYON) NVI benzeri form üzerindeki davranışı.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { start } = require('../scripts/serve.cjs');
const { makeTckn } = require('./helpers.cjs');

const DATA = { tckn: makeTckn('123456789'), ad: 'DENEME', soyad: 'KULLANICI', dogumGun: '05', dogumAy: '03', dogumYili: '1990' };
const ALL = (st) => ({ tckn: st, ad: st, soyad: st, dogumGun: st, dogumAy: st, dogumYili: st });
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
    checks: Object.fromEntries([...document.querySelectorAll('input[type=checkbox]')].map((i) => [i.id, i.checked])),
    submitted: window.__submitted,
    events: window.__events
  }));
  await page.close();
  return { result, state };
}

const statuses = (r) => Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, v.status]));

test('kılavuzdaki düzen: altı alan doldurulur; belge, reCAPTCHA ve Doğrula\'ya dokunulmaz', async () => {
  const { result, state } = await run('normal');
  assert.deepEqual(statuses(result), ALL('filled'));
  assert.equal(result.ok, true);
  assert.equal(result.filledCount, 6);
  assert.equal(state.values.requestTCKimlikNo, DATA.tckn);
  assert.equal(state.values.requestAd, 'DENEME');
  assert.equal(state.values.requestSoyad, 'KULLANICI');
  assert.deepEqual([state.values.requestDogumGun, state.values.requestDogumAy, state.values.requestDogumYil], ['05', '03', '1990']);
  for (const id of ['requestCuzdanSeriNo', 'requestTckkSeriNo', 'requestGeciciKimlikNo']) assert.equal(state.values[id], '', id + ' (isteğe bağlı belge alanı) boş kalır');
  assert.deepEqual(state.checks, { chkSoyadYok: false, chkRobot: false }, '"Soyadı yok" ve "Ben robot değilim" kutularına dokunulmaz');
  assert.equal(state.submitted, 0, 'Doğrula\'ya basılmaz');
  assert.ok(state.events.includes('input:requestTCKimlikNo') && state.events.includes('change:requestTCKimlikNo'), 'input/change olayları tetiklenir');
});

test('etiketler <label> ile bağlı değilse alanın önündeki metinden eşleşir', async () => {
  const { result, state } = await run('divlabels');
  assert.deepEqual(statuses(result), ALL('filled'));
  assert.deepEqual([state.values.f1, state.values.f2, state.values.f3, state.values.f4, state.values.f5, state.values.f6],
    [DATA.tckn, 'DENEME', 'KULLANICI', '05', '03', '1990']);
  assert.deepEqual([state.values.f7, state.values.f8, state.values.f9], ['', '', ''], 'Seri No alanları boş kalır');
});

test('yalnızca doğum yılı verilirse gün ve ay "no_value" olur, ok=false', async () => {
  const { result, state } = await run('normal', { data: { ...DATA, dogumGun: '', dogumAy: '' } });
  assert.equal(result.fields.dogumGun.status, 'no_value');
  assert.equal(result.fields.dogumAy.status, 'no_value');
  assert.equal(result.fields.dogumYili.status, 'filled');
  assert.equal(result.ok, false);
  assert.deepEqual([state.values.requestDogumGun, state.values.requestDogumAy], ['', '']);
});

test('sonuç nesnesi kişisel veri içermez', async () => {
  const { result } = await run('normal');
  const json = JSON.stringify(result);
  for (const v of Object.values(DATA)) assert.ok(!json.includes(v), 'sonuçta değer sızmamalı');
});

test('dolu alan korunur, aynı değer "unchanged" sayılır', async () => {
  const kept = await run('prefilled');
  assert.equal(kept.result.fields.ad.status, 'kept');
  assert.equal(kept.state.values.requestAd, 'ÖNCEDEN');
  assert.equal(kept.result.ok, false);
  const same = await run('prefilled', { data: { ...DATA, ad: 'ÖNCEDEN' } });
  assert.equal(same.result.fields.ad.status, 'unchanged');
  assert.equal(same.result.ok, true);
});

test('belirsiz alan atlanır ve hiçbiri doldurulmaz', async () => {
  const { result, state } = await run('ambiguous');
  assert.equal(result.fields.soyad.status, 'ambiguous');
  assert.equal(state.values.requestSoyad, '');
  assert.equal(state.values.requestSoyad2, '');
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
  assert.deepEqual(statuses(result), ALL('missing'));
});

test('form yoksa zaman aşımı ve missing', async () => {
  const { result } = await run('noform', { timeoutMs: 300 });
  assert.equal(result.timedOut, true);
  assert.equal(result.filledCount, 0);
});

test('canlı sayfadaki gibi sanal klavye açık (div.sanalKlavye.active): algılanır, alanlar yine doldurulur', async () => {
  const { result, state } = await run('vkeyboard');
  assert.equal(result.virtualKeyboard, true);
  assert.deepEqual(statuses(result), ALL('filled'));
  assert.equal(state.values.requestTCKimlikNo, DATA.tckn);
});

test('salt okunur alanlar zorla değiştirilmez', async () => {
  const { result, state } = await run('readonly');
  assert.deepEqual(statuses(result), ALL('readonly'));
  assert.equal(state.values.requestTCKimlikNo, '');
});

test('Angular benzeri model "input" olayıyla güncellenir; sanal klavye kapalıyken algılanmaz', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/test/fixtures/nvi-like.html?scenario=normal`);
  await page.addScriptTag({ path: FILLER });
  const result = await page.evaluate((d) => window.NviFiller.fill(d, { timeoutMs: 1000 }), DATA);
  const model = await page.evaluate(() => window.__model);
  const cls = await page.getAttribute('#requestAd', 'class');
  await page.close();
  assert.equal(result.virtualKeyboard, false);
  assert.deepEqual(model, { requestTCKimlikNo: DATA.tckn, requestAd: 'DENEME', requestSoyad: 'KULLANICI', requestDogumGun: '05', requestDogumAy: '03', requestDogumYil: '1990' });
  assert.match(cls, /ng-dirty/);
});

test('sayfa toLowerCase\'i Türkçe kurala çevirse bile (canlıda gözlendi) büyük harfli etiketler eşleşir', async () => {
  const { result, state } = await run('trlower');
  assert.deepEqual(statuses(result), ALL('filled'));
  assert.equal(state.values.f6, '1990');
});

test('"Geçici Kimlik Belge No" (requestGeciciKimlikNo) T.C. Kimlik No ile karışmaz', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/test/fixtures/nvi-like.html?scenario=normal`);
  await page.addScriptTag({ path: FILLER });
  // Asıl T.C. alanını kaldırınca geçici belge alanı onun yerine seçilmemeli.
  await page.evaluate(() => document.getElementById('requestTCKimlikNo').closest('.row').remove());
  const st = await page.evaluate(() => window.NviFiller.resolveFields(document).tckn.status);
  await page.close();
  assert.equal(st, 'missing');
});

test('disabled alan atlanır, diğerleri doldurulur', async () => {
  const { result, state } = await run('disabled');
  assert.equal(result.fields.soyad.status, 'disabled');
  assert.equal(state.values.requestSoyad, '');
  assert.equal(result.filledCount, 5);
});

test('sayfa değeri reddederse "rejected" bildirilir', async () => {
  const { result } = await run('rejecting');
  assert.equal(result.fields.dogumYili.status, 'rejected');
});

test('etiketsiz, yalnızca id/name ile tanımlı alanlar eşleşir', async () => {
  const { result, state } = await run('idonly');
  assert.equal(result.ok, true);
  assert.equal(state.values.TCKimlikNo, DATA.tckn);
  assert.equal(state.values.DogumGun, '05');
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
  await page.frameLocator('#target').locator('#requestTCKimlikNo').waitFor();
  await page.click('#sample-btn');
  await page.click('#fill-btn');
  await page.waitForFunction(() => document.querySelectorAll('#field-results li').length === 6);
  assert.match(await page.locator('#status').innerText(), /SİMÜLASYON.*kimlik doğrulaması değildir/s);
  const filled = await page.locator('#field-results li[data-status="filled"]').count();
  assert.equal(filled, 6);
  await page.close();
});
