# 05 — User Journeys

Status: Draft v0.1 · Screen IDs from [04-screen-inventory.md](04-screen-inventory.md); rules from [02-functional-spec.md](02-functional-spec.md); permissions from [03-roles-permissions-matrix.md](03-roles-permissions-matrix.md).

Each journey: actors, preconditions, step table (actor · action · screen · system behaviour), failure branches, and what must be true at the end (postconditions). Platform fee values are placeholders until OD4 is decided.

---

## J1 — Musician onboarding

**Actor**: Deniz (`musician`, `music_teacher`), Istanbul, device locale `tr-TR`.
**Goal**: discoverable profile that can receive emergency requests.

| # | Actor | Action | Screen | System |
|---|---|---|---|---|
| 1 | Deniz | Opens app first time | M-AUTH-01 | UI in `tr` (device locale supported); language picker visible |
| 2 | Deniz | Taps "Sign up with Google" | M-AUTH-03 | OIDC ID token verified against Google JWKS (D7); account created; email marked verified (Google `email_verified=true`) |
| 3 | Deniz | Selects capabilities `musician`, `music_teacher` | M-AUTH-06 | At least one required |
| 4 | Deniz | Confirms `locale=tr`, `country_code=TR`, `currency_code=TRY`, `time_zone=Europe/Istanbul` | M-AUTH-07 | Stored independently (D9) |
| 5 | Deniz | Adds drums (advanced), genres rock/funk, base location Kadıköy, radius 25 km, "from" 3,000 TRY / gig | M-AUTH-08 | Location stored as PostGIS point; public exposure rounded |
| 6 | Deniz | Uploads 2 drum videos | M-PROF-03 | Signed upload URLs; processing + malware scan; "Processing" state until ready (D15) |
| 7 | Deniz | Turns on "Available for emergencies" Tue–Sun 17:00–23:00 | M-PROF-04 | Eligible for emergency matching |
| 8 | Deniz | Accepts notification primer, keeps default quiet hours 23:00–08:00 | M-AUTH-09 / M-PROF-20 | Push token registered |
| 9 | Deniz | Optional: requests `identity_verified` | M-PROF-12 | KYC flow; status `pending` |

Failure branches
- 2a. Email sign-up instead → M-AUTH-04 verify; until verified, apply/offer/message are disabled with banner (state V).
- 6a. Upload fails malware scan → file rejected, user told generically ("file couldn't be processed"), no details of scanner.
- 7a. Location permission denied → manual city entry; map view shows P state.

Postconditions: profile `public`, appears on `/tr/u/deniz`, in `W-DIR-01` for Istanbul/drums, and in emergency matching.

---

## J2 — Emergency "drummer needed tonight" end-to-end

**Actors**: Sofia (band org "Lisboa Groove", role `owner`, Lisbon); candidates within 30 km; Deniz-equivalent local drummer Rui.
**Preconditions**: Band org has `official_band`; gig tonight 21:30 at a verified venue; their drummer is ill at 15:10.

| # | Time | Actor | Action | Screen | System |
|---|---|---|---|---|---|
| 1 | 15:10 | Sofia | Create → Emergency request, acting as Lisboa Groove | M-CRT-01 → M-CRT-02 | Checks `org.jobs.manage`; active emergency cap (≤ 3) OK |
| 2 | 15:12 | Sofia | Drums, 21:30–00:00 at venue, fee 250 EUR fixed, note: set list link, black dress | M-CRT-02 | Fee ≥ PT minimum; reach estimate "~42 drummers within 30 km" |
| 3 | 15:12 | System | Publish | — | `is_emergency=true`, `needed_at=21:30`; matching query (capability, instrument, availability window, `ST_DWithin`, standing, not blocked) |
| 4 | 15:12 | System | Wave 1 → top 15 | — | Ranking: distance, reliability, rating, response speed; no premium/boost signal. Per-recipient caps checked (≤ 3/24 h, ≤ 1/60 min); recipients in quiet hours get in-app only |
| 5 | 15:15 | Rui | Opens push → "I'm available", note "20 min away" | M-JOBS-07 | Response recorded; poster board updates realtime |
| 6 | 15:22 | System | < 2 responses after 10 min → Wave 2 (next 30) | — | Wave 3 (radius ×1.5) remains possible |
| 7 | 15:25 | Sofia | Sees 3 responders with distance, rating; opens Rui's profile & sample | M-JOBS-08, M-DISC-05 | — |
| 8 | 15:27 | Sofia | Select Rui → offer 250 EUR, expiry 15 min | M-JOBS-08 → M-MSG-04 | Needs `org.offers.negotiate` (owner ✓) |
| 9 | 15:30 | Rui | Accept, re-confirms amount/date | M-MSG-06 | Snapshot created (hash); booking `pending_payment` or `confirmed` per country payment availability |
| 10 | 15:30 | System | Openings filled (1/1) → **auto-close** in same transaction | — | Pending wave 3 cancelled; other 2 responders get "This spot has been filled"; non-responders get silent in-app update only |
| 11 | 15:31 | System | Booking thread created (Sofia org + Rui) | M-MSG-02 | Calendar blocks added both sides |
| 12 | 21:05 | Rui | Taps "Arrived" near venue | M-PROF-06 | Check-in evidence stored |
| 13 | +24 h after end | System | Auto-complete | — | Payout released per provider rules; review prompts to both parties |
| 14 | next day | Sofia, Rui | Write reviews | M-PROF-09 | Double-blind; publish when both submitted or 14 d |

