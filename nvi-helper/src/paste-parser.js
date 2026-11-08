/*
 * Görevlinin yapıştırdığı serbest metinden (mesaj, e-posta, tablo satırı) dört
 * alanı ayrıştırır. Sonuç yalnızca panel alanlarını doldurur; aktarım için
 * görevlinin kontrol edip düğmeye basması gerekir.
 *
 * Öncelik: etiketli değerler ("Ad: ...") > sekmeyle ayrılmış başlık+değer satırları
 * > etiketsiz tahmin. Tahmin edilen alanlar "guessed" olarak işaretlenir.
 * Birden fazla aday varsa (ör. iki geçerli T.C. Kimlik No) alan boş bırakılır.
 */
(function (root) {
  'use strict';

  const TR_MAP = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };
  function norm(text) {
    return String(text || '').replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => TR_MAP[c]).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  const LABELS = {
    tckn: ['tckimlikno', 'tckimliknumarasi', 'tckn', 'tcno', 'tc', 'kimlikno', 'kimliknumarasi', 'tckimlik'],
    ad: ['ad', 'adi', 'isim', 'isimi', 'ismi'],
    soyad: ['soyad', 'soyadi', 'soyisim', 'soyismi'],
    adSoyad: ['adsoyad', 'adisoyadi', 'adsoyadi', 'isimsoyisim', 'adivesoyadi', 'advesoyad', 'musteri', 'musteriadi'],
    dogumYili: ['dogumyili', 'dogumyil', 'dyili'],
    dogumTarihi: ['dogumtarihi', 'dtarihi', 'dogum']
  };

  function labelKind(label) {
    const n = norm(label);
    for (const [kind, list] of Object.entries(LABELS)) if (list.includes(n)) return kind;
    return null;
  }

  function tcknValid(s) {
    if (!/^[1-9]\d{10}$/.test(s)) return false;
    const d = s.split('').map(Number);
    const odd = d[0] + d[2] + d[4] + d[6] + d[8];
    const even = d[1] + d[3] + d[5] + d[7];
    return d[9] === (((odd * 7 - even) % 10) + 10) % 10 && d[10] === d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  }

  function yearFrom(value, now) {
    const s = String(value).trim();
    const current = (now || new Date()).getFullYear();
    let m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
    const y = m ? Number(m[3]) : (/^\d{4}$/.test(s) ? Number(s) : NaN);
    return y >= 1900 && y <= current ? String(y) : null;
  }

  function cleanName(s) {
    return String(s).replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[^\p{L}\p{M}' -]/gu, ' ').trim().replace(/\s+/g, ' ');
  }

  function splitFullName(full) {
    const words = cleanName(full).split(' ').filter(Boolean);
    if (words.length < 2) return null;
    return { ad: words.slice(0, -1).join(' '), soyad: words[words.length - 1] };
  }

  function apply(out, kind, value, how, now) {
    const v = String(value || '').trim();
    if (!v) return;
    if (kind === 'tckn') {
      const digits = v.replace(/\s+/g, '');
      if (/^\d{11}$/.test(digits)) set(out, 'tckn', digits, how);
    } else if (kind === 'ad' || kind === 'soyad') {
      const n = cleanName(v);
      if (n) set(out, kind, n, how);
    } else if (kind === 'adSoyad') {
      const parts = splitFullName(v);
      if (parts) {
        // Birden fazla ad varsa son kelimenin soyad olduğu varsayılır: kontrol gerekir.
        const h = cleanName(v).split(' ').length > 2 ? 'guessed' : how;
        set(out, 'ad', parts.ad, h);
        set(out, 'soyad', parts.soyad, h);
      }
    } else if (kind === 'dogumYili' || kind === 'dogumTarihi') {
      const y = yearFrom(v, now);
      if (y) set(out, 'dogumYili', y, how);
    }
  }

  function set(out, field, value, how) {
    if (out.fields[field] !== undefined) return; // ilk bulunan (daha güvenilir kaynak) kazanır
    out.fields[field] = value;
    out.source[field] = how;
  }

  function parseCustomerText(text, now) {
    const out = { fields: {}, source: {}, warnings: [] };
    const raw = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!raw) return out;
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1) Sekmeyle ayrılmış başlık + değer satırı (tablodan kopyalama).
    for (let i = 0; i + 1 < lines.length; i++) {
      const head = lines[i].split('\t');
      const vals = lines[i + 1].split('\t');
      if (head.length > 1 && head.length === vals.length && head.some(labelKind)) {
        head.forEach((h, j) => { const k = labelKind(h); if (k) apply(out, k, vals[j], 'labeled', now); });
      }
    }

    // 2) "Etiket: değer" parçaları (satır, ; | ve sekme ayraçlı).
    for (const part of raw.split(/[\n;|\t]+|,\s+(?=[^,:]{1,30}:)/)) {
      const m = /^\s*([^:=]{1,40}?)\s*[:=]\s*(.+?)\s*$/.exec(part);
      if (!m) continue;
      const k = labelKind(m[1]);
      if (k) apply(out, k, m[2], 'labeled', now);
    }

    // 3) Etiketsiz tahmin: yalnızca etiketle bulunamayan alanlar için.
    const tcknCands = [...new Set((raw.match(/(?<!\d)\d{11}(?!\d)/g) || []).filter(tcknValid))];
    if (out.fields.tckn === undefined) {
      if (tcknCands.length === 1) set(out, 'tckn', tcknCands[0], 'guessed');
      else if (tcknCands.length > 1) out.warnings.push('multiple_tckn');
    }
    if (out.fields.dogumYili === undefined) {
      const dates = raw.match(/(?<!\d)\d{1,2}[./-]\d{1,2}[./-]\d{4}(?!\d)/g) || [];
      const fromDates = [...new Set(dates.map((d) => yearFrom(d, now)).filter(Boolean))];
      const bare = [...new Set((raw.replace(/(?<!\d)\d{1,2}[./-]\d{1,2}[./-]\d{4}(?!\d)/g, ' ').match(/(?<!\d)\d{4}(?!\d)/g) || [])
        .map((y) => yearFrom(y, now)).filter(Boolean))];
      const years = fromDates.length ? fromDates : bare;
      if (years.length === 1) set(out, 'dogumYili', years[0], 'guessed');
      else if (years.length > 1) out.warnings.push('multiple_years');
    }
    if (out.fields.ad === undefined && out.fields.soyad === undefined) {
      // Etiketsiz metinde, sayı ve etiket içermeyen ilk satırı ad soyad say.
      const nameLine = lines.find((l) => !/[\d:=@]/.test(l) && cleanName(l).split(' ').length >= 2 && cleanName(l).split(' ').length <= 5);
      const parts = nameLine && splitFullName(nameLine);
      if (parts) { set(out, 'ad', parts.ad, 'guessed'); set(out, 'soyad', parts.soyad, 'guessed'); }
    }
    if (Object.values(out.source).includes('guessed')) out.warnings.push('check_guessed');
    return out;
  }

  const api = { parseCustomerText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NviPasteParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
