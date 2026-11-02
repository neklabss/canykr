# 17 — Testing Strategy

Goal: catch regressions in money, auth, authorization and i18n before merge; keep the suite fast enough that it runs on every PR.

Principles:
- Test domain logic as pure functions (no Nest container, no DB) — fastest, most numerous.
- Test the API against a **real PostgreSQL 16 + PostGIS** (no SQLite, no mocks of `pg`) because financial invariants and geo queries depend on real SQL behaviour (D3).
- The OpenAPI contract (D18) is the shared boundary; clients and server are tested against it.
- i18n is tested like code: missing keys and broken ICU plurals fail CI (D8).
- Security tests are part of the normal suite, not a yearly event.

---

## 1. Test pyramid per app

| App / package | Unit | Integration / e2e | Contract | UI / visual | Tooling |
|---|---|---|---|---|---|
| `apps/api` | Domain modules (offers, bookings, payments invariants, permissions) | e2e via HTTP against real Postgres+PostGIS & Redis (Testcontainers / CI services) | Response validation vs `openapi.json` | — | Jest (or Vitest), Supertest, Testcontainers |
| `packages/api-contract` | Type/enum consistency | — | OpenAPI lint + breaking-change diff | — | Spectral, oasdiff |
| `packages/i18n` | ICU parse, placeholder parity, plural categories | Export to ARB round-trip | — | — | Vitest, `@formatjs/icu-messageformat-parser`, CLDR plural rules |
| `apps/mobile` (Flutter) | Blocs/notifiers, formatters | Integration tests on emulator (critical flows) | Generated client compiled against contract | Widget + golden tests (LTR, RTL, long strings, text scale) | `flutter_test`, `integration_test`, golden toolkit |
| `apps/web` (Next.js) | Hooks, utils, formatters | Playwright e2e against API (seeded) | Generated types | Visual snapshots (key pages), axe a11y | Vitest, Playwright, axe-core |
| `apps/admin` (Next.js) | Permission gating utils | Playwright e2e for staff flows (verification review, refunds, moderation) | Generated types | — | Vitest, Playwright |

Target ratio (by count): ~70 % unit, ~25 % integration/e2e, ~5 % UI/e2e browser/device.

---

## 2. Domain unit tests (API)

Must-have suites:

| Area | Cases |
|---|---|
| Money (D4) | Minor-unit arithmetic with `bigint`; currency exponent table (JPY 0, USD 2, KWD 3); rejects floats; formatting never mutates amount; display conversion does not alter settlement currency |
| Commission (doc 15 I3) | Computed only from offer snapshot; rounding rule; zero-rate; max-rate; property-based tests (fast-check) over random amounts/currencies: `0 ≤ fee < gross` |
| Refund invariants (I4) | Σ refunds ≤ captured across sequences of partial refunds; concurrent-refund simulation at service level |
| Payment state machine | Every allowed transition succeeds; every disallowed transition throws (exhaustive matrix generated from the transition table) |
| Offer/counter-offer | Version chain, only latest offer acceptable, expiry, snapshot frozen on accept |
| Booking cancellation | Policy versions, refund amount calculation per window |
| Permissions | Full org-role × permission matrix from doc 00 asserted as a table test |
| Verification (D12) | No code path grants a badge from a payment/entitlement event |
| Auth | scrypt hash versioning/upgrade (D6); refresh rotation and family reuse detection (D5); OIDC claim validation (D7) with fixture JWKS |
| Locale/country (D9) | `locale`, `country_code`, `currency_code`, `time_zone` independent; changing one never changes another |

---

## 3. API e2e against real Postgres

- Runs migrations from scratch (forward-only, checksummed) at suite start; asserts checksum table matches.
- Each test file gets its own schema or transaction-rollback isolation; seeds via SQL factories in `apps/api/test/factories`.
- PostGIS queries tested with fixed coordinates (e.g. Istanbul, São Paulo, Mumbai, antimeridian edge, poles) for radius search and distance sort.
- Redis via real container; BullMQ jobs run inline with a test worker.
- Payment flows use `MockPaymentProvider` plus recorded webhook fixtures (signed with test secret).

