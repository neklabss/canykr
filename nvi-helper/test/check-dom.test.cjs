'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkDom, format } = require('../scripts/check-dom.cjs');

test('check-dom: statik formda dört alan eşleşir, CAPTCHA eşleşmez', async () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/static-form.html'), 'utf8');
  const r = await checkDom(html);
  for (const f of ['tckn', 'ad', 'soyad', 'dogumYili']) assert.equal(r.fields[f].status, 'matched', f);
  assert.equal(r.fields.tckn.element.name, 'TCKimlikNo');
  assert.equal(r.fields.ad.element.name, 'Ad');
  assert.ok(r.others.some((e) => e.name === 'Captcha'), 'CAPTCHA diğer alanlarda listelenir');
  assert.equal(r.inputsWithValue, 0);
  const text = format(r);
  assert.match(text, /✓ T\.C\. Kimlik No → <input id="a1" name="TCKimlikNo">/);
});

test('check-dom: değer içeren formda uyarır', async () => {
  const r = await checkDom('<label for="x">Ad</label><input id="x" value="dolu">');
  assert.equal(r.inputsWithValue, 1);
  assert.match(format(r), /UYARI/);
  assert.equal(r.fields.tckn.status, 'missing');
});
