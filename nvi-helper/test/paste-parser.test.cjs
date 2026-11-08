'use strict';
// Yapıştırılan serbest metinden alan ayrıştırma. Tüm veriler SENTETİKTİR.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCustomerText: parse } = require('../src/paste-parser.js');
const { makeTckn } = require('./helpers.cjs');

const NOW = new Date('2026-11-08T12:00:00Z');
const T1 = makeTckn('123456789');
const T2 = makeTckn('987654321');

test('etiketli satırlar', () => {
  const r = parse(`T.C. Kimlik No: ${T1}\nAdı: Ayşe Nur\nSoyadı: Yılmaz\nDoğum Tarihi: 05.03.1990`, NOW);
  assert.deepEqual(r.fields, { tckn: T1, ad: 'Ayşe Nur', soyad: 'Yılmaz', dogumYili: '1990' });
  assert.deepEqual(r.source, { tckn: 'labeled', ad: 'labeled', soyad: 'labeled', dogumYili: 'labeled' });
  assert.deepEqual(r.warnings, []);
});

test('tek satırda ; ve virgülle ayrılmış etiketler', () => {
  const r = parse(`TC: ${T1}; Ad: Ali; Soyad: Kaya, Doğum Yılı: 1985`, NOW);
  assert.deepEqual(r.fields, { tckn: T1, ad: 'Ali', soyad: 'Kaya', dogumYili: '1985' });
});

test('"Adı Soyadı" iki kelimeyse etiketli, daha fazlaysa tahmin sayılır', () => {
  let r = parse(`Adı Soyadı: Mehmet Demir\nTC Kimlik No: ${T1}`, NOW);
  assert.equal(r.fields.ad, 'Mehmet');
  assert.equal(r.source.ad, 'labeled');
  r = parse('Ad Soyad: Ayşe Nur Yılmaz', NOW);
  assert.deepEqual([r.fields.ad, r.fields.soyad], ['Ayşe Nur', 'Yılmaz']);
  assert.equal(r.source.soyad, 'guessed');
  assert.ok(r.warnings.includes('check_guessed'));
});

test('tablodan kopyalanan başlık + değer satırı (sekme ayraçlı)', () => {
  const r = parse(`Müşteri No\tAd\tSoyad\tTC Kimlik No\tDoğum Tarihi\n4471\tZeynep\tAk\t${T1}\t1.1.2001`, NOW);
  assert.deepEqual(r.fields, { ad: 'Zeynep', soyad: 'Ak', tckn: T1, dogumYili: '2001' });
  assert.equal(r.source.tckn, 'labeled');
});

test('etiketsiz metinde tahmin ve uyarı', () => {
  const r = parse(`Can Öztürk\n${T1}\n12.12.1979\n0555 000 00 00`, NOW);
  assert.deepEqual(r.fields, { tckn: T1, dogumYili: '1979', ad: 'Can', soyad: 'Öztürk' });
  assert.ok(Object.values(r.source).every((s) => s === 'guessed'));
  assert.deepEqual(r.warnings, ['check_guessed']);
});

test('kontrol basamağı tutmayan 11 haneli sayı (ör. telefon) T.C. sayılmaz', () => {
  const bad = T1.slice(0, 10) + ((Number(T1[10]) + 1) % 10);
  const r = parse(`Tel 05550000000 ve ${bad}`, NOW);
  assert.equal(r.fields.tckn, undefined);
});

test('birden fazla geçerli T.C. veya yıl varsa alan boş bırakılır', () => {
  const r = parse(`${T1} ${T2} 1980 1990`, NOW);
  assert.equal(r.fields.tckn, undefined);
  assert.equal(r.fields.dogumYili, undefined);
  assert.deepEqual(r.warnings.sort(), ['multiple_tckn', 'multiple_years']);
});

test('etiketli değer tahmine üstün gelir; tarihten yıl, gelecek yıl reddedilir', () => {
  let r = parse(`Doğum Yılı: 1970\nKayıt: 01.01.2020`, NOW);
  assert.equal(r.fields.dogumYili, '1970');
  r = parse('Doğum Tarihi: 01.01.2030', NOW);
  assert.equal(r.fields.dogumYili, undefined);
});

test('boş, ilgisiz ve tek kelimelik metin', () => {
  assert.deepEqual(parse('', NOW).fields, {});
  assert.deepEqual(parse(null, NOW).fields, {});
  assert.deepEqual(parse('Merhaba', NOW).fields, {});
  assert.deepEqual(parse('e-posta: a@b.c', NOW).fields, {});
});

test('parantez içi notlar, rakam ve işaretler addan temizlenir', () => {
  const r = parse('Ad: Ali (müşteri)\nSoyad: Veli*', NOW);
  assert.deepEqual([r.fields.ad, r.fields.soyad], ['Ali', 'Veli']);
});