Required e2e scenarios (minimum):

- [ ] Register → verify email → login → refresh → refresh-reuse triggers family revocation.
- [ ] Create org → invite member → role-based access to `org.offers.negotiate` / `org.payouts.manage`.
- [ ] Post job → apply → offer → counter-offer → accept → booking created with snapshot.
- [ ] Create payment intent with `Idempotency-Key`; repeat → same response; different body same key → 409.
- [ ] Webhook delivered twice → processed once; bad signature → 400; stale timestamp → 400.
- [ ] Partial refund ×2 then over-refund attempt → rejected; concurrent refunds (parallel requests) → at most captured.
- [ ] Emergency request fan-out respects caps and radius.
- [ ] Review only after completed booking; second review same booking → rejected.
- [ ] GDPR-style export and deletion endpoints produce/erase expected data.

---

## 4. Contract tests vs OpenAPI

| Check | Where | Gate |
|---|---|---|
| `openapi.json` regenerated in CI equals committed `packages/api-contract/openapi.json` | API job | Fail if drift |
| Spectral lint (naming, error schema, pagination, `Idempotency-Key` documented on financial POSTs) | Contract job | Fail on error |
| Breaking change diff (oasdiff) vs `main` | Contract job | Fail unless PR labelled `api-breaking` and version bumped |
| Every e2e response validated against schema (ajv middleware in tests) | API e2e | Fail on mismatch |
| Mobile & web generated clients compile | Client jobs | Fail |
| Error codes are i18n keys that exist in `en` | i18n job | Fail |

---

## 5. Flutter tests

### Widget tests
- Each screen in the shell (auth, onboarding, profile, search, offers, bookings, messages, settings) has a widget test for loading/empty/error/data states.
- Navigation via `go_router` deep-links tested.

### Golden tests matrix

| Dimension | Values |
|---|---|
| Locale | `en`, `ar` (RTL), `de` (long compounds), `ru` (plural forms), `ja` (CJK line-breaking), `hi` (Devanagari shaping), pseudo-locale `en-XA` (+40 % length, accented) |
| Direction | LTR, RTL |
| Text scale | 1.0, 1.3, 2.0 |
| Theme | light, dark |
| Device | small phone (360×640), large phone, tablet |

Assertions:
- [ ] No overflow errors (`RenderFlex overflowed`) at any matrix point — treated as failure.
- [ ] Directional icons mirrored in RTL (back arrows, chevrons); media controls not mirrored.
- [ ] Numbers, dates, currencies formatted via `intl` with locale; currency symbol position correct.
- [ ] Goldens generated in a pinned Docker image for font consistency.

### Integration tests (device/emulator)
- Login, search musicians near me, send offer, accept, pay with mock provider, message thread.

---

## 6. Web Playwright e2e

- Runs against `next build && next start` + API with seeded DB in CI (docker compose).
- Projects: Chromium, WebKit, Firefox (Firefox nightly only); mobile viewport emulation.
- Scenarios mirror API e2e happy paths plus: locale switcher, RTL layout (`dir="rtl"`), SEO meta per locale (hreflang), cookie consent.
- Accessibility: `@axe-core/playwright` on key pages; zero serious/critical violations.
- Admin: staff login with MFA (TOTP fixture), verification review approve/reject, refund with dual approval, moderation action, audit log entry visible.

---

## 7. i18n completeness and plural tests (D8)

| Test | Rule |
|---|---|
| Key parity | Every key in `en.json` exists in each locale marked `supported` in `_registry.json`; `machine_draft` locales reported, not failed |
| ICU validity | Every message parses |
| Placeholder parity | Same argument names and types as `en` |
| Plural categories | For each plural message, locale has all CLDR categories required for that locale (e.g. `ar`: zero/one/two/few/many/other; `ru`/`uk`: one/few/many/other; `ja`/`ko`/`zh`: other) |
| Select exhaustiveness | `select` has `other` |
| No hardcoded strings | Lint rule in Flutter (`avoid_hardcoded_strings` custom) and web (eslint `i18next/no-literal-string` equivalent) |
| ARB export | Exported ARB matches source; Flutter `gen-l10n` succeeds |
| Length budget | Pseudo-locale renders in goldens; strings over UI budgets flagged |
| Email/push templates | Render each template in each supported locale with sample args |

