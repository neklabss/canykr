# 01 — Product Requirements Document (PRD)

Status: Draft v0.1 · Owner: Product · Depends on: [00-decisions.md](00-decisions.md)
Product name **BackUpJam** is a working name. Domain, trademark and app-store name availability are NOT verified (see §11).

---

## 1. Vision

A single, global place where anyone who makes live music happen can **find, book, staff and pay** the right people quickly and safely, and where the music community can **show work, meet and grow** around real gigs.

One account, many hats: a person can be a `musician`, a `band_manager` and a `venue_staff` at the same time (capabilities from 00-decisions). Organizations (`band`, `venue`, `agency`, `organizer`, `company`) are first-class and act through role-based permissions.

## 2. Problem

| # | Problem | Who feels it | Today's workaround | Cost of workaround |
|---|---|---|---|---|
| P1 | Finding a qualified substitute at short notice (e.g. "drummer needed tonight") | Bands, venues, organizers | WhatsApp groups, phone calls, Instagram DMs | Hours lost, cancelled gigs, no quality signal |
| P2 | No trustworthy signal of who is real and reliable | Everyone | Word of mouth, follower counts | Fake profiles, no-shows, scams |
| P3 | Price negotiation is scattered and unrecorded | Venues, bands | Chat messages, verbal deals | Disputes about what was agreed |
| P4 | Payment for in-person gigs is cash/IBAN with no protection | Musicians, crew | Cash on the night, bank transfer later | Late or missing payment, no refund path |
| P5 | Staffing an event with many roles (band, sound, lights, MC) needs N separate conversations | Organizers, agencies | Spreadsheets + many chats | Errors, double-booking |
| P6 | Cross-border musicians (diaspora, touring) face language/currency mismatch | Migrant/touring musicians | Personal networks | Missed opportunities |
| P7 | Reviews on general platforms are not tied to real gigs | Bookers | Google reviews, hearsay | Unreliable reputation |

## 3. Personas

Personas map to user capabilities and org roles from 00-decisions.

| Persona | Capabilities / roles | Primary jobs-to-be-done | Key pain | Success looks like |
|---|---|---|---|---|
| **Deniz — gigging musician** (drummer, Istanbul, 28) | `musician`, `band_member`, `music_teacher` | Get paid gigs, sub for other bands, fill weeknights | Irregular income, unpaid invoices | 4+ extra paid gigs/month, paid within agreed window |
| **Sofia — band manager** (5-piece cover band, Lisbon) | `band_manager`; org `band` role `owner` | Book band at venues/weddings, find subs, negotiate fees | Endless back-and-forth, missing members | Offers tracked, subs found in < 1 h |
| **Marco — venue manager** (bar with stage, Milan) | `venue_owner`; org `venue` role `owner`; his bar staff `venue_staff`/`staff` | Fill a weekly calendar, stay in budget, avoid no-shows | Last-minute cancellations | Calendar ≥ 85 % filled, no-show rate < 2 % |
| **Leila — event organizer** (festivals & corporate, Dubai, Arabic UI) | `organizer`; org `organizer` role `admin` | Staff events with many positions, coordinate timing | Spreadsheets, many chats | One event board with all positions filled |
| **Kenji — booking agency** (Tokyo, roster of 40 artists) | `booking_agent`, `artist_manager`; org `agency` | Represent artists, negotiate on their behalf, see finance | Tracking many deals | All roster deals and payouts in one view |
| **Ayşe — tech crew** (sound engineer, Turkish, lives in Berlin) | `sound_engineer`, `lighting_technician` | Find crew jobs, be discoverable by venues | Invisible compared to performers | Profile shows rigs/skills; 2+ crew jobs/week |
| **Tom — enthusiast / customer** (London) | `enthusiast`, `customer` | Discover local gigs, follow artists, book a band for a party | Hard to find trustworthy acts | Books a vetted band, leaves a review |
| **Platform staff** | `super_admin`, `trust_safety`, `finance_ops`, `support`, `localization_manager`, `analyst` | Review verification, moderate, refund, manage locales/countries | Lack of tooling, no audit trail | SLA met, every action audited |

