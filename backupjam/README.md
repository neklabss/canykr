# BackUpJam

**BackUpJam** (short brand **BUJ**) is a global marketplace and community for live music: book musicians and bands, find gigs, connect venues and organizers. Mobile: *BackUpJam for iOS & Android*. Web: *BackUpJam*.

> Domain, trademark and app-store name availability have **not** been verified.
> The platform is **not production-ready**: see [Status](#status) and [Known gaps](#known-gaps).

- Global communication language: **English** (support, legal master texts, docs, error codes).
- App language: **device/browser language automatically**, manually changeable, saved to the account.

| Path | What |
|---|---|
| [`docs/`](docs/README.md) | All deliverables 00–20 (PRD, specs, permissions, screens, journeys, design system, architecture, ERD, schema, API, auth, i18n, state machines, payments, threat model, testing, deployment, backlog, country checklist) |
| `apps/api` | NestJS modular-monolith API (PostgreSQL + PostGIS) |
| `apps/web` | Next.js public site & account area (16 locales, SEO, RTL) |
| `apps/admin` | Next.js staff console |
| `apps/mobile` | Flutter app (iOS/Android) |
| `packages/*` | `i18n`, `domain`, `api-contract`, `api-client`, `design-tokens` |

## Quick start (local)

Requirements: Node 22, pnpm 10, PostgreSQL 16 + PostGIS 3 (or Docker), Flutter 3.35+ for mobile.

```bash
cd backupjam
pnpm install
pnpm -r --filter "./packages/*" build
```

```bash
# Database + Redis (or use your own Postgres with PostGIS)
docker compose -f infra/docker-compose.yml up -d db redis
```

```bash
cp apps/api/.env.example apps/api/.env      # edit secrets; never commit .env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
pnpm db:migrate                              # needs DATABASE_URL (from apps/api/.env)
```

```bash
pnpm dev:api      # http://localhost:4000  (Swagger UI: /api/docs)
pnpm dev:web      # http://localhost:3000
pnpm dev:admin    # http://localhost:3001
```

Bootstrap the first staff account (later grants go through the audited admin API):

```bash
pnpm --filter @backupjam/api staff:grant you@example.com super_admin
```

Mobile:

```bash
cd apps/mobile && flutter pub get && flutter run --dart-define=API_URL=http://10.0.2.2:4000
```

Emails are printed by the **mock mailer** (`[MOCK EMAIL]` in API logs). Nothing is sent.

## Checks

```bash
pnpm -r typecheck
pnpm i18n:check            # 16 locales: completeness, ICU validity, placeholders, CLDR plural categories
pnpm tokens                # design tokens + WCAG AA contrast
pnpm test:e2e              # API e2e against a real Postgres (TEST_DATABASE_URL, default backupjam_test)
pnpm -r test               # everything above
cd apps/mobile && flutter analyze && flutter test
NODE_PATH=$(npm root -g) node apps/web/e2e/smoke.mjs     # needs web + API running
```

## Status

### Phase 1 — Foundation (this repository)

| Area | Delivered | Verified by |
|---|---|---|
| Architecture & docs | 00–20 in `docs/` | review |
| Database | 7 forward-only checksummed migrations, PostGIS, constraints, append-only audit/consent, ≥1-owner trigger | e2e (schema rebuilt from zero each run; tamper detection test) |
| Auth | Email/password (scrypt), verification, reset, sessions/devices, refresh rotation with reuse detection, Google/Apple ID-token verification with safe linking, account deletion with grace period, consent records, rate limiting | 52 API tests |
| Roles | 13 user capabilities, organizations (band/venue/agency/organizer/company) with role matrix + invitations, staff RBAC | API e2e + matrix unit tests |
| i18n | 16 complete locales (ICU, plurals incl. ar/ru/uk), negotiation, RTL, money/date formatting, localized errors & emails, Flutter ARB export | 99 i18n tests, API/Flutter/browser tests |
| Domain rules | Money (minor units), offer/counter-offer & booking state machines, immutable agreement snapshot, refund invariant | 20 unit tests |
| Design system | Original tokens (light/dark, “Jam Volt” accent) → CSS + Dart, WCAG AA check | 14 contrast checks |
| Web | Locale-prefixed SSG pages, hreflang/canonical, sitemap, robots, noindex private pages, auth flows, settings | Next build + Playwright smoke (6 scenarios) |
| Admin | Overview, users (search, suspend), audit log, feature flags, countries — permission-aware | Next build + Playwright smoke |
| Mobile | Flutter 5-tab shell, auth screens, settings (language/theme), secure token storage, tokens theme | `flutter analyze` clean, 16 Flutter tests |
| Contract | OpenAPI (48 paths) exported to `packages/api-contract/openapi.json`, typed TS client | CI drift check, 3 client tests |

### Test results at the time of writing

| Suite | Result |
|---|---|
| `packages/i18n` | 99 passed |
| `packages/domain` | 20 passed |
| `packages/api-contract` | 4 passed |
| `packages/api-client` | 3 passed |
| `packages/design-tokens` | 14/14 contrast pairs ≥ 4.5:1 |
| `apps/api` (unit + e2e, real PostgreSQL 16 + PostGIS 3.4) | 52 passed (7 suites) |
| `apps/mobile` (`flutter test`, Flutter 3.47.9) | 16 passed; `flutter analyze`: no issues |
| `apps/web` / `apps/admin` | production builds succeed; Playwright smoke tests pass against the running API |

## Known gaps

Not done in Phase 1 (tracked in [docs/19-backlog.md](docs/19-backlog.md)):

- **Mocks / not integrated:** transactional email (console mock), push (FCM/APNs), SMS/phone verification, payment providers (interface spec only — no provider integrated or contracted), malware scanning, AI translation.
- **Security hardening before production:** staff MFA (TOTP/WebAuthn) and SSO in front of admin; web refresh token in an httpOnly cookie via BFF (currently `sessionStorage`); asymmetric JWT keys with rotation; Redis-backed rate limiting for multi-replica deployments; breached-password check; penetration test.
- **Not verified here:** native Android/iOS builds (no Android SDK/Xcode in this environment), Docker images (no Docker daemon), CI workflow on GitHub runners.
- **Translations:** 15 of 16 locales are complete machine drafts awaiting native review; reference data names (instruments/genres) currently have English defaults + i18n keys pending translation.
- **Legal:** Terms/Privacy/Guidelines pages are placeholders marked “draft pending legal review”; no country is launched (`launch_status = hidden` everywhere).
- **Phase 2+ features** (profiles, media, jobs, search, messaging, offers API, bookings, payments, verification, reviews, events, challenges) are designed in docs, with domain rules partly implemented, but have no API/UI yet.
