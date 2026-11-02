# 19 — Development Backlog

Legend:
- **ID scheme**: `BUJ-<phase><nn>` — first digit is the phase (1–6), `nn` is the story number within the phase (e.g. BUJ-421 = Phase 4, story 21).
- **Priority**: P0 = required for the phase to ship; P1 = should ship in phase; P2 = nice to have / can slip.
- **Size**: S ≤ 2 days, M ≤ 1 week, L > 1 week (split before starting if possible).
- **Status**: `in progress` | `todo` | `done` | `blocked`.
- **Deps**: story IDs that must be done (or contract-stable) first.

Phase plan (official, from the product brief):

| Phase | Theme | Scope | Key decisions |
|---|---|---|---|
| 1 | Foundation | Architecture, DB schema, auth, i18n, user roles, design system, core API, mobile + web + admin shells | D1–D9, D16–D18 |
| 2 | Marketplace | Musician profiles, bands, venues, job listings, applications, search, notifications, media portfolios | D14 BullMQ, D15 media |
| 3 | Communication & Offers | Messaging, negotiation, counter-offers, availability, booking requests, booking lifecycle, emergency requests | D13 realtime |
| 4 | Payments & Trust | Payment provider integration, verified accounts, payouts, refunds, disputes, verified booking reviews | D4, D10, D12 |
| 5 | Events & Community | Events, weekly meetups, group networking, event messaging, community discovery | — |
| 6 | Challenges & Growth | Challenges, voting, moderation, sponsorship, advanced discovery, analytics, premium/digital purchases & app-store billing | D11 |

---

## Phase 1 — Foundation

### Epic E1.1 Monorepo & API core

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-101 | As a developer, I can run the whole stack locally with one `docker compose up` (Postgres+PostGIS, Redis, MinIO, Mailpit) | P0 | M | — | in progress |
| BUJ-102 | As a developer, I have a pnpm monorepo with `apps/api`, `apps/web`, `apps/admin`, `apps/mobile`, `packages/*` and shared lint/tsconfig (D1) | P0 | S | — | in progress |
| BUJ-103 | As a developer, NestJS API skeleton with config validation, health endpoints, structured logging, request ids, error envelope | P0 | M | BUJ-102 | in progress |
| BUJ-104 | As a developer, forward-only checksummed SQL migration runner with `pg` (D3) | P0 | M | BUJ-103 | in progress |
| BUJ-105 | As a client developer, OpenAPI is generated at `/api/docs` and exported to `packages/api-contract` (D18) | P0 | S | BUJ-103 | in progress |
| BUJ-106 | As a developer, CI runs lint, typecheck, unit and API e2e against real Postgres (doc 17) | P0 | M | BUJ-104 | in progress |
| BUJ-107 | As an operator, rate limiting middleware backed by Redis with per-route classes | P0 | S | BUJ-103 | in progress |
| BUJ-108 | As a developer, `Money` value object with `bigint` minor units + currency exponent table (D4) | P0 | S | BUJ-103 | in progress |
| BUJ-109 | As a developer, initial DB schema (users, credentials, refresh-token families, capabilities, organizations, memberships, locale settings) with PostGIS extension enabled | P0 | M | BUJ-104 | in progress |

### Epic E1.2 Authentication

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-111 | As a user, I can register with email + password (scrypt, D6) and verify my email | P0 | M | BUJ-104 | in progress |
| BUJ-112 | As a user, I can log in and receive a 15-min access token + rotating refresh token (D5) | P0 | M | BUJ-111 | in progress |
| BUJ-113 | As a user, if my refresh token is stolen and reused, the whole token family is revoked | P0 | S | BUJ-112 | in progress |
| BUJ-114 | As a user, I can sign in with Google or Apple (OIDC ID-token verification, D7) | P0 | M | BUJ-112 | in progress |
| BUJ-115 | As a user, I can reset my password via single-use time-limited link | P0 | S | BUJ-111 | in progress |
| BUJ-116 | As a user, I can see and revoke my active sessions/devices | P1 | S | BUJ-112 | in progress |
| BUJ-117 | As staff, I must use MFA (TOTP) to access admin (separate JWT audience, D17) | P0 | M | BUJ-112 | in progress |