## 4. Goals and non-goals

### 4.1 Goals

| ID | Goal | Linked problem |
|---|---|---|
| G1 | Fill an emergency request (≤ 24 h to gig) with a qualified, available person, fast | P1 |
| G2 | Make trust visible and earned: verification badges (`identity_verified`, `official_band`, `official_artist`, `verified_venue`, `verified_organizer`) are never purchasable | P2 |
| G3 | Every booking is backed by an immutable agreed-terms snapshot from the offer/counter-offer thread | P3 |
| G4 | In-person bookings are paid via a licensed marketplace payment provider (D10); no homemade escrow/wallet | P4 |
| G5 | Organizers manage multi-position events in one place | P5 |
| G6 | Locale, country, currency and time zone are independent (D9); 16 launch locales incl. RTL Arabic | P6 |
| G7 | Reviews only from parties of a completed booking | P7 |
| G8 | Public profiles and directories are SEO-indexable on web | Growth |

### 4.2 Non-goals (explicitly out of scope)

- Ticketing / selling tickets to fans (may revisit after Phase 6).
- Music streaming, distribution or royalty collection.
- Holding user funds, issuing wallets, crypto, or any stored-value product (D10).
- Gambling, betting, paid voting, loot boxes or randomised paid rewards in challenges.
- Employment contracts / payroll / tax filing on behalf of users (we surface provider invoices only).
- Paid verification or "verified" as part of a premium plan (D12).
- Building our own video-call product (link out to external tools).
- Instrument / gear marketplace (possible later; not in Phase 1–6).

## 5. Success metrics

All targets are hypotheses for the first 12 months after a market opens; they must be re-baselined after 8 weeks of real data.

| Metric | Definition | Initial target | Caveats |
|---|---|---|---|
| Emergency fill rate | % of emergency requests with an accepted candidate before `needed_at` | ≥ 60 % | Depends heavily on supply density per city; report per city, not global |
| Median time-to-first-response (emergency) | From publish to first candidate response | ≤ 20 min | Quiet hours and notification caps intentionally slow this at night |
| Offer → booking conversion | % of offer threads ending in `accepted` | ≥ 35 % | Low conversion may be healthy (price discovery) |
| Booking completion rate | % of confirmed bookings reaching `completed` | ≥ 95 % | Weather/force majeure cancellations should be excluded |
| No-show rate | % of confirmed bookings with a confirmed no-show dispute | ≤ 2 % | Self-reported; requires dispute evidence |
| Review coverage | % of completed bookings with ≥ 1 review | ≥ 40 % | Prompting too hard inflates positivity |
| Verification review SLA | Median time from submit to decision | ≤ 48 h | Staffing-dependent; KYC provider latency |
| Dispute resolution time | Median from open to resolution | ≤ 7 days | Provider chargeback timelines are outside our control |
| WAU/MAU | Stickiness of active users | ≥ 0.35 | Seasonality (wedding season, holidays) |
| Locale completeness | % of exposed locales passing completeness test | 100 % of exposed | `machine_draft` locales are hidden by design |
| Crash-free sessions (mobile) | Sessions without crash | ≥ 99.5 % | — |

Vanity metrics (follower counts, challenge vote totals) are **not** success metrics and must not drive ranking.

## 6. Scope per phase

Phases are sequential; each has an exit criterion. Phase numbering aligns with 00-decisions (D13 realtime = Phase 3, D14 queues & D15 media = Phase 2).

### Phase 1 — Foundation & identity
- Accounts: email/password (scrypt, D6), Google & Apple OIDC (D7), JWT + rotating refresh (D5), email verification, password reset, account deletion request.
- Capabilities self-declaration; user settings for `locale`, `country_code`, `currency_code`, `time_zone` (D9).
- Personal profiles (musician/crew fields: instruments, genres, skills, location via PostGIS, travel radius, rate "from X").
- Organizations: create `band`/`venue`/`agency`/`organizer`/`company`; invite members; org roles & permissions.
- Public web profile pages (SEO) and basic directory listing with filters.
- i18n pipeline (D8) with `en` + `tr` fully reviewed; others `machine_draft` hidden.
- Admin: staff login (separate audience, D17), user lookup, suspend, audit log.
- **Exit**: a user can sign up, create a profile and org, and be found on web in 2 locales.

