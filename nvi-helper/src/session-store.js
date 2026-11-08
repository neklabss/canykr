/*
 * Sekmeye bağlı, kısa ömürlü bekleyen doldurma kayıtları.
 *
 * Yalnızca görevli veriyi gönderdiğinde NVI sekmesi henüz yüklenmemişse kayıt
 * tutulur. Kayıt; doldurma yapıldığında, sekme kapandığında, sekme NVI dışına
 * gittiğinde veya TTL dolduğunda silinir. Depolama olarak chrome.storage.session
 * (yalnızca bellekte, diske yazılmaz, tarayıcı kapanınca silinir) kullanılır.
 *
 * storage: chrome.storage.session ile uyumlu { get(key), set(obj), remove(key) }
 */
(function (root) {
  'use strict';

  const PREFIX = 'pending:';
  const DEFAULT_TTL_MS = 2 * 60 * 1000;

  function createStore({ storage, now = () => Date.now(), ttlMs = DEFAULT_TTL_MS }) {
    const key = (tabId) => PREFIX + tabId;

    async function put(tabId, data) {
      const expiresAt = now() + ttlMs;
      await storage.set({ [key(tabId)]: { data, expiresAt } });
      return { expiresAt };
    }

    // Kaydı okur ve siler (tek kullanımlık). Süresi geçmişse null döner.
    async function take(tabId) {
      const k = key(tabId);
      const got = await storage.get(k);
      const entry = got && got[k];
      if (!entry) return null;
      await storage.remove(k);
      if (entry.expiresAt <= now()) return null;
      return entry.data;
    }

    async function has(tabId) {
      const k = key(tabId);
      const got = await storage.get(k);
      const entry = got && got[k];
      return !!entry && entry.expiresAt > now();
    }

    async function drop(tabId) {
      await storage.remove(key(tabId));
    }

    // Süresi geçmiş kayıtları siler; kalan kayıt sayısını döner.
    async function sweep() {
      const all = (await storage.get(null)) || {};
      const t = now();
      let remaining = 0;
      for (const [k, entry] of Object.entries(all)) {
        if (!k.startsWith(PREFIX)) continue;
        if (!entry || entry.expiresAt <= t) await storage.remove(k);
        else remaining += 1;
      }
      return remaining;
    }

    return { put, take, has, drop, sweep };
  }

  const api = { createStore, DEFAULT_TTL_MS, PREFIX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NviSessionStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