### Epic E1.3 i18n & locale settings

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-121 | As a developer, ICU MessageFormat JSON source in `packages/i18n/locales` with `_registry.json` (D8) | P0 | S | BUJ-102 | in progress |
| BUJ-122 | As a developer, script exports locales to Flutter ARB; web uses `intl-messageformat` | P0 | M | BUJ-121 | in progress |
| BUJ-123 | As a developer, CI fails on missing keys, invalid ICU, placeholder mismatch, missing plural categories for supported locales | P0 | M | BUJ-121 | in progress |
| BUJ-124 | As a user, I can set locale, country, display currency and time zone independently (D9) | P0 | S | BUJ-111 | in progress |
| BUJ-125 | As an Arabic user, all apps render RTL correctly | P0 | M | BUJ-141, BUJ-151 | in progress |
| BUJ-126 | As a localization manager, I can see completeness per locale and `machine_draft` flags in admin | P1 | M | BUJ-161 | in progress |

### Epic E1.4 Roles, capabilities & organizations

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-131 | As a user, I can declare multiple capabilities on one account (musician, venue_owner, organizer, …) | P0 | S | BUJ-111 | in progress |
| BUJ-132 | As a user, I can create an organization (band, venue, agency, organizer, company) and become `owner` | P0 | M | BUJ-131 | in progress |
| BUJ-133 | As an org owner/admin, I can invite members and assign roles per doc 00 matrix | P0 | M | BUJ-132 | in progress |
| BUJ-134 | As a developer, a permission guard enforces org-role permissions and object-level authz on every route | P0 | M | BUJ-133 | in progress |
| BUJ-135 | As super_admin, I can manage platform staff roles and permissions | P0 | M | BUJ-117 | in progress |
| BUJ-136 | As a developer, append-only audit log for security-relevant actions | P0 | S | BUJ-103 | in progress |

### Epic E1.5 Design system & app shells

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-141 | As a mobile user, Flutter shell with `go_router`, Material 3 custom tokens, auth screens, settings (D16) | P0 | L | BUJ-112, BUJ-122 | in progress |
| BUJ-142 | As a designer/dev, shared design tokens (color, type, spacing, radius) exported to Flutter and CSS | P0 | M | BUJ-102 | in progress |
| BUJ-143 | As a developer, Flutter golden tests across LTR/RTL, long-string pseudo-locale, text scale | P0 | M | BUJ-141 | in progress |
| BUJ-151 | As a web user, Next.js 15 App Router shell with locale routing, auth, settings | P0 | L | BUJ-112, BUJ-122 | in progress |
| BUJ-152 | As a web user, accessible components (keyboard, focus, contrast) verified by axe | P1 | M | BUJ-151 | in progress |
| BUJ-161 | As staff, separate Next.js admin shell with staff login + MFA and permission-gated nav | P0 | L | BUJ-117, BUJ-135 | in progress |

---

## Phase 2 — Marketplace

### Epic E2.1 Profiles: musicians, bands, venues

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-201 | As a musician, I can create a profile with instruments, genres, rates (minor units + currency), languages, travel radius | P0 | M | BUJ-131 | todo |
| BUJ-202 | As a band manager, I can create a band profile linked to the band org and list members | P0 | M | BUJ-132 | todo |
| BUJ-203 | As a venue owner, I can create a venue profile with PostGIS location, capacity, equipment | P0 | M | BUJ-132 | todo |
| BUJ-204 | As an organizer, I can create an organizer profile | P1 | S | BUJ-132 | todo |
| BUJ-205 | As a user, public profiles show approximate location only | P0 | S | BUJ-201 | todo |

### Epic E2.2 Media portfolios (D15)

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-211 | As a user, I upload portfolio media via signed URLs to a quarantine bucket | P0 | M | BUJ-103 | todo |
| BUJ-212 | As the platform, uploads are malware-scanned, EXIF-stripped, transcoded before publish | P0 | L | BUJ-211, BUJ-241 | todo |
| BUJ-213 | As a viewer, private media served only via short-lived signed URLs | P0 | S | BUJ-211 | todo |
| BUJ-214 | As a musician/band, I can arrange my portfolio (audio, video, photos, rider PDF) on my profile | P0 | M | BUJ-212, BUJ-201 | todo |
| BUJ-215 | As T&S, duplicate/stolen media detection via perceptual hashing | P2 | M | BUJ-212 | todo |

