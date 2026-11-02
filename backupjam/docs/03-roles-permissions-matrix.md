# 03 — Roles & Permissions Matrix

Status: Draft v0.1 · Source of truth for identifiers: [00-decisions.md](00-decisions.md). This document **expands** that vocabulary; it does not add new org or staff permissions. Where a rule needs an extra check, it is expressed as an object-level rule (§5), not a new permission.

Legend: ✓ allowed · — not allowed · ◐ allowed with condition (see note) · V = requires verified email

Authorization is evaluated in this order for every request:

1. **Authentication** — valid access token (end-user audience or admin audience; never interchangeable).
2. **Account standing** — not suspended / not soft-deleted; email verified where marked V.
3. **Capability gate** (user-level, §2) — soft gate: drives UI and eligibility, not security by itself.
4. **Acting context** — personal, or `acting_as_org_id` → org role → org permission (§3).
5. **Object-level rule** (§5) — relationship to the specific object (party of booking, author of version, etc.).
6. **Country/feature flag** — e.g. payments enabled in country, feature flag on.

Deny wins. Every denial returns a stable error code (`FORBIDDEN_PERMISSION`, `FORBIDDEN_OBJECT`, `FORBIDDEN_STANDING`, `FEATURE_DISABLED`).

---

## 1. Actors

| Actor | Description |
|---|---|
| Anonymous | Not logged in (web SEO visitor, app pre-login) |
| User | Authenticated end user, acting personally |
| Org member | User acting as an organization with an org role (`owner`, `admin`, `manager`, `member`, `staff`) |
| Staff | Platform staff in admin app with a staff role |
| System | Background jobs (auto-close, auto-complete, expiry) — acts with explicit system principal, audited |

## 2. User capabilities vs actions

Capabilities (self-declared): `musician`, `band_member`, `band_manager`, `venue_owner`, `venue_staff`, `organizer`, `booking_agent`, `artist_manager`, `sound_engineer`, `lighting_technician`, `music_teacher`, `enthusiast`, `customer`.

Capabilities are **not** a security boundary — a user can add any capability. They control which flows, fields and matches are offered. Security comes from verified email, account standing, org permissions and object rules.

| Action (personal context) | Anon | musician | band_member | band_manager | venue_owner | venue_staff | organizer | booking_agent | artist_manager | sound_engineer | lighting_technician | music_teacher | enthusiast | customer |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Browse public profiles, jobs, events | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create personal profile | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Performer fields (instruments, rates, samples) | — | ✓ | ✓ | ◐¹ | — | — | — | — | — | ◐² | ◐² | ✓ | — | — |
| Appear in emergency matching | — | ✓ | ✓ | — | — | — | — | — | — | ✓ | ✓ | — | — | — |
| Apply to jobs (V) | — | ✓ | ✓ | ✓ | — | — | — | ◐³ | ◐³ | ✓ | ✓ | ✓ | — | — |
| Post a job personally (V) | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Post emergency request personally (V) | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | — | — | — | — | ◐⁴ |
| Send / counter offers personally (V) | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Create organization (V) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create community event (V) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Request `identity_verified` | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Request `official_artist` | — | ✓ | ✓ | — | — | — | — | — | — | — | — | ✓ | — | — |
| Enter challenge (V) | — | ✓ | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ | ✓ | ✓ | — |
| Vote in challenge (V, account ≥ 7 d) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Follow, post, comment (V) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Message request to stranger (V) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Report / block | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Notes
1. A `band_manager` who also performs adds `musician`; otherwise manager profile shows represented bands, not instruments.
2. Crew fields are skills/equipment (desk models, lighting consoles) rather than instruments.
3. Agents/managers applying on behalf of artists should act as their `agency` org; personal application is allowed only for themselves.
4. `customer` emergency requests (e.g. private party) require `identity_verified` to limit abuse.

Capability-independent limits apply to everyone: emergency posting caps (AC-EMG-07), message request limits (AC-MSG-02), notification caps.

## 3. Organization roles vs permissions

Exactly as fixed in 00-decisions, repeated here with descriptions and typical actions.

| Permission | owner | admin | manager | member | staff | What it allows |
|---|---|---|---|---|---|---|
| `org.profile.edit` | ✓ | ✓ | ✓ | — | — | Edit name, bio, media, venue specs, line-up display |
| `org.members.manage` | ✓ | ✓ | — | — | — | Invite/remove members; assign `manager`/`member`/`staff` |
| `org.roles.assign_admin` | ✓ | — | — | — | — | Promote to / demote from `admin` |
| `org.jobs.manage` | ✓ | ✓ | ✓ | — | ✓ | Create/edit/close jobs and emergency requests; shortlist/decline applicants |
| `org.offers.negotiate` | ✓ | ✓ | ✓ | — | — | Send, counter, accept, decline, withdraw offers for the org |
| `org.bookings.manage` | ✓ | ✓ | ✓ | — | — | Amend, cancel, mark issues, open disputes on org bookings |
| `org.calendar.manage` | ✓ | ✓ | ✓ | ✓ | ✓ | Edit org calendar holds and availability |
| `org.events.manage` | ✓ | ✓ | ✓ | — | ✓ | Create/edit events, positions, run-sheets |
| `org.messages.respond` | ✓ | ✓ | ✓ | ✓ | ✓ | Read and reply in org inbox |
| `org.finance.view` | ✓ | ✓ | — | — | — | View charges, payouts, invoices, fee breakdowns |
| `org.payouts.manage` | ✓ | — | — | — | — | Connect/change payout account via provider onboarding |
| `org.reviews.respond` | ✓ | ✓ | ✓ | — | — | Publish one response per review |
| `org.delete` | ✓ | — | — | — | — | Delete the organization |

