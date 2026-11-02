# 09 — Entity Relationship Diagram

## 9.1 Implemented (Phase 1 — migrations 0001–0007)

```mermaid
erDiagram
  users ||--o{ user_identities : "logs in with"
  users ||--|| user_preferences : has
  users ||--|| onboarding_profiles : has
  users ||--o{ user_capabilities : declares
  users ||--o{ user_instruments : plays
  users ||--o{ user_genres : performs
  users ||--o{ user_languages : speaks
  users ||--o{ sessions : opens
  sessions ||--o{ refresh_tokens : rotates
  refresh_tokens |o--o| refresh_tokens : "parent"
  users ||--o{ email_tokens : receives
  users ||--o{ consent_records : grants
  users ||--o{ organization_memberships : "member of"
  organizations ||--o{ organization_memberships : has
  users ||--o| staff_members : "may be"
  users ||--o{ audit_logs : "acts in"
  instruments ||--o{ user_instruments : ""
  genres ||--o{ user_genres : ""
  countries }o--|| currencies : "default currency"
  countries }o--|| locales : "default locale"
  user_preferences }o--o| locales : "UI locale (null = auto)"
  user_preferences }o--o| countries : "market"
  user_preferences }o--o| currencies : "display currency"
  organizations }o--o| countries : "based in"

  users { uuid id PK citext email UK text password_hash text display_name citext username UK text status timestamptz email_verified_at }
  user_identities { uuid id PK uuid user_id FK text provider text provider_subject }
  sessions { uuid id PK uuid user_id FK timestamptz revoked_at text revoke_reason }
  refresh_tokens { uuid id PK uuid session_id FK bytea token_hash UK timestamptz used_at }
  organizations { uuid id PK text type citext slug UK text status }
  organization_memberships { uuid organization_id PK uuid user_id PK text role text status }
  staff_members { uuid user_id PK text role timestamptz revoked_at }
  audit_logs { bigint id PK uuid actor_user_id text action text target_type text target_id jsonb metadata }
  countries { char2 code PK char3 default_currency text launch_status bool payments_enabled text payment_provider }
```

Enforced invariants: unique email (case-insensitive), one identity per (provider, subject), quiet-hours pair, payments require a contracted provider (`CHECK`), every organization keeps ≥1 active owner (deferred constraint trigger), `audit_logs` and `consent_records` append-only (triggers), refresh/email tokens stored only as SHA-256 hashes.

## 9.2 Planned domain model (Phases 2–6)

```mermaid
erDiagram
  organizations ||--o| band_profiles : "type=band"
  organizations ||--o| venue_profiles : "type=venue"
  users ||--o| musician_profiles : "has"
  musician_profiles ||--o{ services : offers
  musician_profiles ||--o{ media_assets : portfolio
  band_profiles ||--o{ media_assets : portfolio
  venue_profiles ||--o{ media_assets : photos
  users ||--o{ verification_requests : submits
  organizations ||--o{ verification_requests : submits
  verification_requests ||--o{ verification_evidence : "encrypted docs"
  verification_requests ||--o{ verification_badges : grants
  jobs ||--o{ job_requirements : "positions (instrument, qty, budget)"
  events ||--o{ job_requirements : "staffing positions"
  job_requirements ||--o{ applications : receives
  applications ||--o| negotiations : opens
  negotiations ||--o{ offers : "revisions (draft→accepted)"
  offers ||--o| agreement_snapshots : "accepted → immutable"
  agreement_snapshots ||--|| bookings : creates
  bookings ||--o{ booking_status_history : "append-only"
  bookings ||--o{ payment_intents : "via PSP"
  payment_intents ||--o{ payment_transactions : ""
  payment_transactions ||--o{ refunds : ""
  bookings ||--o{ disputes : ""
  bookings ||--o{ commissions : ""
  bookings ||--o{ payouts : "provider-managed"
  bookings ||--o{ reviews : "only parties, after completion"
  reviews ||--o{ review_ratings : "per dimension"
  conversations ||--o{ conversation_participants : ""
  conversations ||--o{ messages : ""
  events ||--o{ event_participants : RSVP
  challenges ||--o{ challenge_submissions : ""
  challenge_submissions ||--o{ challenge_votes : "one per eligible voter"
  users ||--o{ notifications : receives
  users ||--o{ content_reports : files
  content_reports ||--o{ moderation_actions : ""
```

Party model for marketplace tables: a **party** is either a user (`party_type='user'`) or an organization (`party_type='organization'`), so offers/bookings/reviews work identically for a solo musician, a band, a venue or an agency. Financial tables follow docs/15 invariants (bigint minor units, ISO-4217, settlement currency = snapshot currency, append-only histories, provider event IDs unique).
