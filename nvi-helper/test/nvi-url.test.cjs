'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyUrl } = require('../src/nvi-url.js');

test('NVI T.C. Kimlik No Doğrulama adresi sınıflandırması', () => {
  assert.equal(classifyUrl('https://tckimlik.nvi.gov.tr/Modul/TcKimlikNoDogrula'), 'ok');
  assert.equal(classifyUrl('https://tckimlik.nvi.gov.tr/modul/tckimliknodogrula?x=1#y'), 'ok');
  assert.equal(classifyUrl('https://tckimlik.nvi.gov.tr/Modul/BaskaModul'), 'wrong_module');
  assert.equal(classifyUrl('https://tckimlik.nvi.gov.tr/'), 'wrong_module');
});

test('benzer görünen ama NVI olmayan adresler reddedilir', () => {
  for (const u of [
    'http://tckimlik.nvi.gov.tr/Modul/TcKimlikNoDogrula',
    'https://tckimlik.nvi.gov.tr.example.com/Modul/TcKimlikNoDogrula',
    'https://evil.example/tckimlik.nvi.gov.tr/Modul/TcKimlikNoDogrula',
    'https://xtckimlik.nvi.gov.tr/Modul/TcKimlikNoDogrula',
    'https://user@evil.example/Modul/TcKimlikNoDogrula',
    'chrome://extensions', 'about:blank', '', undefined, 'bozuk adres'
  ]) assert.equal(classifyUrl(u), 'not_nvi_page', String(u));
});