### Epic E2.3 Job listings & applications

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-221 | As a venue/organizer, I can post a job (gig date, location, budget, requirements) with `org.jobs.manage` | P0 | M | BUJ-203 | todo |
| BUJ-222 | As a musician/band, I can apply to a job with a message and portfolio items | P0 | S | BUJ-221, BUJ-201 | todo |
| BUJ-223 | As a job poster, I can review, shortlist and decline applications | P0 | M | BUJ-222 | todo |
| BUJ-224 | As the platform, new orgs have job-posting limits | P1 | S | BUJ-221, BUJ-107 | todo |

### Epic E2.4 Search

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-231 | As a customer, I can search musicians/bands by location radius, instrument, genre, price | P0 | L | BUJ-201, BUJ-202 | todo |
| BUJ-232 | As a musician, I can search venues and jobs near me | P0 | M | BUJ-203, BUJ-221 | todo |
| BUJ-233 | As an operator, search meets load targets (doc 17 §9) | P1 | M | BUJ-231 | todo |
| BUJ-234 | As a user, search results localized (names, units, currency display per D9) | P1 | S | BUJ-231 | todo |

### Epic E2.5 Notifications (D14)

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-241 | As a developer, BullMQ queues with outbox pattern in Postgres | P0 | M | BUJ-104 | todo |
| BUJ-242 | As a user, I receive push/email notifications in my locale; I can set preferences and quiet hours | P0 | M | BUJ-241 | todo |
| BUJ-243 | As the platform, per-sender and per-recipient notification caps enforced | P0 | S | BUJ-242 | todo |

---

## Phase 3 — Communication & Offers

### Epic E3.1 Messaging (D13)

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-301 | As a developer, WebSocket gateway with Redis adapter and auth (D13) | P0 | L | BUJ-112 | todo |
| BUJ-302 | As a user, I can message other users/orgs; non-connections land in message requests | P0 | L | BUJ-301 | todo |
| BUJ-303 | As a user, I can block, mute and report a conversation | P0 | M | BUJ-302 | todo |
| BUJ-304 | As the platform, messages with off-platform payment solicitation show a warning and flag T&S | P0 | M | BUJ-302 | todo |

### Epic E3.2 Availability

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-311 | As a musician/org (`org.calendar.manage`), I can manage an availability calendar in my time zone | P0 | M | BUJ-201 | todo |
| BUJ-312 | As a customer, I can filter search by date availability | P1 | M | BUJ-231, BUJ-311 | todo |

### Epic E3.3 Booking requests, negotiation & lifecycle

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-321 | As a customer, I can send a booking request/offer (amount minor units, currency, date, location, cancellation policy version) | P0 | M | BUJ-201 | todo |
| BUJ-322 | As a musician/org (`org.offers.negotiate`), I can counter-offer; version chain kept | P0 | M | BUJ-321 | todo |
| BUJ-323 | As either party, I can accept the latest offer; an immutable offer snapshot is created | P0 | M | BUJ-322 | todo |
| BUJ-324 | As parties, a booking is created from the snapshot with status lifecycle and calendar block | P0 | M | BUJ-323, BUJ-311 | todo |
| BUJ-325 | As a party, I can cancel per policy; calculated refund amount shown (payment applied in Phase 4) | P0 | M | BUJ-324 | todo |
| BUJ-326 | As parties, booking completion confirmation (check-in / mark complete) | P1 | S | BUJ-324 | todo |

### Epic E3.4 Emergency requests

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-331 | As a venue with completed bookings (or verified, once BUJ-421 ships), I can send an emergency request to nearby available musicians | P0 | L | BUJ-231, BUJ-311, BUJ-243 | todo |
| BUJ-332 | As the platform, emergency fan-out has radius, sender and recipient caps and a kill switch | P0 | M | BUJ-331 | todo |
| BUJ-333 | As a musician, I can accept an emergency request → fast-path offer | P1 | M | BUJ-331, BUJ-323 | todo |

---

## Phase 4 — Payments & Trust

