'use strict';
// Biçim kontrolleri. Bunlar gerçek kimlik doğrulaması DEĞİLDİR.
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/validation.js');
const { makeTckn } = require('./helpers.cjs');

const NOW = new Date('2026-11-08T12:00:00Z');
const GOOD = makeTckn('123456789');

test('geçerli kontrol basamakları kabul edilir', () => {
  assert.equal(GOOD.length, 11);
  assert.deepEqual(V.validateTckn(GOOD), { ok: true, value: GOOD });
  assert.equal(V.validateTckn(' ' + GOOD.slice(0, 5) + ' ' + GOOD.slice(5) + ' ').ok, true, 'boşluklar temizlenir');
  assert.equal(V.validateTckn('10000000146').ok, true, 'bilinen test numarası');
});

test('T.C. Kimlik No hata kodları', () => {
  assert.equal(V.validateTckn('').code, 'required');
  assert.equal(V.validateTckn(null).code, 'required');
  assert.equal(V.validateTckn('1234567890').code, 'tckn_format');
  assert.equal(V.validateTckn('123456789012').code, 'tckn_format');
  assert.equal(V.validateTckn('12345678a01').code, 'tckn_format');
  assert.equal(V.validateTckn('0' + GOOD.slice(1)).code, 'tckn_first_zero');
  const bad10 = GOOD.slice(0, 9) + ((Number(GOOD[9]) + 1) % 10) + GOOD[10];
  assert.equal(V.validateTckn(bad10).code, 'tckn_checksum');
  const bad11 = GOOD.slice(0, 10) + ((Number(GOOD[10]) + 1) % 10);
  assert.equal(V.validateTckn(bad11).code, 'tckn_checksum');
});

test('her tek hane değişikliği kontrol basamağıyla yakalanır', () => {
  for (let i = 0; i < 9; i++) {
    for (let delta = 1; delta < 10; delta++) {
      const d = GOOD.split('');
      d[i] = String((Number(d[i]) + delta) % 10);
      const s = d.join('');
      if (s[0] === '0') continue;
      assert.equal(V.validateTckn(s).ok, false, `hane ${i} +${delta}`);
    }
  }
});

test('ad/soyad: Türkçe karakterler, boşluk normalizasyonu ve hatalar', () => {
  assert.deepEqual(V.validateName('  Çağrı   Işıl '), { ok: true, value: 'Çağrı Işıl' });
  assert.equal(V.validateName("O'Neil-Şahin").ok, true);
  assert.equal(V.validateName('').code, 'required');
  assert.equal(V.validateName('   ').code, 'required');
  assert.equal(V.validateName('Ali3').code, 'name_chars');
  assert.equal(V.validateName('<script>').code, 'name_chars');
  assert.equal(V.validateName('-Ali').code, 'name_chars');
  assert.equal(V.validateName('a'.repeat(51)).code, 'name_length');
});

test('doğum yılı', () => {
  assert.equal(V.validateBirthYear('1985', NOW).ok, true);
  assert.equal(V.validateBirthYear('2026', NOW).ok, true);
  assert.equal(V.validateBirthYear('2027', NOW).code, 'year_range');
  assert.equal(V.validateBirthYear('1899', NOW).code, 'year_range');
  assert.equal(V.validateBirthYear('85', NOW).code, 'year_format');
  assert.equal(V.validateBirthYear('19a5', NOW).code, 'year_format');
  assert.equal(V.validateBirthYear('', NOW).code, 'required');
});

test('tarih doğrulaması: takvim, artık yıl, gelecek', () => {
  assert.deepEqual(V.validateDate('29.02.2024', NOW), { ok: true, value: '29.02.2024' });
  assert.equal(V.validateDate('29/02/2024', NOW).value, '29.02.2024', 'ayraç normalize edilir');
  assert.equal(V.validateDate('29.02.2023', NOW).code, 'date_invalid');
  assert.equal(V.validateDate('31.04.2000', NOW).code, 'date_invalid');
  assert.equal(V.validateDate('00.01.2000', NOW).code, 'date_invalid');
  assert.equal(V.validateDate('15.13.2000', NOW).code, 'date_invalid');
  assert.equal(V.validateDate('08.11.2026', NOW).ok, true, 'bugün geçerli');
  assert.equal(V.validateDate('09.11.2026', NOW).code, 'date_future');
  assert.equal(V.validateDate('31.12.1899', NOW).code, 'date_range');
  assert.equal(V.validateDate('2000-01-01', NOW).code, 'date_format');
  assert.equal(V.validateDate('', NOW).code, 'required');
});

test('validateAll normalize eder ve tüm hataları toplar', () => {
  const ok = V.validateAll({ tckn: GOOD, ad: ' Ayşe ', soyad: 'Yılmaz', dogumYili: '1990' }, NOW);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.normalized, { tckn: GOOD, ad: 'Ayşe', soyad: 'Yılmaz', dogumYili: '1990' });
  const bad = V.validateAll({ tckn: '1', ad: '', soyad: 'X1', dogumYili: '3000' }, NOW);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors, { tckn: 'tckn_format', ad: 'required', soyad: 'name_chars', dogumYili: 'year_range' });
  assert.equal(V.validateAll(undefined, NOW).ok, false);
});

test('her hata kodunun Türkçe mesajı var', () => {
  for (const code of Object.keys(V.MESSAGES)) assert.ok(V.message(code).length > 5);
  assert.equal(V.message('bilinmeyen'), 'Geçersiz değer.');
});