Failure branches
- 4a. Candidate pool < 5 → poster warned at step 2, offered to widen radius or raise fee.
- 9a. Two posters' offers to Rui overlap the same time → second accept returns calendar conflict; Rui must decline one.
- 9b. Sofia selects a second responder simultaneously (staff member also acting) → first committed acceptance closes request; second gets `409`, offer auto-withdrawn.
- 10a. Nobody accepted by 21:30 → auto-expire; prompt to repost or convert to normal job.
- 12a. Rui no-show → Sofia opens dispute (reason no-show) → J8.

Postconditions: request `filled`, notifications respected caps and quiet hours, exactly 1 booking with immutable snapshot.

---

## J3 — Venue hires band with counter-offer

**Actors**: Marco-equivalent in Istanbul: venue org "Sahne Kadıköy" (Ayten, role `manager`); band org "Mavi Dalga" (Emre, role `owner`).
**Preconditions**: Venue posted job "Friday live set" with budget 12,000 TRY. Payments live in TR via provider (OD1) — or mock in non-prod.

Amounts in minor units (kuruş): 12,000 TRY = `1200000`, 14,000 TRY = `1400000`, 12,500 TRY = `1250000`; currency `TRY` fixed for the thread.

| # | Actor | Action | Screen | System / data |
|---|---|---|---|---|
| 1 | Ayten | Posts job "Friday live set, 2×45 min, budget 12,000 TRY" | M-CRT-03 | Needs `org.jobs.manage` (manager ✓) |
| 2 | Emre | Applies as Mavi Dalga with proposed fee 14,000 TRY | M-JOBS-03 | Application + offer thread created; **v1** authored by band: `amount=1400000 TRY`, 2 sets, backline provided by venue, policy `moderate@v3`, expiry 72 h |
| 3 | Ayten | Shortlists, opens thread, sees v1 vs job budget (+2,000 TRY, +16.7 %) | M-JOBS-06 → M-MSG-04 | Only band's counterparty can act on v1 (OL-21) |
| 4 | Ayten | Counters 12,500 TRY, adds "2 drinks/person, parking" | M-MSG-05 | **v2** authored by venue: `amount=1250000`, inclusions diff shown; Ayten's role `manager` stored on version |
| 5 | Bar staff (role `member`) | Tries to accept on the band's behalf? — n/a; tries to counter for venue | M-MSG-04 | Hidden/disabled with P state: needs `org.offers.negotiate` |
| 6 | Emre | Reviews diff v1→v2: amount −1,500 TRY, inclusions +2 | M-MSG-04 | Only band side can act on v2 (venue authored it) |
| 7 | Emre | Accepts v2; re-confirms "12,500.00 TRY · Fri 14 Nov 2026 21:00 (Europe/Istanbul) · moderate cancellation v3" | M-MSG-06 | Transaction: thread → `accepted`; **snapshot** row inserted |
| 8 | System | Creates booking | — | `booking.snapshot_id`, `snapshot_sha256`; status `pending_payment` |
| 9 | Ayten | Pays via provider checkout | W-BKG-05 | Provider charge 12,500 TRY (+ fee per OD4); webhook verified → `confirmed` |
| 10 | Both | Booking visible with snapshot terms | M-PROF-06 | Calendar blocks; booking thread |

Snapshot contents (illustrative)

```json
{
  "snapshot_version": 1,
  "offer_thread_id": "ot_…",
  "accepted_version": 2,
  "booker": {"org_id": "org_sahne", "acting_user_id": "u_ayten", "role": "manager"},
  "performer": {"org_id": "org_mavi", "acting_user_id": "u_emre", "role": "owner"},
  "amount_minor": 1250000,
  "currency": "TRY",
  "starts_at": "2026-11-14T18:00:00Z",
  "time_zone": "Europe/Istanbul",
  "sets": 2, "set_minutes": 45,
  "inclusions": ["backline", "drinks_2pp", "parking"],
  "cancellation_policy": {"id": "moderate", "version": 3},
  "platform_fee": {"model": "TBD_OD4"},
  "terms_versions": {"tos": "2026-10", "payments_tr": "2026-10"},
  "history": [{"v": 1, "amount_minor": 1400000, "by": "performer"}, {"v": 2, "amount_minor": 1250000, "by": "booker"}],
  "sha256": "…"
}
```