### Epic E4.1 Payment provider integration (D10)

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-401 | As a developer, `PaymentProvider` interface and `MockPaymentProvider` (refuses prod boot) | P0 | M | BUJ-108 | todo |
| BUJ-402 | As a developer, ledger tables + append-only status history + invariants I1–I12 (doc 15) | P0 | L | BUJ-401 | todo |
| BUJ-403 | As a seller (`org.payouts.manage`), I complete provider-hosted onboarding and see status | P0 | M | BUJ-401 | todo |
| BUJ-404 | As a customer, I pay for an accepted booking; amount from snapshot; `Idempotency-Key` required | P0 | L | BUJ-402, BUJ-324 | todo |
| BUJ-405 | As the platform, webhooks verified (signature + timestamp), deduplicated by provider event id, processed async | P0 | M | BUJ-402, BUJ-241 | todo |
| BUJ-406 | As finance_ops, I can issue full/partial refunds; > threshold needs second approver | P0 | M | BUJ-404 | todo |
| BUJ-407 | As finance_ops, hourly/daily reconciliation with breaks queue | P0 | L | BUJ-405 | todo |
| BUJ-408 | As finance_ops, I manage disputes with evidence bundle from offer snapshot & messages | P0 | L | BUJ-405 | todo |
| BUJ-409 | As finance, tax records and commission invoices per country config | P1 | L | BUJ-404, BUJ-441 | todo |
| BUJ-410 | As a developer, first real provider adapter after contract signature (country TBD) | P0 | L | BUJ-401, legal sign-off | blocked |
| BUJ-411 | As an org owner/admin (`org.finance.view`), I see payments, commissions, payouts | P1 | M | BUJ-404 | todo |
| BUJ-412 | As a seller, payout status mirrored from the provider; platform-initiated payouts only where the provider supports `createPayout` | P0 | M | BUJ-405 | todo |

### Epic E4.2 Verified accounts (D12)

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-421 | As a user/org, I can request verification (`identity_verified`, `official_band`, `official_artist`, `verified_venue`, `verified_organizer`); never purchasable (D12) | P0 | L | BUJ-213 | todo |
| BUJ-422 | As trust_safety (`admin.verification.review`), I review documents in a watermarked, audit-logged viewer | P0 | M | BUJ-421, BUJ-161 | todo |
| BUJ-423 | As the platform, verification docs auto-deleted N days after decision | P0 | S | BUJ-421 | todo |

### Epic E4.3 Verified booking reviews

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-431 | As a party to a completed booking, I can leave one review; the other side can respond (`org.reviews.respond`) | P0 | M | BUJ-326 | todo |
| BUJ-432 | As the platform, reviews held during open disputes; anomaly detection on review patterns | P1 | M | BUJ-431, BUJ-408 | todo |

### Epic E4.4 Country & legal configuration

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-441 | As admin (`admin.countries.manage`), per-country config: payment provider, enabled features, legal docs versions | P0 | M | BUJ-161 | todo |
| BUJ-442 | As a user, localized terms/privacy versions accepted and recorded per country | P0 | M | BUJ-441 | todo |
| BUJ-443 | As a user, data export and account deletion (GDPR/KVKK/LGPD-style rights) | P0 | M | BUJ-136 | todo |

---

## Phase 5 — Events & Community

### Epic E5.1 Events

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-501 | As an organizer (`org.events.manage`), I can publish events with lineup, venue and age restriction | P0 | M | BUJ-204, BUJ-203 | todo |
| BUJ-502 | As a user, I can RSVP / mark interest in an event | P0 | S | BUJ-501 | todo |
| BUJ-503 | As a user, I can follow artists/venues and see their upcoming events | P1 | M | BUJ-501 | todo |

### Epic E5.2 Weekly meetups

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-511 | As an organizer/venue, I can create a recurring weekly meetup (e.g. jam session) with recurrence in the venue's local time zone (DST-safe) | P0 | M | BUJ-501 | todo |
| BUJ-512 | As a user, I can find and join meetups near me and get a reminder before each occurrence | P1 | M | BUJ-511, BUJ-242 | todo |

### Epic E5.3 Group networking

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-521 | As a user, I can create or join groups (by city, genre, instrument) | P0 | M | BUJ-131 | todo |
| BUJ-522 | As a group admin, I can manage membership, rules and remove members | P1 | M | BUJ-521 | todo |

