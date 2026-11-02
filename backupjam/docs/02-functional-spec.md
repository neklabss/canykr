# 02 — Functional Specification

Status: Draft v0.1 · Depends on: [00-decisions.md](00-decisions.md), [01-prd.md](01-prd.md), [03-roles-permissions-matrix.md](03-roles-permissions-matrix.md)

Phase numbers follow the official plan (01-prd §6, 07-architecture §5, 19-backlog): 1 Foundation · 2 Marketplace · 3 Communication & Offers · 4 Payments & Trust · 5 Events & Community · 6 Challenges & Growth. Where a module spans phases, individual ACs carry a `[Pn]` tag.

Conventions
- **AC** = acceptance criterion. Each AC is testable; "MUST" is mandatory for the phase listed.
- Money is integer minor units + ISO-4217 code (D4). Examples show major units for readability.
- All timestamps stored UTC; displayed in the viewer's `time_zone` (D9). Event-local times also show the venue's zone.
- Every state-changing API call writes an audit record (`actor_id`, `acting_as_org_id?`, `action`, `target`, `before`, `after`, `ip`, `ua`).
- Module names match NestJS domain modules (D2).

---

## 1. `accounts` / `auth` (Phase 1)

**Scope**: sign-up, login, sessions, social login, recovery, deletion, settings.

- AC-AUTH-01: Email sign-up requires email, password (≥ 10 chars, checked against a breached-password list), date of birth, `country_code`, `locale` (pre-filled from device), and acceptance of Terms + Privacy version IDs (stored).
- AC-AUTH-02: Passwords hashed with scrypt N=2^15, r=8, p=1, per-user salt; hash string carries a version prefix so parameters can be upgraded on next login (D6).
- AC-AUTH-03: Login returns a 15-min JWT access token and an opaque refresh token; refresh token is stored hashed, rotates on every use; reuse of a rotated token revokes the whole family and forces re-login on all devices (D5).
- AC-AUTH-04: Google and Apple sign-in verify the OIDC ID token signature against provider JWKS, `aud`, `iss`, `exp`, and nonce (D7). Apple "hide my email" relay addresses are accepted.
- AC-AUTH-05: Linking a social identity to an existing email account requires being logged in to that account (no silent merge by email).
- AC-AUTH-06: Email verification link valid 24 h, single use. Unverified accounts can browse and edit profile but cannot apply, offer, message or publish.
- AC-AUTH-07: Password reset tokens valid 30 min, single use; response is identical whether or not the email exists.
- AC-AUTH-08: Rate limits: 5 failed logins / 15 min per account + per IP → progressive delay; 3 reset emails / hour.
- AC-AUTH-09: Users under the minimum age (OD7, default 18 for payouts, 16 for browsing/social where allowed) cannot accept bookings with payouts.
- AC-AUTH-10: Settings: `locale`, `country_code`, `currency_code`, `time_zone` are independent; changing one never changes another automatically after onboarding (D9).
- AC-AUTH-11 [P4]: Account deletion: soft-delete immediately (profile hidden), hard-delete personal data after 30 days, except records with legal retention (bookings, payments, audit). Blocked while user has open bookings or open disputes; UI lists blockers.
- AC-AUTH-12 [P4]: Data export (GDPR/KVKK/LGPD) generates a downloadable archive within 72 h.
- AC-AUTH-13: Active sessions list with device, last seen, and "sign out" per session.

## 2. `profiles` (Phase 2; capabilities & preferences Phase 1)