### Phase 2 — Marketplace core
- Jobs & applications (post, apply, shortlist, hire).
- Emergency requests with matching, notification limits, quiet hours, auto-close when filled.
- Notifications (push, email, in-app) on BullMQ (D14).
- Media uploads (S3, signed URLs, malware scan hook, D15): audio/video samples, photos, verification documents.
- Verification requests & appeals; staff review queue.
- Search & ranking v1 (organic only).
- **Exit**: an emergency request can be published and filled end-to-end with notifications.

### Phase 3 — Negotiation, bookings & messaging
- Offers / counter-offers thread with versioning; acceptance produces immutable booking snapshot.
- Bookings lifecycle (confirmed → completed / cancelled / disputed).
- Messaging 1:1 and org inbox; realtime via WebSocket gateway (D13).
- Calendar & availability.
- **Exit**: 12,000 TRY budget → 14,000 offer → 12,500 counter → accepted flow works with snapshot (see journey J3).

### Phase 4 — Payments, reviews & disputes
- `PaymentProvider` interface wired to first licensed provider per launch country; `MockPaymentProvider` only in non-prod and clearly labelled.
- Payment collection, payout onboarding (provider-hosted KYC), refunds, disputes.
- Reviews tied to completed bookings; org responses.
- Finance views for org (`org.finance.view`) and staff (`admin.finance.read`, `admin.finance.refund`).
- **Exit**: one real country live with a signed provider contract.

### Phase 5 — Events & staffing
- Events with multiple staffing positions; per-position offers and bookings.
- Public events calendar (SEO), community events (free, non-ticketed).
- Organizer and venue dashboards.
- **Exit**: organizer staffs an event with 5 positions (journey J4).

### Phase 6 — Community & growth
- Social: follow, posts, comments, reactions, share.
- Challenges with anti-bot voting, copyright controls, no gambling mechanics.
- Sponsored placements (clearly labelled, separated from organic ranking).
- Premium subscriptions / boosts (D11, store billing review per territory).
- All 16 launch locales passing completeness and native review.
- **Exit**: sponsored and organic results provably separated; challenges run with fraud metrics below threshold.

## 7. Platform scope summary

| Surface | Tech (00-decisions) | Primary audience | Notes |
|---|---|---|---|
| Mobile app | Flutter 3.x (D16) | All end users | 5-tab nav: Discover, Jobs, Create, Messages, Profile |
| Web | Next.js 15 App Router (D17) | End users + SEO visitors | Public pages server-rendered and indexable |
| Admin | Separate Next.js app (D17) | Platform staff | Separate deploy & auth audience |
| API | NestJS 11 modular monolith (D2) | All clients | OpenAPI exported (D18) |
| Data | PostgreSQL 16 + PostGIS 3 (D3) | — | Money in minor units (D4) |

## 8. Assumptions

| ID | Assumption | How we validate | If false |
|---|---|---|---|
| A1 | Musicians will keep a profile updated if it brings paid work | Profile freshness vs. booking rate | Add availability nudges, auto-staleness label |
| A2 | Venues accept paying through the platform when it gives cancellation protection | Phase 4 pilot conversion | Allow "off-platform payment" bookings with reduced protections |
| A3 | Supply density of ~200 active musicians per city enables emergency fills | Fill rate per city | Launch city-by-city, seed supply manually |
| A4 | Licensed marketplace providers exist and will onboard us in each launch country | Provider conversations | Delay payments in that country; bookings without payment |
| A5 | Store billing rules allow boosts as in-app purchases in key territories | Legal review per territory (D11) | Web-only purchase or remove boosts |
| A6 | Users accept one account with multiple capabilities | Onboarding analytics | Offer "switch context" UI |
| A7 | Machine-draft translations plus native review are affordable for 16 locales | Localization budget | Fewer launch locales; keep `en` fallback |

