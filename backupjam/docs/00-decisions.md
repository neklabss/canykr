# 00 — Foundational Decisions (ADR log)

## Brand
| Item | Value |
|---|---|
| Product name | **BackUpJam** |
| Short brand | **BUJ** (optional; also used as backlog/issue prefix) |
| Mobile store name | **BackUpJam for iOS & Android** |
| Web | **BackUpJam** |
| Global communication language | **English** (support, legal master texts, developer docs, API error codes) |
| App UI language | Automatically from device/browser preference, manually overridable, persisted per account |

> Domain, trademark and app-store name availability have **not** been verified.

| # | Decision | Default chosen | Status |
|---|----------|----------------|--------|
| D1 | Repo layout | pnpm monorepo in `backupjam/` (apps/api, apps/web, apps/admin, apps/mobile, packages/*) | Accepted |
| D2 | Backend | NestJS 11 + TypeScript, **modular monolith** with domain modules | Accepted |
| D3 | Data access | PostgreSQL 16 + PostGIS 3, plain SQL migrations (forward-only, checksummed) + `pg` driver; no ORM magic for financial tables | Accepted |
| D4 | Money | Integer **minor units** (`bigint`) + ISO-4217 currency code; never floats; display conversion never alters settlement currency | Accepted |
| D5 | Auth tokens | Short-lived JWT access token (15 min, HS256 in dev / asymmetric in prod via env) + opaque rotating refresh token stored hashed, with family reuse detection | Accepted |
| D6 | Passwords | `scrypt` (Node crypto, N=2^15,r=8,p=1) with per-user salt, upgrade path versioned in hash string | Accepted |
| D7 | Social login | Google & Apple via OIDC ID-token verification against provider JWKS (`jose`) | Accepted |
| D8 | i18n | Single source of truth: ICU MessageFormat JSON in `packages/i18n/locales/*.json`; exported to Flutter ARB by script; web uses `intl-messageformat` | Accepted |
| D9 | Locale vs country | Independent settings: `locale` (UI language), `country_code` (market rules), `currency_code` (display), `time_zone` | Accepted |
| D10 | Payments | **No homemade escrow/wallet.** `PaymentProvider` interface; licensed marketplace providers (e.g. Stripe Connect, Adyen for Platforms, iyzico Marketplace for TR) selected per country. Only a clearly labelled `MockPaymentProvider` exists until a contract is signed | Accepted |
| D11 | Digital vs in-person | In-person bookings → marketplace payment provider. Premium subscriptions/boosts on mobile → App Store / Google Play billing review per territory; separate module | Accepted |
| D12 | Verification | Verification ≠ premium. Badges: `identity_verified`, `official_band`, `official_artist`, `verified_venue`, `verified_organizer`. Never purchasable | Accepted |
| D13 | Realtime | WebSocket gateway (Socket.IO adapter with Redis) — Phase 3 | Planned |
| D14 | Jobs/queues | BullMQ on Redis — introduced with notifications (Phase 2) | Planned |
| D15 | Media | S3-compatible storage, signed URLs, async processing pipeline, malware scan hook — Phase 2 | Planned |
| D16 | Mobile | Flutter 3.x, `go_router`, `flutter_localizations` + generated ARB, Material 3 with custom design tokens | Accepted |
| D17 | Web & Admin | Next.js 15 App Router, TypeScript; admin is a separate Next.js app (separate deploy, separate auth audience) | Accepted |
| D18 | API contract | OpenAPI 3 generated from NestJS (`/api/docs`, `openapi.json` exported to `packages/api-contract`), plus shared TS types/enums in `packages/api-contract` | Accepted |

## Role & permission vocabulary (shared by code and docs)

**User capabilities** (self-declared, one account, many): `musician`, `band_member`, `band_manager`, `venue_owner`, `venue_staff`, `organizer`, `booking_agent`, `artist_manager`, `sound_engineer`, `lighting_technician`, `music_teacher`, `enthusiast`, `customer`.

**Organization types**: `band`, `venue`, `agency`, `organizer`, `company`.

**Organization roles** → permissions:

| Permission | owner | admin | manager | member | staff |
|---|---|---|---|---|---|
| `org.profile.edit` | ✓ | ✓ | ✓ | | |
| `org.members.manage` | ✓ | ✓ | | | |
| `org.roles.assign_admin` | ✓ | | | | |
| `org.jobs.manage` | ✓ | ✓ | ✓ | | ✓ |
| `org.offers.negotiate` | ✓ | ✓ | ✓ | | |
| `org.bookings.manage` | ✓ | ✓ | ✓ | | |
| `org.calendar.manage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `org.events.manage` | ✓ | ✓ | ✓ | | ✓ |
| `org.messages.respond` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `org.finance.view` | ✓ | ✓ | | | |
| `org.payouts.manage` | ✓ | | | | |
| `org.reviews.respond` | ✓ | ✓ | ✓ | | |
| `org.delete` | ✓ | | | | |

**Platform staff roles** (admin dashboard): `super_admin`, `trust_safety`, `finance_ops`, `support`, `localization_manager`, `analyst` with permissions `admin.users.read`, `admin.users.suspend`, `admin.verification.review`, `admin.moderation.act`, `admin.finance.read`, `admin.finance.refund`, `admin.i18n.manage`, `admin.flags.manage`, `admin.staff.manage`, `admin.audit.read`, `admin.countries.manage`.

## Launch locales
`en, tr, es, pt-BR, fr, de, it, ar (RTL), ru, uk, hi, id, ja, ko, zh-Hans, zh-Hant`. Fallback: `en`. A locale is only exposed as *supported* when its resource passes the completeness test; `machine_draft` locales are flagged in `packages/i18n/locales/_registry.json` until native review.