- AC-PROF-01 [P1]: A user declares one or more capabilities from the fixed list (`musician`, `band_member`, `band_manager`, `venue_owner`, `venue_staff`, `organizer`, `booking_agent`, `artist_manager`, `sound_engineer`, `lighting_technician`, `music_teacher`, `enthusiast`, `customer`). At least one is required.
- AC-PROF-02: Performer/crew fields: display name, handle (unique, 3–30 chars, `[a-z0-9_.]`), bio (per-locale variants optional), instruments (taxonomy IDs + proficiency), genres, skills (e.g. "reads charts", "IEM rig"), languages spoken, base location (PostGIS point, stored precise, exposed rounded to ~1 km), travel radius km, "from" rate (amount + currency + unit: per gig / per hour), equipment owned, media samples.
- AC-PROF-03: Handle change allowed once per 30 days; old handle redirects for 90 days (web 301).
- AC-PROF-04: Visibility: `public` (indexable), `members_only` (logged-in users), `hidden`. Default `public` for performers, `members_only` for enthusiasts.
- AC-PROF-05 [P3]: Availability calendar: busy blocks (private reason) + "available for emergency" toggle with time windows.
- AC-PROF-06: Profile completeness score shown only to the owner; never displayed publicly.
- AC-PROF-07: Rate display converts to viewer's `currency_code` with "≈" prefix and the original currency on tap; settlement always in the offer currency (D4).
- AC-PROF-08: Public web profile at `/{locale}/u/{handle}` server-rendered with `hreflang` alternates, JSON-LD `Person`/`MusicGroup`, canonical URL.

## 3. `bands` (Phase 2)

A band is an organization of type `band` (org + memberships exist from Phase 1; band profile fields arrive in Phase 2).
- AC-BAND-01: Create band with name, genres, home city, line-up (linked members or placeholder names), "from" fee.
- AC-BAND-02: Line-up entries link to user accounts via invite; invitee accepts to appear. Placeholder members are shown without profile link.
- AC-BAND-03: A user can belong to multiple bands; each membership has an org role (`owner`/`admin`/`manager`/`member`/`staff`).
- AC-BAND-04 [P4]: `official_band` badge is requested via verification (§6), never bought.
- AC-BAND-05: There is always exactly one `owner`; ownership transfer requires target acceptance and re-auth of current owner.

## 4. `venues` (Phase 2)

- AC-VEN-01: Venue org fields: name, address (geocoded), capacity (standing/seated), stage size, backline list, PA spec, load-in notes, accessibility info, opening hours, genres hosted, typical budget range (private by default).
- AC-VEN-02: Venue public page shows upcoming public events and reviews from completed bookings.
- AC-VEN-03 [P4]: `verified_venue` requires proof of operation (business registration or utility bill + photos) reviewed by staff.

## 5. `organizations` (Phase 1)

- AC-ORG-01: Types: `band`, `venue`, `agency`, `organizer`, `company`.
- AC-ORG-02: Roles and permissions exactly as in 00-decisions; custom roles are not supported in Phases 1–6.
- AC-ORG-03: Invitations by email or handle, expire after 7 days; acceptor chooses nothing — role is set by inviter within their permission (`org.members.manage`; assigning `admin` requires `org.roles.assign_admin`).
- AC-ORG-04: Every org action records `acting_as_org_id` and the member's role at the time.
- AC-ORG-05: "Act as" switcher on mobile/web lists personal profile + each org; current context is always visible in the header.
- AC-ORG-06: Org deletion (`org.delete`) blocked while bookings are open or payouts pending.
- AC-ORG-07: Agencies can link represented artists (user or band org) with the artist's consent; the agency then negotiates on their behalf with `org.offers.negotiate`.

## 6. `verification` (Phase 4)

Badges: `identity_verified`, `official_band`, `official_artist`, `verified_venue`, `verified_organizer` (D12).
- AC-VER-01: Badges are never purchasable, never bundled with premium, and ranking never weights premium status as a proxy for verification.
- AC-VER-02: Request flow: choose badge → upload evidence (documents to private bucket, signed URLs, malware scan) → submit → status `pending` → `approved` / `rejected` (reason code + free text) / `needs_more_info`.
- AC-VER-03: `identity_verified` uses KYC vendor or provider-hosted KYC (OD6); we store only result, vendor reference and expiry, not raw ID images beyond vendor retention.
- AC-VER-04: Staff with `admin.verification.review` decide; the reviewer cannot be the requester or a member of the requesting org.
- AC-VER-05: Rejection allows one appeal within 30 days; appeal goes to a different reviewer. Second rejection is final for 90 days.
- AC-VER-06: Badges can be revoked (`admin.moderation.act`) with reason; user is notified and may appeal.
- AC-VER-07: Every badge has an explainer (what it proves, what it does not, date verified) reachable by tap/hover.
- AC-VER-08: Material profile change (legal name, venue address) on a verified entity flags the badge for re-review; badge stays visible with "under review" only to the owner.