### Epic E5.4 Event messaging

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-531 | As an attendee/group member, I can chat in an event or group channel | P0 | L | BUJ-301, BUJ-501, BUJ-521 | todo |
| BUJ-532 | As an organizer, I can send announcements to attendees within notification caps | P1 | S | BUJ-501, BUJ-243 | todo |

### Epic E5.5 Community discovery

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-541 | As a user, I see a discovery feed of nearby events, meetups and groups | P0 | M | BUJ-231, BUJ-511, BUJ-521 | todo |
| BUJ-542 | As a user, discovery respects my locale, country and time zone settings (D9) | P1 | S | BUJ-541 | todo |

---

## Phase 6 — Challenges & Growth

### Epic E6.1 Challenges & voting

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-601 | As a musician, I can enter a challenge with media submission | P0 | M | BUJ-212 | todo |
| BUJ-602 | As a user, I can vote in challenges; anti-bot rules (account age, verified email, clustering) | P0 | M | BUJ-601 | todo |
| BUJ-603 | As ops, prize challenges only enabled per country after contest/sweepstakes law review (doc 20 §2.12) | P1 | S | BUJ-601, BUJ-441 | todo |

### Epic E6.2 Moderation

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-611 | As trust_safety (`admin.moderation.act`), I work a moderation queue with reports, actions, appeals | P0 | L | BUJ-303, BUJ-161 | todo |
| BUJ-612 | As an EU user, notice-and-action flow with statement of reasons (DSA) | P0 | M | BUJ-611 | todo |

### Epic E6.3 Sponsorship

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-621 | As a sponsor, I can back a challenge or event; content is clearly labelled "Sponsored" | P1 | M | BUJ-601, BUJ-501 | todo |
| BUJ-622 | As a sponsor, I see aggregated (non-personal) performance reporting | P2 | M | BUJ-621, BUJ-633 | todo |

### Epic E6.4 Advanced discovery & analytics

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-631 | As a user, I get recommendations and saved-search alerts | P1 | L | BUJ-231, BUJ-242 | todo |
| BUJ-632 | As an org owner/admin, I see profile views, application and booking conversion | P1 | M | BUJ-324 | todo |
| BUJ-633 | As an `analyst`, I see privacy-preserving platform aggregates per country/locale | P1 | M | BUJ-161 | todo |

### Epic E6.5 Premium & digital purchases (D11)

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-641 | As a developer, separate `billing-digital` module with server-authoritative entitlements (D11) | P0 | L | BUJ-402 | todo |
| BUJ-642 | As an iOS/Android user, premium subscription via store billing where required (after doc 15 §12 review) | P0 | L | BUJ-641 | todo |
| BUJ-643 | As a web user, premium subscription via web checkout | P2 | M | BUJ-641 | todo |
| BUJ-644 | As a musician, profile boost purchase, labelled as promoted; never affects verification (D12) | P2 | M | BUJ-641 | todo |

### Epic E6.6 Launch hardening

| ID | Story | Prio | Size | Deps | Status |
|---|---|---|---|---|---|
| BUJ-651 | As an operator, external pen test findings remediated | P0 | L | Phases 1–5 | todo |
| BUJ-652 | As an operator, quarterly restore drill passes RPO/RTO (doc 18) | P0 | M | — | todo |
| BUJ-653 | As an operator, load tests pass for search and emergency fan-out at launch scale | P0 | M | BUJ-233, BUJ-332 | todo |
| BUJ-654 | As a launch manager, first country completes doc 20 checklist | P0 | L | BUJ-410, BUJ-442 | todo |

---

## Notes

- Phase 1 stories are marked `in progress` as the active foundation work; nothing is `done` until merged with tests per doc 17.
- BUJ-410 is `blocked` on a signed provider contract and legal sign-off (doc 15 §14).
- Blocking, muting and reporting ship in Phase 3 (BUJ-303); the full moderation queue and DSA flow are Phase 6 (BUJ-611, BUJ-612) and are prerequisites for any EU launch (doc 20 §2.6).
- Stories touching payments, auth, or migrations require CODEOWNERS review (doc 18 §11).