Immutability rules: snapshot table is insert-only; API exposes no update; any later change goes through an amendment offer creating snapshot v2 linked via `supersedes_snapshot_id`.

Failure branches
- 6a. v2 expires (72 h) → thread `expired`; Emre may start a new thread.
- 7a. Ayten tries to accept her own v2 → `FORBIDDEN_OBJECT` (OL-21).
- 7b. Ayten is demoted to `member` before Emre accepts → v2 remains valid (authored while permitted); she can no longer issue new versions.
- 9a. Payment fails → booking stays `pending_payment` 24 h with reminders; then auto-cancel, no fee.

---

## J4 — Organizer staffs an event with 5 positions

**Actor**: Leila, org "Gulf Live Events" (role `admin`), Dubai, UI `ar`. Corporate gala, 20 Dec 2026, 19:00 Asia/Dubai.

Positions

| # | Position | Count | Fee | Fill method |
|---|---|---|---|---|
| P1 | Jazz quartet (band) | 1 | 9,000 AED | Invite 3 bands directly |
| P2 | Vocalist (EN/AR) | 1 | 3,000 AED | Public job |
| P3 | FOH sound engineer | 1 | 2,000 AED | Public job |
| P4 | Lighting technician | 1 | 1,500 AED | Invite from previous bookings |
| P5 | MC / host (AR/EN) | 1 | 2,500 AED | Public job |

| # | Actor | Action | Screen | System |
|---|---|---|---|---|
| 1 | Leila | Creates event (private, corporate), venue: verified hotel ballroom | M-CRT-04 / W-DSH-06 | Needs `org.events.manage` |
| 2 | Leila | Adds P1–P5 | M-CRT-05 | Each position `open` |
| 3 | Leila | P2, P3, P5 → "Post as job" | — | 3 jobs linked to positions; visible on W-JOB-01 (event itself private: jobs show "Corporate event, Dubai" only) |
| 4 | Leila | P1 → invites 3 bands; P4 → invites previous technician | — | Offer threads per invitee; position `offered` |
| 5 | Bands | 2 counter, 1 declines | M-MSG-04 | Leila negotiates (`org.offers.negotiate` admin ✓) |
| 6 | Leila | Accepts best counter for P1 | M-MSG-06 | Booking; P1 `filled`; other P1 threads auto-withdrawn with polite template |
| 7 | — | P2–P5 filled over 5 days | M-PROF-18 | Board shows 5/5; event "fully staffed" |
| 8 | Leila | Builds run-sheet (sound check 16:00, doors 18:30, …) | M-PROF-18 | Visible to all 5 booked parties; change notifications versioned |
| 9 | Leila | Moves sound check to 15:30 | — | All parties notified; changelog entry |
| 10 | After event | Reviews per booking | M-PROF-09 | 5 independent review pairs |

Failure branches: position unfilled 48 h before → warning + suggestion to convert to emergency request; event cancelled → each booking cancelled per its own snapshot policy (AC-EVT-06).

---

## J5 — Turkish-speaking user in Germany

**Actor**: Ayşe, sound engineer, lives in Berlin. Settings: `locale=tr`, `country_code=DE`, `currency_code=EUR`, `time_zone=Europe/Berlin`.

| # | Action | Expected behaviour |
|---|---|---|
| 1 | Signs up; device locale `de-DE`, chooses Türkçe in picker | UI `tr`; `country_code` defaults to DE from device region, editable (D9) |
| 2 | Discover | Shows Berlin venues and DE jobs (market from `country_code` + location), labels in Turkish, venue names untranslated |
| 3 | Views job posted in EUR | "450 €" formatted with `tr` number rules ("450 €" / "1.250,00 €"), no conversion needed |
| 4 | Views a profile priced in TRY (Istanbul musician) | "≈ 85 € · 3.000 TRY" with ≈ marker; tap shows rate source/time |
| 5 | Dates | Displayed in `tr` format, Berlin time; event-local zone shown if different |
| 6 | Legal | Terms/Privacy shown for DE market (GDPR, Imprint W-LGL-07) in Turkish if translated, else `en` with notice; legally binding language stated |
| 7 | Payments | DE provider (OD1) KYC flow; provider's hosted pages may only support `de`/`en` → notice "This page is provided by {provider} in German/English" |
| 8 | Notifications | Turkish copy, Berlin quiet hours |
| 9 | Search "ses mühendisi" and "Tontechniker" | Both match `sound_engineer` taxonomy (multilingual synonyms) |
| 10 | Messaging a German venue | Messages not auto-translated; optional "translate" action (Phase 6) clearly marked as machine translation |