## 7. `jobs` & applications (Phase 2)

- AC-JOB-01: A job has: title, type (`performer`, `substitute`, `crew`, `teaching`, `session`), required instruments/skills, genres, location (venue or point) or remote, date/time window, budget (min–max or fixed, currency), description, application deadline, visibility (`public`, `invite_only`), posting identity (user or org with `org.jobs.manage`).
- AC-JOB-02: States: `draft` → `open` → (`paused`) → `filled` | `closed` | `expired`.
- AC-JOB-03: Apply with message, optional proposed fee (creates an offer thread on shortlist), media sample selection.
- AC-JOB-04: Poster sees applicants with filters; actions: shortlist, decline (template reason, optional), message, make offer.
- AC-JOB-05: Applicant sees status: `submitted`, `viewed`, `shortlisted`, `declined`, `offer_received`, `hired`, `withdrawn`.
- AC-JOB-06: A job with N openings becomes `filled` when N bookings are confirmed; remaining applicants are auto-notified once (batched).
- AC-JOB-07: Public jobs listed on web job marketplace (indexable, JSON-LD `JobPosting` only for paid jobs with a valid date) and removed from index (410) when closed.
- AC-JOB-08: Job posts that request off-platform payment details or contain contact info in the description are flagged for review (soft block, explanation shown).

## 8. Emergency requests (Phase 3)

An emergency request is a job with `is_emergency = true` and `needed_at` ≤ 24 h from publish.

- AC-EMG-01: Creation in ≤ 4 steps: role/instrument, time & place, fee (fixed, required), notes (set list link, dress code). Defaults from poster's venue/band.
- AC-EMG-02: Matching candidates: capability match, instrument/skill match, `available for emergency` on and calendar free, within travel radius (PostGIS `ST_DWithin`) of the location, not blocked by/blocking poster, account in good standing.
- AC-EMG-03: Ranking of candidates: distance, reliability (completion rate, no-show history), rating from completed bookings, response speed; **never** premium status or boosts.
- AC-EMG-04: Notification waves: wave 1 = top 15 candidates immediately; if < 2 responses after 10 min, wave 2 = next 30; then wave 3 widens radius ×1.5 (once). Max 3 waves.
- AC-EMG-05: Per-recipient limits: max 3 emergency pushes per rolling 24 h, max 1 per 60 min; excess goes to in-app inbox only.
- AC-EMG-06: Quiet hours: recipient-defined (default 23:00–08:00 in recipient `time_zone`). During quiet hours push is suppressed unless the recipient opted into "emergencies during quiet hours"; in-app item still created.
- AC-EMG-07: Per-poster limits: max 3 active emergency requests per user/org; max 10 per 7 days without `verified_venue`/`verified_organizer`/`identity_verified`. Until badges ship in Phase 4, the poster must have ≥ 1 completed booking to send emergency requests.
- AC-EMG-08: Candidate response: `I'm available` (optional note) or `Not this time`. Poster sees responders in real-time order with distance and ETA estimate.
- AC-EMG-09: Poster selects a responder → offer at the posted fee (counter allowed once, 15-min expiry) → acceptance creates booking.
- AC-EMG-10: **Auto-close when filled**: when the required number of bookings is confirmed, the request closes atomically (DB transaction with row lock), pending waves are cancelled, outstanding notifications are recalled (push "this spot has been filled" sent only to users who responded; others get silent in-app update).
- AC-EMG-11: Auto-expire at `needed_at`; poster prompted to repost or convert to a normal job.
- AC-EMG-12: Emergency fee must be ≥ the country's configured minimum (`admin.countries.manage`) to avoid exploitative requests.

## 9. Events, staffing positions & community (Phase 5)

