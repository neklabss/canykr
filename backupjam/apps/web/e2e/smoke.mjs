// Browser smoke test: web (localhost:3000) + API (localhost:4000) must be running.
// Usage: node e2e/smoke.mjs [screenshotDir]
import { createRequire } from 'node:module';
// Uses the project's or the globally pre-installed Playwright (set NODE_PATH=$(npm root -g)).
const { chromium } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const out = process.argv[2];
const browser = await chromium.launch();
const shot = async (page, name) => out && page.screenshot({ path: `${out}/${name}.png`, fullPage: false });

try {
  // 1) Locale detection from browser language, Turkish UI.
  const tr = await browser.newContext({ locale: 'tr-TR', colorScheme: 'dark', viewport: { width: 1280, height: 800 } });
  let page = await tr.newPage();
  await page.goto(WEB);
  assert.match(page.url(), /\/tr$/);
  assert.equal(await page.locator('h1').innerText(), 'Sahne hazır. Sıradaki kim çalacak, bul.');
  await shot(page, 'landing-tr-dark-desktop');

  // 2) Sign up → dashboard (real API), then settings: Turkish UI, German market, EUR.
  await page.goto(`${WEB}/tr/sign-up`);
  await page.fill('#displayName', 'Smoke Test');
  await page.fill('#email', `smoke.${Date.now()}@example.com`);
  await page.fill('#password', 'correct horse battery staple');
  await page.check('input[name=acceptTerms]');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/tr\/dashboard$/);
  await page.getByText('Hoş geldin, Smoke Test').waitFor();
  await shot(page, 'dashboard-tr');
  await page.goto(`${WEB}/tr/settings`);
  await page.locator('#country option[value="DE"]').waitFor({ state: 'attached' });
  await page.selectOption('#country', 'DE');
  await page.selectOption('#currency', 'EUR');
  await page.click('button[type=submit]');
  await page.getByText('Kaydedildi').waitFor();
  assert.equal(await page.locator('#country option:checked').innerText(), 'Almanya');
  await shot(page, 'settings-tr');

  // 3) Manual language switch persists to the account and moves the URL.
  await page.selectOption('header select', 'de');
  await page.waitForURL(/\/de\/settings$/);
  await page.getByRole('heading', { name: 'Einstellungen' }).waitFor();

  // 4) Localized API errors surface in the UI.
  await page.goto(`${WEB}/ja/sign-in`);
  await page.fill('#email', 'nobody@example.com');
  await page.fill('#password', 'wrong password!!');
  await page.click('button[type=submit]');
  await page.getByRole('alert').getByText('メールアドレスまたはパスワードが正しくありません。').waitFor();

  // 5) Arabic RTL on a phone, light theme.
  const ar = await browser.newContext({ locale: 'ar-EG', colorScheme: 'light', viewport: { width: 390, height: 844 }, isMobile: true });
  page = await ar.newPage();
  await page.goto(WEB);
  assert.match(page.url(), /\/ar$/);
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  await shot(page, 'landing-ar-light-mobile');

  // 6) German long strings on a narrow screen: no horizontal overflow.
  const de = await browser.newContext({ locale: 'de-DE', viewport: { width: 360, height: 780 } });
  page = await de.newPage();
  await page.goto(`${WEB}/de/sign-up`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `horizontal overflow ${overflow}px`);
  await shot(page, 'signup-de-narrow');
  console.log('web smoke: all checks passed');
} finally {
  await browser.close();
}