### 3.1 Typical role use per org type (guidance, not enforcement)

| Org type | owner | admin | manager | member | staff |
|---|---|---|---|---|---|
| `band` | Band leader | Co-leader | Band manager | Band musicians | Roadie/merch |
| `venue` | Venue owner | General manager | Booker | Bar/floor team | Stage hand, door staff |
| `agency` | Agency owner | Partner | Agent | Assistant | Scheduler |
| `organizer` | Owner | Producer | Production manager | Volunteer | Stage manager |
| `company` | Owner | HR/ops | Event lead | Employee | Reception |

### 3.2 Role-management rules

| Rule | Detail |
|---|---|
| Single owner | Exactly one `owner`; transfer requires acceptance by target and owner re-auth |
| No self-escalation | No member can change their own role |
| Admin assignment | Only `owner` (`org.roles.assign_admin`) can create or remove `admin` |
| Admin limits | `admin` with `org.members.manage` can manage `manager`/`member`/`staff`, not other `admin`s or `owner` |
| Leaving | Any non-owner can leave; owner must transfer first |
| Last-admin safety | Removing a member never leaves an org without owner |
| Role snapshot | Role at time of action is stored on audit and on offer versions |

## 4. Platform staff roles vs admin permissions

| Permission | super_admin | trust_safety | finance_ops | support | localization_manager | analyst |
|---|---|---|---|---|---|---|
| `admin.users.read` | ✓ | ✓ | ✓ | ✓ | — | ◐¹ |
| `admin.users.suspend` | ✓ | ✓ | — | ◐² | — | — |
| `admin.verification.review` | ✓ | ✓ | — | — | — | — |
| `admin.moderation.act` | ✓ | ✓ | — | ◐³ | — | — |
| `admin.finance.read` | ✓ | ◐⁴ | ✓ | ◐⁴ | — | ◐¹ |
| `admin.finance.refund` | ✓ | — | ✓ | — | — | — |
| `admin.i18n.manage` | ✓ | — | — | — | ✓ | — |
| `admin.flags.manage` | ✓ | — | — | — | — | — |
| `admin.staff.manage` | ✓ | — | — | — | — | — |
| `admin.audit.read` | ✓ | ✓ | ✓ | — | — | — |
| `admin.countries.manage` | ✓ | — | ◐⁵ | — | — | — |

Notes
1. `analyst` reads only pseudonymised aggregates/exports; no direct PII screens.
2. `support` may apply a temporary 24 h lock (e.g. compromised account) — implemented as `admin.users.suspend` with `duration ≤ 24h` scope; permanent suspension needs `trust_safety`.
3. `support` may hide reported content pending review; final removal and badge revocation require `trust_safety`.
4. Read-only booking payment status for a specific case (dispute/ticket), not finance reports.
5. `finance_ops` may edit payment-provider binding and minimum emergency fee fields only.

### 4.1 Staff rules

| Rule | Detail |
|---|---|
| MFA | All staff require WebAuthn or TOTP |
| Separation | Staff accounts are distinct from end-user accounts; same person must use separate identity |
| Conflict of interest | Staff cannot act on objects where their linked end-user account is a party or org member |
| Four-eyes | Refunds above the country threshold, permanent suspensions, and `super_admin` grants require a second staff approval |
| Break-glass | `super_admin` actions on PII require a reason string, shown in audit |
| No self-grant | `admin.staff.manage` cannot modify its own roles |

## 5. Object-level rules

Each rule is enforced in the service layer (not just UI) and has a test.

### 5.1 Profiles & organizations

| ID | Object / action | Rule |
|---|---|---|
| OL-01 | Edit personal profile | Only the profile owner |
| OL-02 | Edit org profile | Member with `org.profile.edit` in that org |
| OL-03 | View `members_only` profile | Any authenticated user in good standing not blocked by the owner |
| OL-04 | View precise location | Never exposed; only rounded location or distance |
| OL-05 | Agency represents artist | Requires artist's (or band owner's) explicit consent; revocable by artist any time |
| OL-06 | Line-up membership display | Only after invitee accepts |

### 5.2 Jobs, emergency requests, applications

