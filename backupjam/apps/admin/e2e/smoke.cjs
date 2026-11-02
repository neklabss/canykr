// Admin console smoke test. Needs API (:4000) + admin (:3001) running and a staff account.
// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... NODE_PATH=$(npm root -g) node e2e/smoke.cjs [screenshotDir]
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ locale: 'tr-TR', colorScheme: 'dark', viewport: { width: 1280, height: 800 } });
  await p.goto(process.env.ADMIN_URL ?? 'http://localhost:3001/');
  await p.fill('input[name=email]', process.env.ADMIN_EMAIL ?? 'demo@example.com');
  await p.fill('input[name=password]', process.env.ADMIN_PASSWORD ?? 'correct horse battery staple');
  await p.click('button[type=submit]');
  await p.getByRole('heading', { name: 'Genel bakış' }).waitFor();
  await p.getByText('Aktif kullanıcılar').waitFor();
  if (out) await p.screenshot({ path: `${out}/admin-overview-tr.png` });
  await p.getByRole('button', { name: 'Kullanıcılar' }).click();
  await p.locator('tbody tr').first().waitFor();
  await p.getByRole('button', { name: 'Denetim kaydı' }).click();
  await p.getByText('admin.staff_granted').first().waitFor();
  if (out) await p.screenshot({ path: `${out}/admin-audit-tr.png` });
  const res = await p.request.get(process.env.ADMIN_URL ?? 'http://localhost:3001/');
  assert.equal(res.headers()['x-robots-tag'], 'noindex, nofollow');
  console.log('admin smoke: all checks passed');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
