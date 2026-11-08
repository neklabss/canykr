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
    date_range: 'Tarih 1900 yılından önce olamaz.'
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

  // GG.AA.YYYY (ayraç olarak . / - kabul edilir). Panel şu an yalnızca yıl ister;
  // tarih kontrolü ileride tam doğum tarihi isteyen formlar için hazır tutulur.
  function validateDate(input, now) {
    const value = String(input == null ? '' : input).trim();
    if (!value) return { ok: false, code: 'required' };
    const m = /^(\d{2})[./-](\d{2})[./-](\d{4})$/.exec(value);
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
    return { ok: true, value: m[1] + '.' + m[2] + '.' + m[3] };
  }

  const FIELDS = ['tckn', 'ad', 'soyad', 'dogumYili'];

  function validateAll(data, now) {
    const src = data || {};
    const checks = {
      tckn: validateTckn(src.tckn),
      ad: validateName(src.ad),
      soyad: validateName(src.soyad),
      dogumYili: validateBirthYear(src.dogumYili, now)
    };
    const errors = {};
    const normalized = {};
    for (const f of FIELDS) {
      if (checks[f].ok) normalized[f] = checks[f].value;
      else errors[f] = checks[f].code;
    }
    return { ok: Object.keys(errors).length === 0, errors, normalized };
  }

  function message(code) {
    return MESSAGES[code] || 'Geçersiz değer.';
  }

  const api = { validateTckn, validateName, normalizeName, validateBirthYear, validateDate, validateAll, message, FIELDS, MESSAGES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NviValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
