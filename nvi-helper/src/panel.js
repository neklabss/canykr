/*
 * Yan panel. Veriler yalnızca bu sayfanın DOM'unda durur; kalıcı depolamaya
 * yazılmaz, loglanmaz. Panel kapanınca veya boşta kalınca silinir.
 */
(function () {
  'use strict';

  const V = globalThis.NviValidation;
  const FIELDS = V.FIELDS;
  const IDLE_CLEAR_MS = 5 * 60 * 1000;

  const FIELD_LABELS = { tckn: 'T.C. Kimlik No', ad: 'Ad', soyad: 'Soyad', dogumYili: 'Doğum Yılı' };

  const STATUS_TEXT = {
    filled: 'Dolduruldu',
    unchanged: 'Zaten aynı değer vardı',
    kept: 'Alanda farklı bir değer vardı; korundu (elle kontrol edin)',
    missing: 'Sayfada bulunamadı',
    ambiguous: 'Birden fazla uygun alan var; güvenlik için atlandı',
    readonly: 'Alan salt okunur (sanal klavye açık olabilir); elle girin',
    disabled: 'Alan devre dışı; elle girin',
    too_long: 'Değer alanın uzunluk sınırını aşıyor; atlandı',
    rejected: 'Sayfa değeri kabul etmedi; elle kontrol edin',
    no_value: 'Değer yok',
    error: 'Beklenmeyen hata'
  };

  const ERROR_TEXT = {
    no_tab: 'Etkin sekme bulunamadı.',
    not_nvi_page: 'Etkin sekme NVI sayfası değil. tckimlik.nvi.gov.tr adresindeki T.C. Kimlik No Doğrulama sayfasını açın.',
    wrong_module: 'Bu NVI sayfası T.C. Kimlik No Doğrulama modülü değil.',
    tab_closed: 'NVI sekmesi kapatıldı.',
    navigated_away: 'NVI sekmesi başka bir adrese gitti; bekleyen veri silindi.',
    page_unavailable: 'Sayfaya erişilemedi (hata sayfası ya da izin yok).',
    timeout: 'Sayfa zamanında yanıt vermedi. Sayfayı yenileyip tekrar deneyin.',
    injection_failed: 'Sayfaya bağlanılamadı. Sayfayı yenileyip tekrar deneyin.',
    busy: 'Bu sekmede zaten bir aktarım sürüyor.',
    multiple_forms: 'Sayfada birden fazla uygun form var; güvenlik için hiçbiri doldurulmadı. Alanları elle girin.',
    invalid: 'Bilgilerde hata var.',
    expired: 'Sayfa yüklenmeden bekleme süresi doldu; veri silindi. Tekrar deneyin.',
    internal: 'Beklenmeyen bir hata oluştu.'
  };

  const form = document.getElementById('fill-form');
  const fillBtn = document.getElementById('fill-btn');
  const clearBtn = document.getElementById('clear-btn');
  const clearAfter = document.getElementById('clear-after');
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('field-results');
  const summary = document.getElementById('error-summary');
  const errorList = document.getElementById('error-list');
  const pasteText = document.getElementById('paste-text');
  const pasteBtn = document.getElementById('paste-btn');

  let pendingTabId = null;
  let pendingTimer = null;
  let idleTimer = null;

  function input(f) { return document.getElementById(f); }

  function setStatus(text, tone) {
    statusEl.textContent = text;
    if (tone) statusEl.dataset.tone = tone; else delete statusEl.dataset.tone;
  }

  function clearFieldErrors() {
    for (const f of FIELDS) {
      input(f).removeAttribute('aria-invalid');
      const e = document.getElementById(f + '-error');
      e.textContent = '';
      e.hidden = true;
    }
    summary.hidden = true;
    errorList.textContent = '';
  }

  function showFieldErrors(errors) {
    clearFieldErrors();
    const entries = FIELDS.filter((f) => errors[f]);
    if (!entries.length) return;
    for (const f of entries) {
      const msg = V.message(errors[f]);
      input(f).setAttribute('aria-invalid', 'true');
      const e = document.getElementById(f + '-error');
      e.textContent = msg;
      e.hidden = false;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + f;
      a.textContent = FIELD_LABELS[f] + ': ' + msg;
      a.addEventListener('click', (ev) => { ev.preventDefault(); input(f).focus(); });
      li.appendChild(a);
      errorList.appendChild(li);
    }
    summary.hidden = false;
    summary.focus();
  }

  function renderResults(result) {
    resultsEl.textContent = '';
    if (!result) return;
    for (const f of FIELDS) {
      const r = result.fields[f];
      if (!r) continue;
      const li = document.createElement('li');
      li.dataset.field = f;
      li.dataset.status = r.status;
      const name = document.createElement('span');
      name.textContent = FIELD_LABELS[f] + ': ';
      li.appendChild(name);
      li.appendChild(document.createTextNode(STATUS_TEXT[r.status] || r.status));
      resultsEl.appendChild(li);
    }
  }

  function clearGuessed(f) {
    const el = input(f);
    el.classList.remove('guessed');
    el.removeAttribute('data-guessed');
  }

  function clearInputs() {
    for (const f of FIELDS) { input(f).value = ''; clearGuessed(f); }
    pasteText.value = '';
    clearFieldErrors();
  }

  function applyPaste() {
    const parsed = globalThis.NviPasteParser.parseCustomerText(pasteText.value);
    pasteText.value = ''; // ham metin panelde tutulmaz
    const found = FIELDS.filter((f) => parsed.fields[f] !== undefined);
    const guessed = found.filter((f) => parsed.source[f] === 'guessed');
    for (const f of found) {
      input(f).value = parsed.fields[f];
      clearGuessed(f);
      if (guessed.includes(f)) { input(f).classList.add('guessed'); input(f).dataset.guessed = 'true'; }
    }
    clearFieldErrors();
    renderResults(null);
    const notes = [];
    if (parsed.warnings.includes('multiple_tckn')) notes.push('Metinde birden fazla geçerli T.C. Kimlik No var; numarayı elle girin.');
    if (parsed.warnings.includes('multiple_years')) notes.push('Metinde birden fazla yıl var; doğum yılını elle girin.');
    if (!found.length) {
      setStatus(['Metinden alan çıkarılamadı.'].concat(notes).join(' '), 'warn');
      pasteText.focus();
      return;
    }
    const missing = FIELDS.filter((f) => !found.includes(f));
    let msg = found.length + ' alan dolduruldu.';
    if (guessed.length) msg += ' Tahmin edilen alanları kontrol edin: ' + guessed.map((f) => FIELD_LABELS[f]).join(', ') + '.';
    if (missing.length) msg += ' Eksik: ' + missing.map((f) => FIELD_LABELS[f]).join(', ') + '.';
    setStatus([msg].concat(notes).join(' '), guessed.length || missing.length || notes.length ? 'warn' : 'ok');
    input(missing[0] || guessed[0] || 'tckn').focus();
  }

  function stopPending() {
    pendingTabId = null;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  function showError(code) {
    renderResults(null);
    setStatus(ERROR_TEXT[code] || ERROR_TEXT.internal, 'error');
  }

  function showDone(result) {
    renderResults(result);
    const extra = result.virtualKeyboard ? ' Sanal klavye açık görünüyor; salt okunur alanları elle girin.' : '';
    if (result.ok) {
      setStatus('Alanlar aktarıldı. Bu bir kimlik doğrulaması değildir: güvenlik kodunu girip sorguyu siz başlatın.' + extra, 'ok');
      if (clearAfter.checked) clearInputs();
    } else if (result.filledCount > 0) {
      setStatus('Bazı alanlar aktarılamadı; aşağıdaki listeyi kontrol edip eksikleri elle tamamlayın.' + extra, 'warn');
    } else if (result.timedOut) {
      setStatus('Form alanları belirlenen sürede sayfada bulunamadı. Doğru sayfada olduğunuzu kontrol edin.' + extra, 'error');
    } else {
      setStatus('Hiçbir alan aktarılamadı; aşağıdaki listeyi kontrol edin.' + extra, 'error');
    }
  }

  function handleResponse(res) {
    if (!res) { showError('internal'); return; }
    if (res.status === 'done') { stopPending(); showDone(res.result); return; }
    if (res.status === 'queued') {
      setStatus('NVI sayfası yükleniyor; yüklenince alanlar doldurulacak.', 'warn');
      const wait = Math.max(0, res.expiresAt - Date.now());
      pendingTimer = setTimeout(() => { if (pendingTabId !== null) { stopPending(); showError('expired'); } }, wait + 1000);
      return;
    }
    stopPending();
    if (res.code === 'invalid' && res.errors) { showFieldErrors(res.errors); setStatus(ERROR_TEXT.invalid, 'error'); return; }
    showError(res.code);
  }

  async function targetTabId() {
    // ?tabId= yalnızca paneli sekmede açarak test etmek için; service worker
    // hedef sekmenin NVI sayfası olduğunu her durumda yeniden kontrol eder.
    const param = new URLSearchParams(location.search).get('tabId');
    if (param && /^\d+$/.test(param)) return Number(param);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? tab.id : null;
  }

  function resetIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { clearInputs(); renderResults(null); setStatus('Panel boşta kaldığı için temizlendi.'); }, IDLE_CLEAR_MS);
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    resetIdle();
    const data = {};
    for (const f of FIELDS) data[f] = input(f).value;
    const check = V.validateAll(data);
    if (!check.ok) { showFieldErrors(check.errors); setStatus(ERROR_TEXT.invalid, 'error'); return; }
    clearFieldErrors();

    const tabId = await targetTabId();
    if (tabId === null) { showError('no_tab'); return; }

    stopPending();
    pendingTabId = tabId;
    fillBtn.disabled = true;
    fillBtn.setAttribute('aria-busy', 'true');
    setStatus('Aktarılıyor…');
    renderResults(null);
    try {
      handleResponse(await chrome.runtime.sendMessage({ type: 'nvi:fill', tabId, data: check.normalized }));
    } catch (e) {
      stopPending();
      showError('internal');
    } finally {
      fillBtn.disabled = false;
      fillBtn.removeAttribute('aria-busy');
    }
  });

  clearBtn.addEventListener('click', () => {
    if (pendingTabId !== null) chrome.runtime.sendMessage({ type: 'nvi:cancel', tabId: pendingTabId }).catch(() => {});
    stopPending();
    clearInputs();
    renderResults(null);
    setStatus('Panel temizlendi.');
    input('tckn').focus();
  });

  pasteBtn.addEventListener('click', () => { resetIdle(); applyPaste(); });
  pasteText.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); resetIdle(); applyPaste(); }
  });
  // Görevli bir alanı elle düzelttiğinde "tahmin" işareti kalkar.
  form.addEventListener('input', (ev) => { if (FIELDS.includes(ev.target.id)) clearGuessed(ev.target.id); });
  form.addEventListener('input', resetIdle);

  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (sender.id !== chrome.runtime.id || !msg || msg.type !== 'nvi:result') return;
    if (pendingTabId === null || msg.tabId !== pendingTabId) return;
    handleResponse(msg);
  });

  window.addEventListener('pagehide', clearInputs);
  resetIdle();
})();
