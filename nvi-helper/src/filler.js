/*
 * NVI T.C. Kimlik No Doğrulama formu için alan eşleştirme ve doldurma.
 *
 * Kurallar:
 *  - Yalnızca altı alan doldurulur: T.C. Kimlik No, Adı, Soyad, Doğum Gün, Doğum Ay,
 *    Doğum Yılı. Nüfus cüzdanı / kimlik kartı seri no gibi isteğe bağlı alanlara ve
 *    "Soyadı Nüfus Kayıtlarında Yok" kutusuna dokunulmaz.
 *  - Güvenlik kodu (CAPTCHA) alanına ve gönder düğmesine asla dokunulmaz.
 *  - Dolu bir alanın değeri korunur (üzerine yazılmaz).
 *  - Birden fazla adayı eşit puanlı olan alan "belirsiz" sayılır ve atlanır.
 *  - readonly / disabled alanlar (ör. sanal klavye açıkken) zorla değiştirilmez.
 *  - Sonuç nesnesinde hiçbir kişisel değer yer almaz; yalnızca durum kodları döner.
 *
 * Canlı sayfanın salt okunur incelemesi (18.11.2026): alanlar <label> ile bağlı
 * (requestTCKimlikNo, requestAd, requestSoyad, requestDogumGun, requestDogumAy,
 * requestDogumYil) ve bu kurallarla altısı da belirsizlik olmadan eşleşiyor. Eşleştirme
 * yine de sabit id'lere değil etikete, id/name/placeholder/aria metnine ve bağlı etiket
 * yoksa alanın hemen önündeki metne dayanır ki sayfa güncellenince kırılmasın.
 */