- AC-EVT-01: Event fields: title, organizer org, venue (org or free-text address), start/end with time zone, visibility (`public`, `private`), category (gig, wedding, corporate, festival, community), cover image, description.
- AC-EVT-02: Positions: each has role (instrument/crew type), count, fee or budget range, call time, notes, status (`open`, `offered`, `filled`, `cancelled`).
- AC-EVT-03: Each position can be filled by posting it as a job, inviting specific profiles, or attaching an existing booking.
- AC-EVT-04: Event board shows positions with status chips; event is "fully staffed" when all positions are `filled`.
- AC-EVT-05: Run-sheet: ordered timeline items visible to all booked parties; changes after booking notify all parties and are versioned.
- AC-EVT-06: Cancelling an event triggers cancellation flow for each linked booking per its snapshot policy.
- AC-EVT-07: Public events appear in web events calendar (indexable, JSON-LD `MusicEvent`/`Event`).
- AC-EVT-08: Community events / meetups (free, non-commercial, optionally weekly recurring) can be created by any verified-email user; they have no positions or payments.
- AC-EVT-09: RSVP (`going`, `interested`, `not_going`) with optional capacity and waitlist; organizer sees attendee list.
- AC-EVT-10: Event chat: an event channel for RSVP'd attendees / booked parties, reusing messaging (§14) moderation and block rules.
- AC-EVT-11: Community discovery: nearby events, meetups and groups by genre/instrument, ordered by date and distance (no sponsored items mixed in).

## 10. `offers` / negotiation (Phase 3)

- AC-OFF-01: An offer thread is between a **booker party** (user or org) and a **performer party** (user or org), optionally linked to a job, position or emergency request.
- AC-OFF-02: An offer version contains: amount (minor units), currency, date/time, location, duration, set count, inclusions (backline, travel, accommodation, meals), cancellation policy ID+version, platform fee preview (OD4), expiry (default 72 h, emergency 15 min), free-text terms.
- AC-OFF-03: Versions are append-only. Each counter-offer creates version n+1 with a diff against n. No edits to past versions.
- AC-OFF-04: Only the party that did **not** author the latest version can accept or counter it. On org sides, the acting member needs `org.offers.negotiate`.
- AC-OFF-05: States: `pending` → `countered` (implicitly when a new version exists) → `accepted` | `declined` | `expired` | `withdrawn`.
- AC-OFF-06: Acceptance requires re-confirmation of key terms (amount, currency, date) in UI and creates an **immutable snapshot** (JSON + SHA-256 hash) containing the accepted version, both parties' identities and acting members, policy text versions, fee breakdown, and exchange rate used for display only.
- AC-OFF-07: Currency of the thread is fixed at version 1; changing currency requires withdrawing and starting a new thread.
- AC-OFF-08: Max 10 versions per thread; afterwards only accept/decline.
- AC-OFF-09: Concurrent accept/counter: the first committed transaction wins; the other receives `409 OFFER_STALE` and the UI reloads.

## 11. `bookings` (Phase 3)

- AC-BKG-01: Booking created only from an accepted offer snapshot; references `snapshot_id` and hash.
- AC-BKG-02: States (`pending_payment` only from Phase 4; before that bookings start at `confirmed`): `pending_payment` (if payments live in that country) → `confirmed` → `in_progress` (at start time) → `completed` (auto 24 h after end unless disputed) | `cancelled_by_booker` | `cancelled_by_performer` | `disputed` → `resolved`.
- AC-BKG-03: Changes after confirmation (time, set length) use an amendment offer; accepted amendment creates a new snapshot linked to the previous one.
- AC-BKG-04: Cancellation computes refund/compensation (money movement applied from Phase 4) from the snapshot policy; the UI shows the computed amount before confirming.
- AC-BKG-05: Booking adds calendar blocks for both parties; iCal export link per user.
- AC-BKG-06: Check-in (optional): performer taps "arrived" within 500 m of location; used as evidence only.

## 12. `payments` (Phase 4)

