// Yerel demo: panelin service worker yerine doldurucuyu doğrudan iframe'e uyguladığı simülasyon.
(function () {
  'use strict';
  const V = globalThis.NviValidation;
  const FIELDS = V.FIELDS;
  const LABELS = { tckn: 'T.C. Kimlik No', ad: 'Ad', soyad: 'Soyad', dogumYili: 'Doğum Yılı' };
  const STATUS = {
    filled: 'Dolduruldu', unchanged: 'Zaten aynı değer vardı', kept: 'Farklı değer vardı; korundu',
    missing: 'Bulunamadı', ambiguous: 'Belirsiz; atlandı', readonly: 'Salt okunur; elle girin',
    disabled: 'Devre dışı; elle girin', too_long: 'Çok uzun; atlandı', rejected: 'Sayfa kabul etmedi', no_value: 'Değer yok', error: 'Hata'
  };
  const $ = (id) => document.getElementById(id);
  const iframe = $('target');

  $('scenario').addEventListener('change', (e) => {
    iframe.src = '../test/fixtures/nvi-like.html?scenario=' + encodeURIComponent(e.target.value);
    $('status').textContent = '';
    $('field-results').textContent = '';
    $('raw').textContent = '';
  });

  // Kontrol basamakları tutan ama rastgele üretilmiş SENTETİK numara.
  function syntheticTckn() {
    const d = [1 + Math.floor(Math.random() * 9)];
    for (let i = 1; i < 9; i++) d.push(Math.floor(Math.random() * 10));
    const odd = d[0] + d[2] + d[4] + d[6] + d[8];
    const even = d[1] + d[3] + d[5] + d[7];
    d.push((((odd * 7 - even) % 10) + 10) % 10);
    d.push(d.reduce((a, b) => a + b, 0) % 10);
    return d.join('');
  }

  $('sample-btn').addEventListener('click', () => {
    $('tckn').value = syntheticTckn();
    $('ad').value = 'DENEME';
    $('soyad').value = 'KULLANICI';
    $('dogumYili').value = '1990';
  });

  function showErrors(errors) {
    const list = $('error-list');
    list.textContent = '';
    for (const f of FIELDS) {
      const el = $(f);
      const msgEl = $(f + '-error');
      if (errors[f]) {
        el.setAttribute('aria-invalid', 'true');
        msgEl.textContent = V.message(errors[f]);
        msgEl.hidden = false;
        const li = document.createElement('li');
        li.textContent = LABELS[f] + ': ' + V.message(errors[f]);
        list.appendChild(li);
      } else {
        el.removeAttribute('aria-invalid');
        msgEl.hidden = true;
      }
    }
    $('error-summary').hidden = !list.children.length;
    if (list.children.length) $('error-summary').focus();
  }

  $('fill-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {};
    for (const f of FIELDS) data[f] = $(f).value;
    const check = V.validateAll(data);
    showErrors(check.errors);
    if (!check.ok) { $('status').textContent = 'Bilgilerde hata var.'; return; }
    $('status').textContent = 'Aktarılıyor… (simülasyon)';
    const result = await globalThis.NviFiller.fill(check.normalized, { document: iframe.contentDocument, timeoutMs: 3000 });
    const list = $('field-results');
    list.textContent = '';
    for (const f of FIELDS) {
      const li = document.createElement('li');
      li.dataset.field = f;
      li.dataset.status = result.fields[f].status;
      li.textContent = LABELS[f] + ': ' + (STATUS[result.fields[f].status] || result.fields[f].status);
      list.appendChild(li);
    }
    $('raw').textContent = JSON.stringify(result, null, 2);
    $('status').textContent = (result.ok ? 'SİMÜLASYON: alanlar aktarıldı. ' : 'SİMÜLASYON: bazı alanlar aktarılamadı. ') +
      'Bu bir kimlik doğrulaması değildir; gerçek sayfada güvenlik kodu ve sorgu görevliye aittir.' +
      (result.virtualKeyboard ? ' Sanal klavye açık.' : '');
  });
})();
