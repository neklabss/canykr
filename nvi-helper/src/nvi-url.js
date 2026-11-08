/*
 * Hedef sekme adresinin NVI T.C. Kimlik No Doğrulama sayfası olup olmadığını söyler.
 * Service worker (asıl kontrol) ve panel (yalnızca bilgilendirme göstergesi) paylaşır.
 *
 * CANLI ORTAMDA DOĞRULANMADI: modül yolu topluluk kaynaklarından alındı.
 */
(function (root) {
  'use strict';

  const NVI_HOST = 'tckimlik.nvi.gov.tr';
  const NVI_MODULE_PATH = '/modul/tckimliknodogrula';

  // 'ok' | 'wrong_module' | 'not_nvi_page'
  function classifyUrl(url) {
    if (!url) return 'not_nvi_page';
    let u;
    try { u = new URL(url); } catch (e) { return 'not_nvi_page'; }
    if (u.protocol !== 'https:' || u.hostname !== NVI_HOST) return 'not_nvi_page';
    if (!u.pathname.toLowerCase().startsWith(NVI_MODULE_PATH)) return 'wrong_module';
    return 'ok';
  }

  const api = { classifyUrl, NVI_HOST, NVI_MODULE_PATH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NviUrl = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