Postconditions: no setting silently changes another; prices settle in offer currency.

---

## J6 — Arabic RTL user

**Actor**: Leila (`locale=ar`, `country_code=AE`, `currency_code=AED`, `time_zone=Asia/Dubai`).

| Area | Expected behaviour |
|---|---|
| Layout | Whole UI mirrored: tab order right→left (Discover rightmost), back arrow points right, progress steppers flow right→left |
| Not mirrored | Media playback controls and timelines, phone numbers, Latin brand names, charts' numeric axes, clock icons (see 06 §11) |
| Numerals | Default Western Arabic digits (0–9) per user preference setting; option for Arabic-Indic digits; amounts "9,000 د.إ." via ICU |
| Mixed text | Band names in Latin inside Arabic sentences isolated with Unicode bidi isolation (FSI/PDI) to avoid reordering |
| Input | Text fields right-aligned, caret behaviour native; handles (`@name`) and URLs forced LTR |
| Typography | Noto Sans Arabic, line-height +10 % vs Latin; no letter-spacing on Arabic |
| Week | Calendar week start from locale/country (Sat or Mon per CLDR for AE) |
| Locale availability | `ar` exposed only if completeness test passes; otherwise fallback `en` with notice |
| SEO | `/ar/…` pages with `dir="rtl"` `lang="ar"` and `hreflang="ar"` |

Test: Arabic pseudo-locale + real strings screenshot tests for all M-* and W-* Phase 1–3 screens.

---

## J7 — Verification request & appeal

**Actor**: venue org "Sahne Kadıköy" (owner Mert). Badge `verified_venue`.

| # | Actor | Action | Screen | System |
|---|---|---|---|---|
| 1 | Mert | Opens verification center as org | M-PROF-11 | Only owner/admin can request (OL-70) |
| 2 | Mert | Uploads tax registration, 3 venue photos, utility bill | M-PROF-12 | Private bucket, signed URLs, malware scan; status `pending`; SLA 48 h target |
| 3 | Reviewer A (`trust_safety`) | Reviews | A-VER-02 | Conflict-of-interest check passes |
| 4 | Reviewer A | Rejects: reason `address_mismatch` + note | A-VER-02 | User notified with reason and appeal option (30 days) |
| 5 | Mert | Appeals with lease contract showing new address | M-PROF-11 | Appeal routed to Reviewer B (≠ A) |
| 6 | Reviewer B | Approves | A-VER-03 | Badge `verified_venue` active; explainer shows date verified |
| 7 | Later | Mert changes venue address | M-PROF-16 | Badge flagged for re-review; public badge stays, owner sees "under review" |

Failure: second rejection → final for 90 days. Badge never offered in premium; UI must not show "upgrade to get verified".

---

## J8 — Dispute & refund

**Actors**: Venue Sahne Kadıköy (booker), band Mavi Dalga (performer), booking from J3 (12,500 TRY). Band arrives 75 min late, plays 1 of 2 sets.

| # | Actor | Action | Screen | System |
|---|---|---|---|---|
| 1 | Ayten (`manager`, has `org.bookings.manage`) | Opens dispute "terms not met: 1 of 2 sets, late arrival" within 72 h | M-PROF-08 | Booking `disputed`; payout held via provider (AC-DSP-03) |
| 2 | Ayten | Attaches photos, timestamps | M-PROF-08 | Booking thread + check-in data auto-attached |
| 3 | Emre | Responds within 72 h: van breakdown, evidence | M-PROF-08 | Both sides' evidence visible to assigned staff only |
| 4 | Staff (`finance_ops`) | Reviews snapshot (2×45 min), check-in at 22:15 vs 21:00 start | A-DSP-02 | — |
| 5 | Staff | Resolution: partial refund 50 % = 6,250 TRY (`625000`) | A-FIN-03 | Below four-eyes threshold → single approval; refund via `PaymentProvider.refund` with reason `partial_performance` |
| 6 | System | Provider webhook confirms refund | — | Booking `resolved`; payout of remainder released per provider rules; audit entries |
| 7 | Both | Notified with resolution text; one appeal within 7 days | M-NOTIF-01 | — |
| 8 | Both | Review window opens (resolved bookings can be reviewed) | M-PROF-09 | Double-blind |

Failure branches
- 5a. Refund above threshold → second `finance_ops`/`super_admin` approval required.
- 5b. Provider refund fails → case stays open, finance alert, manual retry; never "credit" to an internal wallet (D10).
- 1a. Safety issue (harassment) → reason `safety` routes to `trust_safety` immediately, shows local emergency guidance.
- Payments not live in country → dispute limited to mediation + reviews; no refund path; UI states this before booking.
