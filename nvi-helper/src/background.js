/*
 * Service worker. Görevleri:
 *  - Panelden gelen doldurma isteğini yeniden doğrulamak,
 *  - hedef sekmenin NVI T.C. Kimlik No Doğrulama sayfası olduğunu kontrol etmek,
 *  - filler.js'i yalnızca o sekmeye enjekte edip sonucu panele iletmek,
 *  - sekme henüz yüklenmiyorsa veriyi kısa süreli (TTL) bekletmek ve
 *    sekme kapanınca / başka adrese gidince / TTL dolunca silmek.
 *
 * Kişisel veriler hiçbir koşulda loglanmaz. Form gönderilmez, CAPTCHA'ya dokunulmaz.
 */
importScripts('validation.js', 'session-store.js');

const NVI_HOST = 'tckimlik.nvi.gov.tr';
// CANLI ORTAMDA DOĞRULANMADI: topluluk kaynaklarındaki modül yolu.
const NVI_MODULE_PATH = '/modul/tckimliknodogrula';
const FIELD_WAIT_MS = 8000;
const INJECT_TIMEOUT_MS = FIELD_WAIT_MS + 4000;
const SWEEP_ALARM = 'nvi-sweep';
const PANEL_URL = chrome.runtime.getURL('src/panel.html');

const store = NviSessionStore.createStore({ storage: chrome.storage.session });
const inFlight = new Set();

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

function classifyUrl(url) {
  if (!url) return 'not_nvi_page';
  let u;
  try { u = new URL(url); } catch (e) { return 'not_nvi_page'; }
  if (u.protocol !== 'https:' || u.hostname !== NVI_HOST) return 'not_nvi_page';
  if (!u.pathname.toLowerCase().startsWith(NVI_MODULE_PATH)) return 'wrong_module';
  return 'ok';
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('nvi_timeout')), ms); })
  ]);
}

function errorCode(err) {
  const msg = String((err && err.message) || err);
  if (msg === 'nvi_timeout') return 'timeout';
  if (/No tab with id|tab was closed|Tab .* not found/i.test(msg)) return 'tab_closed';
  if (/error page|Cannot access|permission/i.test(msg)) return 'page_unavailable';
  return 'injection_failed';
}

async function runFill(tabId, data) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/filler.js'] });
  const [injection] = await withTimeout(
    chrome.scripting.executeScript({
      target: { tabId },
      func: (d, wait) => globalThis.NviFiller.fill(d, { timeoutMs: wait }),
      args: [data, FIELD_WAIT_MS]
    }),
    INJECT_TIMEOUT_MS
  );
  if (!injection || !injection.result) throw new Error('empty_result');
  return injection.result;
}

async function fillNow(tabId, data) {
  if (inFlight.has(tabId)) return { status: 'error', code: 'busy' };
  inFlight.add(tabId);
  try {
    const result = await runFill(tabId, data);
    return { status: 'done', result };
  } catch (err) {
    return { status: 'error', code: errorCode(err) };
  } finally {
    inFlight.delete(tabId);
  }
}

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function ensureSweepAlarm() {
  const existing = await chrome.alarms.get(SWEEP_ALARM);
  if (!existing) await chrome.alarms.create(SWEEP_ALARM, { periodInMinutes: 1 });
}

async function sweep() {
  const remaining = await store.sweep();
  if (remaining === 0) await chrome.alarms.clear(SWEEP_ALARM);
}

async function handleFill(msg) {
  const tabId = Number(msg.tabId);
  if (!Number.isInteger(tabId) || tabId < 0) return { status: 'error', code: 'no_tab' };

  const check = NviValidation.validateAll(msg.data);
  if (!check.ok) return { status: 'error', code: 'invalid', errors: check.errors };

  let tab;
  try { tab = await chrome.tabs.get(tabId); } catch (e) { return { status: 'error', code: 'tab_closed' }; }

  // Yükleme sırasında tab.url henüz eski adres (ör. about:blank) olabilir;
  // gidilmekte olan adres pendingUrl'dedir.
  const urlState = classifyUrl(tab.status === 'complete' ? tab.url : (tab.pendingUrl || tab.url));
  if (urlState !== 'ok') return { status: 'error', code: urlState };

  if (tab.status !== 'complete') {
    const { expiresAt } = await store.put(tabId, check.normalized);
    await ensureSweepAlarm();
    // Yarış: sekme, kayıt yazılırken yüklenmeyi bitirmiş olabilir.
    const again = await chrome.tabs.get(tabId).catch(() => null);
    if (again && again.status === 'complete' && classifyUrl(again.url) === 'ok' && !inFlight.has(tabId)) {
      const data = await store.take(tabId);
      if (data) return fillNow(tabId, data);
    }
    return { status: 'queued', expiresAt };
  }
  return fillNow(tabId, check.normalized);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Yalnızca eklentinin kendi panelinden gelen mesajlar kabul edilir.
  if (sender.id !== chrome.runtime.id || !sender.url || !sender.url.startsWith(PANEL_URL)) return false;
  if (!msg || typeof msg.type !== 'string') return false;

  if (msg.type === 'nvi:fill') {
    handleFill(msg).then(sendResponse, () => sendResponse({ status: 'error', code: 'internal' }));
    return true;
  }
  if (msg.type === 'nvi:cancel') {
    store.drop(Number(msg.tabId)).then(() => sendResponse({ status: 'cancelled' }), () => sendResponse({ status: 'error', code: 'internal' }));
    return true;
  }
  return false;
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete') return;
  (async () => {
    if (!(await store.has(tabId))) return;
    const state = classifyUrl(tab.url);
    if (state !== 'ok') {
      await store.drop(tabId);
      broadcast({ type: 'nvi:result', tabId, status: 'error', code: state === 'wrong_module' ? 'wrong_module' : 'navigated_away' });
      return;
    }
    const data = await store.take(tabId);
    // null: süresi dolmuş ya da kayıt başka bir yol (yarış kontrolü) tarafından
    // alınmış. Panel kendi TTL zamanlayıcısıyla "süre doldu" gösterir.
    if (!data) return;
    broadcast(Object.assign({ type: 'nvi:result', tabId }, await fillNow(tabId, data)));
  })().catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  store.drop(tabId).catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SWEEP_ALARM) sweep().catch(() => {});
});

// Service worker her uyandığında artakalan süresi geçmiş kayıtları temizle.
sweep().catch(() => {});