| ID | Object / action | Rule |
|---|---|---|
| OL-10 | Edit/close job | Poster user, or member of poster org with `org.jobs.manage` |
| OL-11 | View applicants | Same as OL-10 |
| OL-12 | View own application | Applicant only (and their acting org members with `org.offers.negotiate` if applied as org) |
| OL-13 | Respond to emergency | Only users who were matched and notified, or who can see it in the open emergency list in their radius |
| OL-14 | Select emergency responder | Poster / org member with `org.jobs.manage`; creating the offer additionally needs `org.offers.negotiate` if acting as org |
| OL-15 | Apply to own job | Not allowed (poster and members of poster org) |

### 5.3 Offers & negotiation

| ID | Object / action | Rule |
|---|---|---|
| OL-20 | View offer thread | Users of either party; for org parties, members with `org.offers.negotiate`, `org.bookings.manage` or `org.finance.view` |
| OL-21 | Counter / accept / decline | Only the party that did **not** author the latest version; if that party is an org, the acting member must hold `org.offers.negotiate` |
| OL-22 | Withdraw | Only the author party of the latest version, while it is `pending` |
| OL-23 | Edit a version | Never — versions are append-only |
| OL-24 | Offer to self / own org | Not allowed |
| OL-25 | Blocked parties | Cannot create or continue threads |

### 5.4 Bookings, payments, disputes

| ID | Object / action | Rule |
|---|---|---|
| OL-30 | View booking | Booking parties (users) and org members with `org.bookings.manage`, `org.calendar.manage` (time/place only), or `org.finance.view` (money fields) |
| OL-31 | Amend / cancel booking | Party user, or org member with `org.bookings.manage` |
| OL-32 | View snapshot | Booking parties and staff with `admin.finance.read` or dispute assignment |
| OL-33 | Modify snapshot | Never (hash-verified, append-only table) |
| OL-34 | Open dispute | Booking party user or org member with `org.bookings.manage`, within window |
| OL-35 | Resolve dispute | Assigned staff with `admin.moderation.act` (non-financial) or `admin.finance.refund` (financial) |
| OL-36 | Payout account | Only user themselves, or org `owner` (`org.payouts.manage`) |
| OL-37 | View org finance | Members with `org.finance.view` |

### 5.5 Reviews

| ID | Object / action | Rule |
|---|---|---|
| OL-40 | Write review | **Only booking parties** of a booking in `completed`/`resolved`, within 14 days, one per party; acting org member needs `org.bookings.manage` |
| OL-41 | Respond to review | Reviewed user, or member of reviewed org with `org.reviews.respond`; one response |
| OL-42 | Remove review | Never by parties; only staff with `admin.moderation.act` for policy violation |
| OL-43 | Review band vs member | Review targets the booking party (band org), not individual members |

### 5.6 Messaging & social

| ID | Object / action | Rule |
|---|---|---|
| OL-50 | Read org inbox | Members with `org.messages.respond` |
| OL-51 | Booking thread | All booking parties + org members with `org.bookings.manage` or `org.messages.respond` |
| OL-52 | Message stranger | One request until accepted; blocked users cannot message |
| OL-53 | Delete message | Sender, within 15 min ("deleted" placeholder); content retained for T&S 90 days |

### 5.7 Events & challenges

| ID | Object / action | Rule |
|---|---|---|
| OL-60 | Edit event/positions | Event org member with `org.events.manage` (or personal creator) |
| OL-61 | Fill position (offer) | Needs `org.offers.negotiate` in event org |
| OL-62 | View run-sheet | Event org members + booked parties for that event |
| OL-63 | Vote | Not own entries, not own org's entries, 1 vote/category, account ≥ 7 days, verified email |
| OL-64 | Edit submission | Entrant until challenge submission deadline |

### 5.8 Verification

| ID | Object / action | Rule |
|---|---|---|
| OL-70 | Request org badge | Org `owner` or `admin` |
| OL-71 | View evidence | Requester and assigned staff with `admin.verification.review` |
| OL-72 | Decide | Staff with `admin.verification.review`, not requester, not member of requesting org |
| OL-73 | Appeal decision | Different reviewer than original |

## 6. System principal actions

| Action | Trigger | Audited as |
|---|---|---|
| Auto-close emergency when filled | Booking count = openings | `system:emergency.autoclose` |
| Expire offer | `expires_at` passed | `system:offer.expire` |
| Auto-complete booking | End + 24 h, no dispute | `system:booking.autocomplete` |
| Publish double-blind reviews | Both submitted or window closed | `system:review.publish` |
| Expire job | Deadline or `needed_at` passed | `system:job.expire` |

## 7. Test requirements

- Every cell in §3 and §4 has an allow test and a deny test.
- Every OL rule has at least one negative test (e.g. OL-21: author of latest version tries to accept → `FORBIDDEN_OBJECT`).
- Role change mid-negotiation: a member demoted from `manager` to `member` loses ability to counter immediately (permission evaluated per request, not cached in token).