- AC-PAY-01: All money flows through the `PaymentProvider` interface (D10). The platform never holds funds in its own accounts.
- AC-PAY-02: Provider selected by booking country (OD1). If no provider exists for a country, bookings are "pay directly" with a visible notice that platform payment protection does not apply.
- AC-PAY-03: `MockPaymentProvider` is enabled only in non-production; every screen using it shows a "TEST PAYMENTS — no real money" banner.
- AC-PAY-04: Payee onboarding uses provider-hosted KYC/onboarding; we store provider account ID and status only.
- AC-PAY-05: Charge at confirmation (or deposit + balance per snapshot); payout release per provider rules after `completed`.
- AC-PAY-06: Refunds: initiated via cancellation policy (automatic) or by staff with `admin.finance.refund` (dispute outcome); partial refunds supported; every refund has a reason code and audit entry.
- AC-PAY-07: Webhooks from providers are signature-verified, idempotent (event ID dedupe), and reconcile payment state.
- AC-PAY-08: Amounts displayed in settlement currency; converted display uses "≈" and never alters the charged amount (D4).
- AC-PAY-09: Premium subscriptions/boosts on mobile follow App Store / Google Play billing per territory (D11) in a separate module; they are never mixed with booking payments.

## 13. `reviews` (Phase 4)

- AC-REV-01: Only the two parties of a booking in state `completed` or `resolved` can review, within 14 days after completion.
- AC-REV-02: One review per party per booking; rating 1–5 overall + optional sub-ratings (punctuality, professionalism, communication, sound/venue quality), text ≤ 2,000 chars.
- AC-REV-03: Double-blind: reviews publish when both submitted or when the window closes.
- AC-REV-04: The reviewed party (or org member with `org.reviews.respond`) can post one public response; editable within 48 h.
- AC-REV-05: Reviews cannot be removed by the reviewed party; only staff via moderation for policy violations (with audit).
- AC-REV-06: Incentivised reviews are prohibited; no rewards for reviewing.

## 14. `messaging` (Phase 3)

- AC-MSG-01: Conversations: 1:1, user↔org inbox, booking thread (auto-created, all booked parties), event thread.
- AC-MSG-02: Messaging a user you have no relationship with (no job/application/offer/booking/follow-back) is limited to 1 message request until accepted.
- AC-MSG-03: Org inbox: members with `org.messages.respond` can reply; replies show "Name · for OrgName".
- AC-MSG-04: Attachments: images, PDF, audio ≤ 25 MB, malware-scanned; links preview server-side.
- AC-MSG-05: Realtime delivery via WebSocket gateway (D13); offline queue on mobile; read receipts togglable.
- AC-MSG-06: Scam detection: messages containing payment-redirect patterns show a warning banner to the recipient; never silently blocked except known malicious URLs.
- AC-MSG-07: Report & block from any conversation; blocking hides profiles both ways and cancels pending message requests.

## 15. `notifications` (Phase 2)

- AC-NOT-01: Channels: push (APNs/FCM), email, in-app. Per-category preferences (bookings, offers, messages, emergency, jobs, social, marketing). Marketing is opt-in.
- AC-NOT-02: Transactional critical (booking cancelled, payment failed, dispute update) cannot be disabled in-app; push may be.
- AC-NOT-03: Quiet hours per user (see AC-EMG-06) apply to all non-critical push.
- AC-NOT-04: Localised in recipient `locale` using ICU messages (D8); amounts in recipient display currency with original.
- AC-NOT-05: Delivered via BullMQ with retries (exponential, max 5) and dedupe keys (D14).
- AC-NOT-06: Global per-user cap: max 20 push / 24 h across categories excluding messages & critical.

## 16. Search & ranking (Phase 2; availability filter Phase 3; badge filter Phase 4; sponsored & advanced discovery Phase 6)