---

## 8. Security tests

| Category | Approach | Frequency |
|---|---|---|
| Object-level authz (IDOR) | Auto-generated test per route: resource owned by user A requested by user B / org member without permission → 403/404 | Every PR |
| AuthN | Expired/forged JWT, wrong audience (admin vs app), `alg=none`, refresh reuse | Every PR |
| Input | SQL injection payloads on search/filter params, oversized bodies, unicode normalization in usernames | Every PR |
| Webhooks | Signature, timestamp, replay, duplicate event id | Every PR |
| Rate limiting | Login, OTP, messaging, votes, emergency: exceed limits → 429 | Every PR |
| Uploads | EICAR test file quarantined; SVG/HTML rejected; EXIF stripped | Every PR (media module) |
| Dependencies | `pnpm audit`, `osv-scanner`, Dart `pub outdated`/advisories | Every PR + nightly |
| SAST | CodeQL / Semgrep | Every PR |
| Secrets | gitleaks | Every PR + pre-commit |
| Container | Trivy image scan | Every image build |
| DAST | OWASP ZAP baseline against staging | Nightly |
| Pen test | External | Before first paid launch and annually |

---

## 9. Load tests

Tool: k6 (scripts in `tools/load/`), run against staging with production-like data volume.

| Scenario | Target (initial, revisit) | Pass criteria |
|---|---|---|
| Musician search (geo radius + filters + sort) | 200 RPS sustained, dataset 1M profiles across countries | p95 < 300 ms, error < 0.1 %, no seq scans in `EXPLAIN` snapshot |
| Emergency fan-out | 1 request → 5,000 recipients within radius; 20 concurrent emergencies | All enqueued < 5 s; delivered to push provider < 60 s; caps enforced; no duplicate sends |
| Messaging | 2,000 concurrent socket connections (Phase 3) | p95 delivery < 500 ms |
| Auth | 50 logins/s | scrypt CPU within budget, p95 < 400 ms |
| Webhook burst | 500 events/s for 1 min | All persisted, processed exactly-once |

---

## 10. Test data

- Factories produce multi-locale names (Arabic, CJK, Devanagari, accented Latin) by default to surface encoding bugs.
- No production data in non-prod environments; anonymized subsets only with DPO approval.
- Fixed clock in tests (`@sinonjs/fake-timers` / `clock` package in Dart); time zones exercised (UTC, `Asia/Kolkata` +5:30, `America/St_Johns` −3:30, DST transitions).

---

## 11. CI gates

| Gate | Blocks merge? |
|---|---|
| Lint + typecheck (TS, Dart analyzer) | Yes |
| API unit | Yes |
| API e2e (Postgres+PostGIS, Redis) | Yes |
| Contract drift + Spectral + breaking-change diff | Yes |
| i18n completeness / ICU / plurals (supported locales) | Yes |
| Flutter unit + widget + golden | Yes |
| Web/admin unit | Yes |
| Playwright smoke (critical paths) | Yes |
| Full Playwright cross-browser | Nightly; failures open issues |
| Security: authz tests, gitleaks, SAST, dependency audit (high/critical) | Yes |
| Trivy image scan (critical) | Yes on release |
| Coverage: domain modules (`payments`, `offers`, `bookings`, `auth`, `permissions`) ≥ 90 % lines; overall ≥ 70 % | Yes (domain); warn (overall) |
| Load tests | Before release to prod for search/emergency changes |
| Migration check (apply on copy of staging schema, forward-only) | Yes |

Flaky test policy: a flaky test is quarantined within 24 h with an owner and issue; quarantine list reviewed weekly; no more than 10 quarantined tests at any time.
