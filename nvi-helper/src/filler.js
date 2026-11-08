/*
 * NVI T.C. Kimlik No Doğrulama formu için alan eşleştirme ve doldurma.
 *
 * Kurallar:
 *  - Yalnızca dört alan doldurulur: T.C. Kimlik No, Ad, Soyad, Doğum Yılı.
 *  - Güvenlik kodu (CAPTCHA) alanına ve gönder düğmesine asla dokunulmaz.
 *  - Dolu bir alanın değeri korunur (üzerine yazılmaz).
 *  - Birden fazla adayı eşit puanlı olan alan "belirsiz" sayılır ve atlanır.
 *  - readonly / disabled alanlar (ör. sanal klavye açıkken) zorla değiştirilmez.
 *  - Sonuç nesnesinde hiçbir kişisel değer yer almaz; yalnızca durum kodları döner.
 *
 * SEÇİCİLER CANLI NVI DOM'U ÜZERİNDE DOĞRULANMAMIŞTIR. Eşleştirme id/name yerine
 * etiket, placeholder ve aria metinlerine dayanır ki küçük DOM değişikliklerine
 * dayanıklı olsun. Canlı DOM incelendiğinde FIELD_RULES güncellenmelidir.
 */
(function (root) {
  'use strict';
  if (root.NviFiller && root.NviFiller.version >= 2) return;

  const TR_MAP = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };

  function norm(text) {
    return String(text || '')
      .replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => TR_MAP[c])
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  // exact: normalize edilmiş metin bununla birebir eşleşirse güçlü aday (3 puan).
  // contains: metin bunu içeriyorsa zayıf aday (1 puan), exclude içermiyorsa.
  const FIELD_RULES = {
    tckn: {
      exact: ['tckimlikno', 'tckimliknumarasi', 'tckimliknumaraniz', 'kimlikno', 'kimliknumarasi', 'tcno', 'tckn', 'tckimlik', 'tcknno', 'tckimliknogiriniz'],
      contains: ['tckimlik', 'kimlikno', 'kimliknumara', 'tckn'],
      exclude: ['seri', 'belge', 'anne', 'baba']
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
    dogumYili: {
      exact: ['dogumyili', 'dogumyiliniz', 'dogumyil', 'birthyear', 'dogumyiligiriniz', 'txtdogumyili'],
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

  function descriptors(el) {
    return {
      labels: labelTexts(el).map(norm).filter(Boolean),
      attrs: [el.id, el.name, el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('title')]
        .map(norm)
        .filter(Boolean)
    };
  }

  function isForbidden(desc) {
    const all = desc.labels.concat(desc.attrs);
    return all.some((t) => FORBIDDEN.some((w) => t.includes(w)));
  }

  function scoreFor(rule, desc) {
    let best = 0;
    for (const t of desc.labels.concat(desc.attrs)) {
      if (rule.exclude.some((x) => t.includes(x))) continue;
      if (rule.exact.includes(t)) best = Math.max(best, 3);
      else if (rule.contains.some((c) => t.includes(c))) best = Math.max(best, 1);
    }
    return best;
  }

  function candidates(doc) {
    return Array.from(doc.querySelectorAll('input')).filter(
      (el) => FILLABLE_TYPES.has((el.getAttribute('type') || '').toLowerCase()) && isVisible(el)
    );
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

  function detectVirtualKeyboard(doc) {
    for (const cb of doc.querySelectorAll('input[type="checkbox"]')) {
      const d = descriptors(cb);
      if (d.labels.concat(d.attrs).some((t) => t.includes('sanalklavye')) && cb.checked) return true;
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

  function fillOne(el, value) {
    if (el.disabled) return 'disabled';
    if (el.readOnly) return 'readonly';
    const current = el.value.trim();
    if (current === value) return 'unchanged';
    if (current !== '') return 'kept';
    if (el.maxLength > 0 && value.length > el.maxLength) return 'too_long';
    setValue(el, value);
    return el.value === value ? 'filled' : 'rejected';
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
   * data: { tckn, ad, soyad, dogumYili } (önceden doğrulanmış olmalı)
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
    for (const field of Object.keys(FIELD_RULES)) {
      const r = resolved[field];
      const value = data && data[field] != null ? String(data[field]) : '';
      if (!r.el) { fields[field] = { status: r.status }; continue; }
      if (!value) { fields[field] = { status: 'no_value' }; continue; }
      let status;
      try { status = fillOne(r.el, value); } catch (e) { status = 'error'; }
      if (status === 'filled') filledCount += 1;
      fields[field] = { status };
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

  const api = { version: 2, fill, probe, resolveFields, norm, FIELD_RULES, FORBIDDEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NviFiller = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
