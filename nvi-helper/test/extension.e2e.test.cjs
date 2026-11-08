'use strict';
/*
 * Eklentinin uçtan uca testi: gerçek service worker, yan panel ve scripting API.
 * tckimlik.nvi.gov.tr istekleri Playwright ile YEREL SİMÜLASYON sayfasına
 * yönlendirilir; gerçek NVI sunucusuna hiçbir istek gitmez.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { makeTckn } = require('./helpers.cjs');

const EXT = path.resolve(__dirname, '..');
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures/nvi-like.html'));
const NVI = 'https://tckimlik.nvi.gov.tr/Modul/TcKimlikNoDogrula';
const OTHER = 'https://example.invalid/';
const DATA = { tckn: makeTckn('234567891'), ad: 'DENEME', soyad: 'KULLANICI', dogumYili: '1990' };

let ctx, extId, panel;
// Yanıt gecikmesi (ms), URL'deki ?delay= ile ayarlanır: sekme "loading" durumunda kalır.
const blockedRequests = [];

test.before(async () => {
  ctx = await chromium.launchPersistentContext('', {
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
  });
  await ctx.route('https://tckimlik.nvi.gov.tr/**', async (route) => {
    const delay = Number(new URL(route.request().url()).searchParams.get('delay') || 0);
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FIXTURE }).catch(() => {});
  });
  await ctx.route('https://example.invalid/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>baska</title><p>NVI değil</p>' }));
  // Güvenlik ağı: yerel olmayan başka hiçbir isteğe izin verme.
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|tckimlik\.nvi\.gov\.tr|example\.invalid)/, (route) => {
    blockedRequests.push(route.request().url());
    route.abort();
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  extId = new URL(sw.url()).host;
  panel = await ctx.newPage();
  await panel.goto(`chrome-extension://${extId}/src/panel.html`);
});

test.after(async () => { await ctx?.close(); });

function sw() {
  return ctx.serviceWorkers().find((w) => w.url().includes(extId));
}

async function sessionKeys() {
  // Service worker durdurulmuşsa yeniden uyanana kadar panel üzerinden oku.
  return panel.evaluate(async () => Object.keys(await chrome.storage.session.get(null)));
}

// Sekmeyi eklenti API'siyle açar ki tab id'si bilinsin. Gezinmeyi Playwright yapar;
// böylece istek yönlendirmesi (route) ilk yüklemeden itibaren geçerli olur.
// Dönen `loaded` gezinme tamamlanınca çözülür; `delay` içeren adreslerde sekme
// o süre boyunca "loading" durumunda kalır.
async function openTab(url) {
  const pagePromise = ctx.waitForEvent('page');
  const tabId = await panel.evaluate(() => chrome.tabs.create({ url: 'about:blank', active: false }).then((t) => t.id));
  const page = await pagePromise;
  const loaded = page.goto(url).catch(() => {});
  await panel.waitForFunction(async ([id, u]) => {
    const t = await chrome.tabs.get(id);
    return (t.pendingUrl || t.url || '').startsWith(u.split('?')[0]);
  }, [tabId, url], { timeout: 5000 });
  if (!/[?&]delay=/.test(url)) await loaded;
  return { tabId, page, loaded };
}

async function openPanel(tabId) {
  await panel.goto(`chrome-extension://${extId}/src/panel.html?tabId=${tabId}`);
}

async function typeData(data = DATA) {
  for (const [k, v] of Object.entries(data)) await panel.fill('#' + k, v);
}

async function waitStatus(re, timeout = 15000) {
  await panel.waitForFunction((src) => new RegExp(src, 's').test(document.getElementById('status').textContent), re.source, { timeout });
  return panel.locator('#status').innerText();
}

async function pageValues(page) {
  return page.evaluate(() => ({
    values: Object.fromEntries([...document.querySelectorAll('input[type=text]')].map((i) => [i.id, i.value])),
    submitted: window.__submitted
  }));
}

test('yüklü NVI sayfası: panelden aktarım, form gönderilmez, veri saklanmaz', async () => {
  const { tabId, page } = await openTab(NVI + '?scenario=normal');
  await openPanel(tabId);
  await typeData();
  await panel.click('#fill-btn');
  const status = await waitStatus(/aktarıldı/);
  assert.match(status, /kimlik doğrulaması değildir/);
  const st = await pageValues(page);
  assert.equal(st.values.txtTc, DATA.tckn);
  assert.equal(st.values.txtSoyad, 'KULLANICI');
  assert.equal(st.values.txtGuvenlik, '', 'CAPTCHA boş');
  assert.equal(st.submitted, 0, 'sorgu otomatik başlatılmaz');
  assert.equal(await panel.inputValue('#tckn'), '', 'panel aktarımdan sonra temizlendi');
  assert.equal(await panel.locator('#field-results li[data-status="filled"]').count(), 4);
  assert.deepEqual(await sessionKeys(), [], 'session deposunda kayıt kalmaz');
  await page.close();
});

test('panel doğrulaması: hatalı veride mesaj gönderilmez, erişilebilir hata özeti', async () => {
  const { tabId, page } = await openTab(NVI + '?scenario=normal');
  await openPanel(tabId);
  await typeData({ ...DATA, tckn: DATA.tckn.slice(0, 10) + ((Number(DATA.tckn[10]) + 1) % 10), dogumYili: '19' });
  await panel.click('#fill-btn');
  await waitStatus(/Bilgilerde hata var/);
  assert.equal(await panel.getAttribute('#tckn', 'aria-invalid'), 'true');
  assert.equal(await panel.getAttribute('#dogumYili', 'aria-invalid'), 'true');
  assert.equal(await panel.getAttribute('#ad', 'aria-invalid'), null);
  assert.equal(await panel.isVisible('#error-summary'), true);
  assert.equal(await panel.evaluate(() => document.activeElement.id), 'error-summary', 'odak hata özetine taşınır');
  assert.match(await panel.innerText('#tckn-error'), /kontrol basamakları/);
  assert.equal((await pageValues(page)).values.txtTc, '', 'NVI formuna dokunulmadı');
  // Hata özetindeki bağlantı ilgili alana odaklar.
  await panel.click('#error-list a >> nth=0');
  assert.equal(await panel.evaluate(() => document.activeElement.id), 'tckn');
  await page.close();
});

test('NVI olmayan sekme ve yanlış NVI modülü reddedilir', async () => {
  const other = await openTab(OTHER);
  await openPanel(other.tabId);
  await typeData();
  await panel.click('#fill-btn');
  await waitStatus(/NVI sayfası değil/);
  await other.page.close();

  const wrong = await openTab('https://tckimlik.nvi.gov.tr/Modul/BaskaBirModul');
  await openPanel(wrong.tabId);
  await typeData();
  await panel.click('#fill-btn');
  await waitStatus(/Doğrulama modülü değil/);
  assert.equal((await pageValues(wrong.page)).values.txtTc, '');
  await wrong.page.close();
});

test('sekme yüklenirken gönderilen veri bekletilir, yüklenince doldurulur ve silinir', async () => {
  const { tabId, page } = await openTab(NVI + '?scenario=normal&delay=1500');
  await openPanel(tabId);
  await typeData();
  await panel.click('#fill-btn');
  await waitStatus(/yükleniyor/);
  await waitStatus(/aktarıldı/);
  assert.equal((await pageValues(page)).values.txtAd, 'DENEME');
  assert.deepEqual(await sessionKeys(), []);
  await page.close();
});

test('bekleyen veri: sekme kapanınca silinir', async () => {
  const { tabId, page } = await openTab(NVI + '?scenario=normal&delay=4000');
  await openPanel(tabId);
  await typeData();
  await panel.click('#fill-btn');
  await waitStatus(/yükleniyor/);
  assert.deepEqual(await sessionKeys(), [`pending:${tabId}`]);
  await page.close();
  await panel.waitForFunction(async () => Object.keys(await chrome.storage.session.get(null)).length === 0, null, { timeout: 5000 });
});

test('bekleyen veri: sekme başka adrese giderse silinir ve panel bilgilendirilir', async () => {
  const { tabId, page } = await openTab(NVI + '?scenario=normal&delay=3000');
  await openPanel(tabId);
  await typeData();
  await panel.click('#fill-btn');
  await waitStatus(/yükleniyor/);
  await panel.evaluate(([id, u]) => chrome.tabs.update(id, { url: u }), [tabId, OTHER]);
  await waitStatus(/başka bir adrese gitti/);
  assert.deepEqual(await sessionKeys(), []);
  await page.close();
});

test('bekleyen veri: Temizle düğmesi kaydı iptal eder', async () => {
  const { tabId, page, loaded } = await openTab(NVI + '?scenario=normal&delay=4000');
  await openPanel(tabId);
  await typeData();
  await panel.click('#fill-btn');
  await waitStatus(/yükleniyor/);
  await panel.click('#clear-btn');
  await waitStatus(/temizlendi/);
  await panel.waitForFunction(async () => Object.keys(await chrome.storage.session.get(null)).length === 0, null, { timeout: 3000 });
  await loaded;
  await page.waitForTimeout(500);
  assert.equal((await pageValues(page)).values.txtTc, '', 'iptal edilen veri sayfaya yazılmadı');
  await page.close();
});

test('service worker durdurulsa bile bekleyen doldurma sekme yüklenince tamamlanır', async () => {
  const { tabId, page } = await openTab(NVI + '?scenario=normal&delay=3000');
  await openPanel(tabId);
  await typeData();
  await panel.click('#fill-btn');
  await waitStatus(/yükleniyor/);
  // Çalışan örneğe işaret koy, sonra service worker hedefini kapat.
  await sw().evaluate(() => { globalThis.__testMarker = 'eski'; });
  const cdp = await ctx.newCDPSession(panel);
  const { targetInfos } = await cdp.send('Target.getTargets');
  const target = targetInfos.find((t) => t.type === 'service_worker' && t.url.includes(extId));
  assert.ok(target, 'service worker hedefi bulundu');
  assert.equal((await cdp.send('Target.closeTarget', { targetId: target.targetId })).success, true);
  await cdp.detach();
  await waitStatus(/aktarıldı/, 20000);
  assert.equal((await pageValues(page)).values.txtTc, DATA.tckn);
  assert.deepEqual(await sessionKeys(), []);
  const marker = await sw().evaluate(() => globalThis.__testMarker);
  assert.equal(marker, undefined, 'doldurmayı yeniden başlatılmış yeni bir service worker örneği yaptı');
  await page.close();
});

test('sanal klavye açıkken readonly alanlar bildirilir, zorla doldurulmaz', async () => {
  const { tabId, page } = await openTab(NVI + '?scenario=vkeyboard');
  await openPanel(tabId);
  await typeData();
  await panel.click('#fill-btn');
  const status = await waitStatus(/Sanal klavye/);
  assert.doesNotMatch(status, /aktarıldı\./);
  assert.equal(await panel.locator('#field-results li[data-status="readonly"]').count(), 4);
  assert.equal(await panel.inputValue('#tckn'), DATA.tckn, 'başarısızlıkta panel verisi silinmez (elle giriş için)');
  assert.equal((await pageValues(page)).values.txtTc, '');
  await page.close();
});

test('alanlar hiç gelmezse zaman aşımı mesajı', async () => {
  const { tabId, page } = await openTab(NVI + '?scenario=never');
  await openPanel(tabId);
  await typeData();
  await panel.click('#fill-btn');
  await waitStatus(/belirlenen sürede/, 20000);
  assert.equal(await panel.locator('#field-results li[data-status="missing"]').count(), 4);
  await page.close();
});

test('sekme kapalıysa hata', async () => {
  const { tabId, page } = await openTab(NVI + '?scenario=normal');
  await page.close();
  await openPanel(tabId);
  await typeData();
  await panel.click('#fill-btn');
  await waitStatus(/sekmesi kapatıldı/);
});

test('panel erişilebilirlik temelleri: her alanın etiketi ve canlı durum bölgesi var', async () => {
  await openPanel(0);
  const unlabeled = await panel.evaluate(() =>
    [...document.querySelectorAll('input')].filter((i) => !i.labels || i.labels.length === 0).map((i) => i.id));
  assert.deepEqual(unlabeled, []);
  assert.equal(await panel.getAttribute('#status', 'role'), 'status');
  assert.equal(await panel.getAttribute('#status', 'aria-live'), 'polite');
  assert.equal(await panel.getAttribute('html', 'lang'), 'tr');
  // Klavyeyle gezinme sırası: alanlar → seçenek → düğmeler.
  await panel.focus('#tckn');
  const order = [];
  for (let i = 0; i < 6; i++) { await panel.keyboard.press('Tab'); order.push(await panel.evaluate(() => document.activeElement.id)); }
  assert.deepEqual(order, ['ad', 'soyad', 'dogumYili', 'clear-after', 'fill-btn', 'clear-btn']);
});

test('test boyunca dış ağa istek gitmedi', () => {
  assert.deepEqual(blockedRequests, []);
});