## 9. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Cold-start: no supply in a city | High | High | City launch playbook; seed via partners, agencies |
| R2 | Payment/regulatory: operating as unlicensed payment intermediary | Medium | Critical | D10: provider holds funds; legal review before each country |
| R3 | Fraud: fake profiles, fake reviews, bot votes | High | High | Verification, booking-tied reviews, rate limits, device signals |
| R4 | Safety: in-person meetings with strangers | Medium | High | Verification badges, report/block, safety tips, T&S escalation |
| R5 | Disintermediation (users take deals off-platform) | High | Medium | Value from protection, reviews, calendar; no punitive chat scanning beyond scam detection |
| R6 | Notification fatigue from emergency requests | Medium | Medium | Per-user caps, quiet hours, relevance threshold |
| R7 | Copyright claims on challenge/media uploads | Medium | Medium | Notice-and-takedown, rights declaration, fingerprinting later |
| R8 | RTL / CJK / Devanagari layout bugs | Medium | Medium | Design system rules (06), pseudo-locale tests |
| R9 | Trademark conflict with "BackUpJam" | Unknown | High | Search before public launch (§11) |
| R10 | Sponsored content perceived as deceptive | Medium | High | Mandatory label, separate slots, never mixed into organic rank |
| R11 | Store billing rejection for boosts | Medium | Medium | Separate module (D11), territory review |

## 10. Dependencies

- Licensed marketplace payment provider contract per country (D10).
- KYC / identity verification vendor for `identity_verified` (or provider-hosted KYC).
- Push providers (APNs, FCM), transactional email provider.
- Map/geocoding provider for PostGIS-backed location search.
- Legal: Terms, Privacy Policy, Community Guidelines, Cookie Policy per region (GDPR, KVKK, LGPD etc.).

## 11. Open blocking decisions

These block the phases indicated. Owner must record outcome as a new row in 00-decisions.

| ID | Decision | Options | Blocks | Owner | Notes |
|---|---|---|---|---|---|
| OD1 | **Payment provider per country** | TR: iyzico Marketplace / Param / Stripe (not available in TR); EU: Stripe Connect / Adyen for Platforms / Mangopay; UAE: Stripe / Checkout.com; BR: Stripe / Pagar.me; others TBD | Phase 4 per country | Finance + Legal | Only `MockPaymentProvider` until a contract is signed; mock must be visibly labelled in UI |
| OD2 | **Legal entity & domicile** | Single EU entity / TR entity + EU entity / holding + local subsidiaries | Phase 4, provider onboarding, Terms | Founders + Legal | Determines contracting party, data controller, VAT/KDV handling |
| OD3 | **Product name & trademark** | Keep "BackUpJam" after clearance / rename | Public launch, store listings, domains | Founders | Run TM searches (EUIPO, TÜRKPATENT, USPTO, WIPO), domain and store-name checks |
| OD4 | Platform fee model | % of booking from booker / from performer / split / flat | Phase 4 | Product + Finance | Must be shown before acceptance, included in snapshot |
| OD5 | Cancellation policy defaults | Flexible / moderate / strict tiers | Phase 3 | Product + Legal | Snapshot stores the policy text version |
| OD6 | KYC vendor | Provider-hosted KYC vs. separate vendor | Phase 2 verification | T&S | Avoid storing raw ID documents longer than required |
| OD7 | Minimum age | 16 vs 18 (per country) | Phase 1 | Legal | Affects bookings with payouts (likely 18) |

## 12. Glossary

| Term | Meaning |
|---|---|
| Capability | Self-declared hat on a user account (e.g. `musician`) |
| Organization | Band, venue, agency, organizer or company acting through members with roles |
| Job | A posted opportunity with applications |
| Emergency request | A job with `needed_at` ≤ 24 h, special matching & notification rules |
| Offer thread | Versioned sequence of offers / counter-offers between two parties |
| Snapshot | Immutable copy of agreed terms created at acceptance |
| Booking | Confirmed engagement created from an accepted offer |
| Position | A staffing slot inside an event (e.g. "Drummer", "FOH engineer") |
| Minor units | Integer smallest currency unit (D4) — e.g. 12,000.00 TRY = `1200000` |
