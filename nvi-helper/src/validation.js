/*
 * Yerel biçim kontrolleri. Bunlar KİMLİK DOĞRULAMASI DEĞİLDİR: yalnızca yazım
 * hatalarını NVI formuna gitmeden yakalar. Kişinin gerçekten var olup olmadığını
 * yalnızca NVI sorgusu (görevlinin başlattığı) söyleyebilir.
 *
 * Hem tarayıcıda (side panel, service worker, demo) hem Node testlerinde çalışır.
 */
(function (root) {
  'use strict';

  const MESSAGES = {
    required: 'Bu alan zorunludur.',
    tckn_format: 'T.C. Kimlik No 11 haneli ve yalnızca rakamlardan oluşmalıdır.',
    tckn_first_zero: 'T.C. Kimlik No 0 ile başlayamaz.',
    tckn_checksum: 'T.C. Kimlik No kontrol basamakları tutmuyor; numarayı yeniden kontrol edin.',
    name_chars: 'Yalnızca harf, boşluk, kesme işareti ve tire kullanılabilir.',
    name_length: 'En fazla 50 karakter olabilir.',
    year_format: 'Doğum yılı 4 haneli olmalıdır.',
    year_range: 'Doğum yılı 1900 ile bu yıl arasında olmalıdır.',
    date_format: 'Tarih GG.AA.YYYY biçiminde olmalıdır.',
    date_invalid: 'Takvimde böyle bir tarih yok.',
    date_future: 'Tarih gelecekte olamaz.',
    date_range: 'Tarih 1900 yılından önce olamaz.',
    birth_format: 'Doğum tarihini GG.AA.YYYY biçiminde (ör. 05.03.1990) ya da yalnızca yıl olarak girin.'
  };

  function onlyDigits(s) {
    return /^[0-9]+$/.test(s);
  }

  function validateTckn(input) {
    const value = String(input == null ? '' : input).replace(/\s+/g, '');
    if (!value) return { ok: false, code: 'required' };
    if (value.length !== 11 || !onlyDigits(value)) return { ok: false, code: 'tckn_format' };
    if (value[0] === '0') return { ok: false, code: 'tckn_first_zero' };
    const d = value.split('').map(Number);
    const odd = d[0] + d[2] + d[4] + d[6] + d[8];
    const even = d[1] + d[3] + d[5] + d[7];
    const d10 = (((odd * 7 - even) % 10) + 10) % 10;
    const d11 = (d.slice(0, 10).reduce((a, b) => a + b, 0)) % 10;
    if (d[9] !== d10 || d[10] !== d11) return { ok: false, code: 'tckn_checksum' };
    return { ok: true, value };
  }

  function normalizeName(input) {
    return String(input == null ? '' : input).trim().replace(/\s+/g, ' ');
  }

  // Türkçe ve diğer Latin harfleri; kesme işareti ve tireye izin verilir.
  const NAME_RE = /^[\p{L}][\p{L}\p{M}' .-]*$/u;

  function validateName(input) {
    const value = normalizeName(input);
    if (!value) return { ok: false, code: 'required' };
    if (value.length > 50) return { ok: false, code: 'name_length' };
    if (!NAME_RE.test(value)) return { ok: false, code: 'name_chars' };
    return { ok: true, value };
  }

  function validateBirthYear(input, now) {
    const value = String(input == null ? '' : input).trim();
    if (!value) return { ok: false, code: 'required' };
    if (value.length !== 4 || !onlyDigits(value)) return { ok: false, code: 'year_format' };
    const year = Number(value);
    const current = (now || new Date()).getFullYear();
    if (year < 1900 || year > current) return { ok: false, code: 'year_range' };
    return { ok: true, value };
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  // GG.AA.YYYY (ayraç olarak . / - kabul edilir; gün ve ay tek haneli olabilir).
  function validateDate(input, now) {
    const value = String(input == null ? '' : input).trim();
    if (!value) return { ok: false, code: 'required' };
    const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value);
    if (!m) return { ok: false, code: 'date_format' };
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return { ok: false, code: 'date_invalid' };
    }
    if (year < 1900) return { ok: false, code: 'date_range' };
    const n = now || new Date();
    const today = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
    if (date.getTime() > today) return { ok: false, code: 'date_future' };
    return { ok: true, value: pad2(day) + '.' + pad2(month) + '.' + m[3], parts: { gun: pad2(day), ay: pad2(month), yil: m[3] } };
  }

  // NVI formu doğum gününü, ayını ve yılını ayrı alanlarda ister. Görevli tam tarihi
  // (GG.AA.YYYY) ya da yalnızca yılı girebilir; yalnızca yıl girilirse gün ve ay
  // NVI sayfasında elle tamamlanır.
  function validateBirthDate(input, now) {
    const value = String(input == null ? '' : input).trim();
    if (!value) return { ok: false, code: 'required' };
    if (/^\d{4}$/.test(value)) {
      const y = validateBirthYear(value, now);
      return y.ok ? { ok: true, value, parts: { gun: '', ay: '', yil: value } } : y;
    }
    if (!/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(value)) return { ok: false, code: 'birth_format' };
    return validateDate(value, now);
  }

  // Panel alanları. Doldurulacak sayfa alanları: tckn, ad, soyad, dogumGun, dogumAy, dogumYili.
  const FIELDS = ['tckn', 'ad', 'soyad', 'dogumTarihi'];
  const FILL_FIELDS = ['tckn', 'ad', 'soyad', 'dogumGun', 'dogumAy', 'dogumYili'];

  // Panel verisini ({ ..., dogumTarihi }) ya da service worker'a giden ayrıştırılmış
  // veriyi ({ ..., dogumGun, dogumAy, dogumYili }) doğrular; her ikisinde de
  // normalized, FILL_FIELDS biçimindedir. Hata anahtarı panel alanı (dogumTarihi) olur.
  function validateAll(data, now) {
    const src = data || {};
    let birth = src.dogumTarihi;
    if (birth === undefined && src.dogumYili !== undefined) {
      birth = src.dogumGun || src.dogumAy ? `${src.dogumGun || ''}.${src.dogumAy || ''}.${src.dogumYili}` : src.dogumYili;
    }
    const checks = {
      tckn: validateTckn(src.tckn),
      ad: validateName(src.ad),
      soyad: validateName(src.soyad),
      dogumTarihi: validateBirthDate(birth, now)
    };
    const errors = {};
    const normalized = {};
    for (const f of FIELDS) {
      if (!checks[f].ok) { errors[f] = checks[f].code; continue; }
      if (f === 'dogumTarihi') {
        normalized.dogumGun = checks[f].parts.gun;
        normalized.dogumAy = checks[f].parts.ay;
        normalized.dogumYili = checks[f].parts.yil;
      } else normalized[f] = checks[f].value;
    }
    return { ok: Object.keys(errors).length === 0, errors, normalized };
  }

  function message(code) {
    return MESSAGES[code] || 'Geçersiz değer.';
  }

  const api = { validateTckn, validateName, normalizeName, validateBirthYear, validateDate, validateBirthDate, validateAll, message, FIELDS, FILL_FIELDS, MESSAGES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NviValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
