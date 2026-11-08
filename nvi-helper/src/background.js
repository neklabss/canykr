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
importScripts('validation.js', 'session-store.js', 'nvi-url.js');

const FIELD_WAIT_MS = 8000;
const SWEEP_ALARM = 'nvi-sweep';
const PANEL_URL = chrome.runtime.getURL('src/panel.html');

const store = NviSessionStore.createStore({ storage: chrome.storage.session });
const inFlight = new Set();

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

const classifyUrl = NviUrl.classifyUrl;

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

const PROBE_INTERVAL_MS = 400;
const CALL_TIMEOUT_MS = 4000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Formu taşıyan çerçeveyi bulur. Tüm erişilebilir çerçevelere (ana sayfa ve
// NVI host'undaki iframe'ler) filler.js enjekte edilir, değer göndermeden
// yalnızca alan sayıları sorulur. Alanlar geç yüklenirse süre dolana kadar yoklanır.
async function locateFrame(tabId) {
  const deadline = Date.now() + FIELD_WAIT_MS;
  for (;;) {
    const target = { tabId, allFrames: true };
    await withTimeout(chrome.scripting.executeScript({ target, files: ['src/filler.js'] }), CALL_TIMEOUT_MS);
    const results = await withTimeout(
      chrome.scripting.executeScript({ target, func: () => globalThis.NviFiller.probe() }),
      CALL_TIMEOUT_MS
    );
    const withFields = results.filter((r) => r.result && r.result.found + r.result.ambiguous > 0);
    const complete = withFields.filter((r) => r.result.missing === 0);
    const timedOut = Date.now() >= deadline;
    if (complete.length === 1 && withFields.length === 1) return { frameId: complete[0].frameId, timedOut: false };
    if (withFields.length > 1 && (complete.length > 1 || timedOut)) return { error: 'multiple_forms' };
    if (timedOut) {
      // Kısmi form tek çerçevedeyse orada doldur (eksikler "missing" döner);
      // hiç yoksa ana çerçevede doldurmayı dene ki alan bazında sonuç oluşsun.
      return { frameId: withFields.length === 1 ? withFields[0].frameId : 0, timedOut: true };
    }
    await sleep(PROBE_INTERVAL_MS);
  }
}

async function runFill(tabId, data) {
  const located = await withTimeout(locateFrame(tabId), FIELD_WAIT_MS + CALL_TIMEOUT_MS * 2);
  if (located.error) return { error: located.error };
  const [injection] = await withTimeout(
    chrome.scripting.executeScript({
      target: { tabId, frameIds: [located.frameId] },
      func: (d) => globalThis.NviFiller.fill(d, { timeoutMs: 0 }),
      args: [data]
    }),
    CALL_TIMEOUT_MS
  );
  if (!injection || !injection.result) throw new Error('empty_result');
  const result = injection.result;
  result.timedOut = located.timedOut && Object.values(result.fields).some((f) => f.status === 'missing');
  result.inFrame = located.frameId !== 0;
  return result;
}

async function fillNow(tabId, data) {
  if (inFlight.has(tabId)) return { status: 'error', code: 'busy' };
  inFlight.add(tabId);
  try {
    const result = await runFill(tabId, data);
    if (result.error) return { status: 'error', code: result.error };
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