- AC-SRCH-01: Search entities: people, bands, venues, organizers, jobs, events. Filters: capability, instrument, genre, distance, date availability, price "from" range, language spoken, verification badge.
- AC-SRCH-02: Organic ranking signals: relevance (text + taxonomy), distance, availability, completed-booking reliability, rating (Bayesian-smoothed), profile freshness. **Not** follower count, **not** premium, **not** boosts.
- AC-SRCH-03: Sponsored results occupy fixed, separate slots (max 2 per page, top and mid-list), each labelled "Sponsored" in the viewer's locale, with "Why am I seeing this?" explainer.
- AC-SRCH-04: A sponsored item never displaces or reorders organic results; the organic list is computed independently and sponsored items are interleaved only into reserved slots. The same entity may appear in both, labelled accordingly.
- AC-SRCH-05: Sponsored placements never appear in emergency candidate lists or in review/rating displays.
- AC-SRCH-06: Search is locale-aware (diacritic-insensitive, transliteration for Cyrillic/Arabic names where possible, CJK tokenization).
- AC-SRCH-07: Directory pages on web (`/{locale}/musicians/{city}/{instrument}`) are indexable only when they have ≥ 5 results; otherwise `noindex`.

## 17. `challenges` (Phase 6)

- AC-CHL-01: A challenge has theme, rules, start/end, eligibility, judging mode (`community_vote`, `jury`, `hybrid`), prizes (non-monetary or sponsor-provided, described).
- AC-CHL-02: **No gambling mechanics**: no paid entry, no paid votes, no purchasable vote multipliers, no random paid rewards, no wagers. Free entry only.
- AC-CHL-03: Submissions require rights declaration (original work or licensed; covers allowed only where the uploader declares a licence/territory permits); copyright notice-and-takedown flow with counter-notice.
- AC-CHL-04: Anti-bot voting: one vote per verified-email account per submission category; accounts < 7 days old or without verified email cannot vote; device + IP velocity limits; votes from suspected clusters are held and excluded from tallies pending review; final tallies published after fraud review.
- AC-CHL-05: Vote counts hidden until the challenge ends (reduces bandwagon/bot targeting).
- AC-CHL-06: Entrants cannot vote for themselves or their own org's entries.
- AC-CHL-07: Disqualification requires `admin.moderation.act` and a reason visible to the entrant.

## 18. `social` (Phase 6)

- AC-SOC-01: Follow users/orgs; feed of posts from followed entities in reverse-chronological order by default (algorithmic optional, clearly toggled).
- AC-SOC-02: Posts: text, images, audio/video clips, linked event/job; comments, reactions; share links.
- AC-SOC-03: Report post/comment; hide; mute; block.
- AC-SOC-04: Follower counts are visible but are not ranking signals (AC-SRCH-02).

## 19. `admin` (Phase 1+: users, suspend, audit, flags, countries implemented)

- AC-ADM-01: Separate Next.js app, separate auth audience, mandatory TOTP/WebAuthn MFA, IP allow-list optional (D17).
- AC-ADM-02: Staff roles and permissions per 03-roles-permissions-matrix; least privilege; `super_admin` cannot be assigned by self.
- AC-ADM-03: Every admin read of PII (`admin.users.read`) and every write is audit-logged; `admin.audit.read` views it; logs are append-only.
- AC-ADM-04: Queues: translation review [P1], verification [P4], disputes & payout exceptions [P4], reports/moderation at scale [P6] (basic report intake from Phase 3).
- AC-ADM-05: Feature flags (`admin.flags.manage`) with per-country / per-locale targeting.
- AC-ADM-06: Country config (`admin.countries.manage`): enabled flag, payment provider binding, minimum emergency fee, legal doc versions, age limits.
- AC-ADM-07: i18n (`admin.i18n.manage`): view locale completeness, mark locale reviewed (promote from `machine_draft`), never edit source keys directly in prod.

## 20. Disputes (Phase 4)

- AC-DSP-01: Either party can open a dispute on a booking from `in_progress` until 72 h after end; reason codes: no-show, late arrival, terms not met, quality, payment issue, safety.
- AC-DSP-02: Evidence: messages (auto-attached booking thread), photos, check-in data, files.
- AC-DSP-03: Payout is held (via provider) while dispute open.
- AC-DSP-04: Staff (`trust_safety` for safety, `finance_ops` for money) resolve with outcome: no refund, partial refund, full refund; resolution text sent to both; one appeal within 7 days.
- AC-DSP-05: Safety reasons escalate immediately and surface local emergency-number guidance.