(function (root) {
  'use strict';
  if (root.NviFiller && root.NviFiller.version >= 5) return;

  // ASCII 'I' de açıkça eşlenir: sayfa String.prototype.toLowerCase'i Türkçe kurala
  // göre değiştirirse ("I" → "ı") normalizasyon bozulmasın (canlı sayfada gözlendi).
  const TR_MAP = { 'I': 'i', 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };

  function norm(text) {
    return String(text || '')
      .replace(/[IıİşŞğĞüÜöÖçÇ]/g, (c) => TR_MAP[c])
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  // exact: normalize edilmiş metin bununla birebir eşleşirse güçlü aday (3 puan).
  // contains: metin bunu içeriyorsa zayıf aday (1 puan), exclude içermiyorsa.
  const FIELD_RULES = {
    tckn: {
      exact: ['tckimlikno', 'tckimliknumarasi', 'tckimliknumaraniz', 'kimlikno', 'kimliknumarasi', 'tcno', 'tckn', 'tckimlik', 'tcknno', 'tckimliknogiriniz'],
      contains: ['tckimlik', 'kimlikno', 'kimliknumara', 'tckn'],
      exclude: ['seri', 'belge', 'gecici', 'anne', 'baba']
    },
    ad: {
      exact: ['ad', 'adi', 'adiniz', 'isim', 'isminiz', 'adgiriniz', 'name', 'firstname', 'txtad'],
      contains: ['adiniz', 'isim'],
      exclude: ['soyad', 'soyisim', 'anne', 'baba', 'kullanici', 'adres', 'adet', 'eposta']
    },
    soyad: {
      exact: ['soyad', 'soyadi', 'soyadiniz', 'soyisim', 'soyisminiz', 'surname', 'lastname', 'soyadgiriniz', 'txtsoyad'],
      contains: ['soyad', 'soyisim'],
      exclude: ['anne', 'baba', 'kizlik', 'onceki']
    },
    dogumGun: {
      exact: ['dogumgun', 'dogumgunu', 'gun', 'birthday', 'txtdogumgun'],
      contains: ['dogumgun'],
      exclude: ['ay', 'yil', 'tarih']
    },
    dogumAy: {
      exact: ['dogumay', 'dogumayi', 'ay', 'birthmonth', 'txtdogumay'],
      contains: ['dogumay'],
      exclude: ['gun', 'yil', 'tarih']
    },
    dogumYili: {
      exact: ['dogumyili', 'dogumyiliniz', 'dogumyil', 'yil', 'birthyear', 'dogumyiligiriniz', 'txtdogumyili'],
      contains: ['dogumyil'],
      exclude: ['gun', 'ay', 'tarih']
    }
  };

  // Bu kelimeleri taşıyan alanlar hiçbir koşulda doldurulmaz.
  const FORBIDDEN = ['captcha', 'guvenlik', 'dogrulamakodu', 'kod', 'resimdeki', 'sifre', 'password'];

  const FILLABLE_TYPES = new Set(['', 'text', 'tel', 'number', 'search']);

  function isVisible(el) {
    if (!el.isConnected) return false;
    const style = el.ownerDocument.defaultView.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return el.getClientRects().length > 0;
  }

  function labelTexts(el) {
    const doc = el.ownerDocument;
    const texts = [];
    if (el.id) {
      for (const l of doc.querySelectorAll('label[for]')) {
        if (l.htmlFor === el.id) texts.push(l.textContent);
      }
    }
    const wrap = el.closest('label');
    if (wrap) texts.push(wrap.textContent);
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      for (const id of by.split(/\s+/)) {
        const n = doc.getElementById(id);
        if (n) texts.push(n.textContent);
      }
    }
    return texts;
  }

  function isFillable(el) {
    return el.tagName === 'INPUT' && FILLABLE_TYPES.has((el.getAttribute('type') || '').toLowerCase());
  }

  // Bağlı etiket yoksa: alanın (ya da en fazla 4 üst öğesinin) önündeki kardeş
  // metni etiket say. Aradaki kardeşlerden biri başka bir doldurulabilir alan
  // içeriyorsa o metin ona aittir ve aramayı durdururuz.
  function nearText(el) {
    let node = el;
    for (let depth = 0; depth < 4 && node.parentElement; depth++) {
      const before = [];
      for (let sib = node.previousSibling; sib; sib = sib.previousSibling) {
        if (sib.nodeType === 1 && (isFillable(sib) || (sib.querySelector && Array.from(sib.querySelectorAll('input')).some(isFillable)))) {
          return before.length ? before.reverse().join(' ') : '';
        }
        const t = sib.textContent || '';
        if (t.trim()) before.push(t);
      }
      if (before.length) return before.reverse().join(' ');
      node = node.parentElement;
    }
    return '';
  }

  function descriptors(el) {
    const labels = labelTexts(el).map(norm).filter(Boolean);
    return {
      labels,
      near: labels.length ? [] : [norm(nearText(el))].filter(Boolean),
      attrs: [el.id, el.name, el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('title')]
        .map(norm)
        .filter(Boolean)
    };
  }

  function isForbidden(desc) {
    const all = desc.labels.concat(desc.attrs, desc.near);
    return all.some((t) => FORBIDDEN.some((w) => t.includes(w)));
  }

  // Bağlı etiket/özellik birebir eşleşmesi 3, yakın metin birebir eşleşmesi 2,
  // içerme 1 puan. Yakın metin daha zayıf kanıttır; id/name ile çatışırsa onlar kazanır.
  function scoreFor(rule, desc) {
    let best = 0;
    const check = (t, exactScore) => {
      if (rule.exclude.some((x) => t.includes(x))) return;
      if (rule.exact.includes(t)) best = Math.max(best, exactScore);
      else if (rule.contains.some((c) => t.includes(c))) best = Math.max(best, 1);
    };
    for (const t of desc.labels.concat(desc.attrs)) check(t, 3);
    for (const t of desc.near) check(t, 2);
    return best;
  }

  function candidates(doc) {
    return Array.from(doc.querySelectorAll('input')).filter((el) => isFillable(el) && isVisible(el));
  }

  // Her mantıksal alan için { el } | { status: 'missing' | 'ambiguous' } döner.
  function resolveFields(doc) {
    const inputs = candidates(doc).map((el) => ({ el, desc: descriptors(el) })).filter((c) => !isForbidden(c.desc));
    const out = {};
    for (const field of Object.keys(FIELD_RULES)) {
      let top = 0;
      let winners = [];
      for (const c of inputs) {
        const s = scoreFor(FIELD_RULES[field], c.desc);
        if (s === 0) continue;
        if (s > top) { top = s; winners = [c.el]; }
        else if (s === top) winners.push(c.el);
      }
      if (winners.length === 0) out[field] = { status: 'missing' };
      else if (winners.length > 1) out[field] = { status: 'ambiguous', count: winners.length };
      else out[field] = { el: winners[0] };
    }
    // Aynı input iki alana eşlendiyse ikisini de belirsiz say.
    const seen = new Map();
    for (const [field, r] of Object.entries(out)) {
      if (!r.el) continue;
      if (seen.has(r.el)) {
        out[field] = { status: 'ambiguous', count: 2 };
        out[seen.get(r.el)] = { status: 'ambiguous', count: 2 };
      } else seen.set(r.el, field);
    }
    return out;
  }

  // Sanal klavye seçeneği. Canlı sayfada (Kasım 2026): <div class="sanalKlavye"> içinde
  // <label>Sanal Klavye Kullan</label>; tıklanınca div'e "active" sınıfı eklenir ve
  // alanlar salt okunur OLMAZ. Onay kutusu ve aria-pressed biçimleri de desteklenir.
  // Yalnızca bilgi amaçlıdır; doldurmayı engellemez.
  function detectVirtualKeyboard(doc) {
    for (const cb of doc.querySelectorAll('input[type="checkbox"]')) {
      const d = descriptors(cb);
      if (d.labels.concat(d.attrs, d.near).some((t) => t.includes('sanalklavye')) && cb.checked) return true;
    }
    const sel = 'a, button, [role="button"], [role="switch"], [role="checkbox"], [class*="klavye" i], [class*="keyboard" i]';
    for (const el of doc.querySelectorAll(sel)) {
      const names = norm(el.className && typeof el.className === 'string' ? el.className : '') + ' ' +
        norm(el.textContent + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('tooltip') || ''));
      if (!names.includes('sanalklavye')) continue;
      if (el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true' || el.classList.contains('active')) return true;
    }
    return false;
  }

  function setValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
      Object.getOwnPropertyDescriptor(el.ownerDocument.defaultView.HTMLInputElement.prototype, 'value');
    desc.set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Türkçe kurallarla büyük/küçük harf ve baştaki/sondaki boşluk farkını yok sayarak karşılaştırır.
  // (Canlı sayfa ad/soyadı yazıldıktan sonra değiştiriyor; büyük harfe çevirme bunun olası nedeni.)
  function sameText(a, b) {
    return String(a).trim().toLocaleUpperCase('tr-TR') === String(b).trim().toLocaleUpperCase('tr-TR');
  }

  // Yazmadan önceki kontroller. null dönerse alan yazılabilir demektir.
  function precheck(el, value) {
    if (el.disabled) return 'disabled';
    if (el.readOnly) return 'readonly';
    const current = el.value.trim();
    if (current === value || (current && sameText(current, value))) return 'unchanged';
    if (current !== '') return 'kept';
    if (el.maxLength > 0 && value.length > el.maxLength) return 'too_long';
    return null;
  }

  // Yazdıktan sonra sayfanın değere ne yaptığına bakar. Değer döndürmez, yalnızca durum ve neden.
  function verdict(el, value) {
    const now = el.value;
    if (now === value) return { status: 'filled' };
    if (now.trim() === '') return { status: 'rejected', reason: 'cleared' };
    if (sameText(now, value)) return { status: 'filled', reason: 'case_changed' };
    return { status: 'rejected', reason: 'changed' };
  }

  function waitForFields(doc, timeoutMs) {
    return new Promise((resolve) => {
      const done = (timedOut) => {
        observer.disconnect();
        clearTimeout(timer);
        resolve({ resolved: resolveFields(doc), timedOut });
      };
      const allPresent = () => Object.values(resolveFields(doc)).every((r) => r.status !== 'missing');
      const observer = new doc.defaultView.MutationObserver(() => { if (allPresent()) done(false); });
      const timer = setTimeout(() => done(true), timeoutMs);
      if (allPresent()) { done(false); return; }
      observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'type'] });
    });
  }

  /**
   * data: { tckn, ad, soyad, dogumGun, dogumAy, dogumYili } (önceden doğrulanmış olmalı;
   *       dogumGun/dogumAy boş olabilir → "no_value", görevli elle girer)
   * opts: { timeoutMs } — geç yüklenen alanlar için bekleme süresi.
   * Döner: { ok, fields: { [alan]: { status } }, filledCount, virtualKeyboard, timedOut, durationMs }
   */
  async function fill(data, opts) {
    const started = Date.now();
    const doc = (opts && opts.document) || root.document;
    const timeoutMs = Math.max(0, Number((opts && opts.timeoutMs) ?? 8000));
    const { resolved, timedOut } = await waitForFields(doc, timeoutMs);
    const fields = {};
    let filledCount = 0;
    const written = [];
    for (const field of Object.keys(FIELD_RULES)) {
      const r = resolved[field];
      const value = data && data[field] != null ? String(data[field]) : '';
      if (!r.el) { fields[field] = { status: r.status }; continue; }
      if (!value) { fields[field] = { status: 'no_value' }; continue; }
      try {
        const pre = precheck(r.el, value);
        if (pre) { fields[field] = { status: pre }; continue; }
        setValue(r.el, value);
        written.push({ field, el: r.el, value });
      } catch (e) { fields[field] = { status: 'error' }; }
    }
    // Sayfanın kendi betikleri (Angular, maske, büyük harf dönüşümü) değeri hemen ya da
    // bir sonraki turda değiştirebilir; karar vermeden önce kısa bir süre bekle.
    if (written.length) await new Promise((r) => setTimeout(r, Math.max(0, Number((opts && opts.settleMs) ?? 80))));
    for (const w of written) {
      fields[w.field] = verdict(w.el, w.value);
      if (fields[w.field].status === 'filled') filledCount += 1;
    }
    const ok = Object.values(fields).every((f) => f.status === 'filled' || f.status === 'unchanged');
    return {
      ok,
      fields,
      filledCount,
      virtualKeyboard: detectVirtualKeyboard(doc),
      timedOut: timedOut && Object.values(fields).some((f) => f.status === 'missing'),
      durationMs: Date.now() - started
    };
  }

  // Doldurmadan, bu çerçevede kaç alanın bulunduğunu söyler (değer içermez).
  // Service worker bunu tüm çerçevelerde çağırıp formu hangi çerçevenin taşıdığını seçer.
  function probe(opts) {
    const doc = (opts && opts.document) || root.document;
    const resolved = resolveFields(doc);
    const counts = { found: 0, ambiguous: 0, missing: 0 };
    for (const r of Object.values(resolved)) {
      if (r.el) counts.found += 1;
      else counts[r.status] += 1;
    }
    return counts;
  }

  const api = { version: 5, fill, probe, resolveFields, detectVirtualKeyboard, norm, FIELD_RULES, FORBIDDEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NviFiller = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
