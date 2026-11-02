# 04 — Screen Inventory

Status: Draft v0.1 · Depends on: [02-functional-spec.md](02-functional-spec.md), [03-roles-permissions-matrix.md](03-roles-permissions-matrix.md), [06-design-system.md](06-design-system.md)

## Conventions

**ID format**: `{SURFACE}-{AREA}-{NN}` — surface `M` (mobile), `W` (web), `A` (admin).

**Auth**: `none` · `user` (logged in) · `user+V` (verified email) · `org:<permission>` (acting as org with that permission) · `staff:<permission>`.

**Key states** (codes used in tables):

| Code | State | Requirement |
|---|---|---|
| L | Loading | Skeletons matching final layout; no spinners > 300 ms without skeleton |
| E | Empty | Illustration-free text + one primary action (component `EmptyState`) |
| Er | Error | Human message + retry; error code in small text for support |
| O | Offline | Cached content with "Offline — showing saved data" bar; writes queued or disabled with reason |
| P | Permission-denied | Explains which role/permission is needed and who to ask (e.g. "Ask an org owner or admin") |
| V | Unverified email | Banner + "Resend email" when action needs V |

Every screen supports L and Er. Additional states are listed per screen. Every screen must render in RTL (`ar`) and at +40 % string length.

**SEO** (web only): `idx` = indexable with canonical + `hreflang` for all supported locales; `noidx` = `noindex`; `cond` = indexable when condition met (see notes).

---

## 1. Mobile (Flutter)

### 1.1 Navigation

Bottom bar, 5 tabs, mirrored in RTL:

| Tab | Root screen | Badge |
|---|---|---|
| Discover | M-DISC-01 | — |
| Jobs | M-JOBS-01 | New matching jobs count |
| Create | M-CRT-01 (sheet) | — |
| Messages | M-MSG-01 | Unread count |
| Profile | M-PROF-01 | Pending actions dot |

Global: context switcher (personal / orgs) in Profile header and in Create sheet; notification bell in Discover and Jobs app bars → M-NOTIF-01.

### 1.2 Onboarding & auth

| ID | Name | Purpose | Phase | Auth | States |
|---|---|---|---|---|---|
| M-AUTH-01 | Welcome | Value prop, language picker, sign-in/up entry | 1 | none | L, O |
| M-AUTH-02 | Sign up (email) | Email, password, DOB, country | 1 | none | Er (field), O |
| M-AUTH-03 | Sign in | Email/password, Google, Apple | 1 | none | Er, O |
| M-AUTH-04 | Verify email | Pending verification, resend, change email | 1 | user | E, Er |
| M-AUTH-05 | Forgot / reset password | Request + set new password | 1 | none | Er, O |
| M-AUTH-06 | Capability picker | Choose capabilities (multi-select chips) | 1 | user | Er |
| M-AUTH-07 | Locale & region | `locale`, `country_code`, `currency_code`, `time_zone` independently | 1 | user | Er |
| M-AUTH-08 | Profile quick-setup | Instruments/skills, location, radius, "from" rate | 1 | user | Er, O |
| M-AUTH-09 | Notification permission primer | Explain before OS prompt; quiet hours default | 2 | user | — |
| M-AUTH-10 | Terms update consent | Accept new Terms/Privacy version | 1 | user | Er |

### 1.3 Discover tab

| ID | Name | Purpose | Phase | Auth | States |
|---|---|---|---|---|---|
| M-DISC-01 | Discover home | Nearby performers, upcoming events, open emergencies near me, sponsored slot (labelled) | 1 | none | L, E, Er, O |
| M-DISC-02 | Search | Unified search with entity tabs (People, Bands, Venues, Organizers, Events) | 2 | none | L, E, Er, O |
| M-DISC-03 | Filters sheet | Capability, instrument, genre, distance, date, price, language, badge | 2 | none | — |
| M-DISC-04 | Map view | Results on map (rounded locations) | 2 | none | L, E, Er, O, P (location denied) |
| M-DISC-05 | Public profile (person) | Bio, instruments, samples, rate "from", badges, reviews, availability hint | 1 | none | L, Er, O, E (no reviews) |
| M-DISC-06 | Band profile | Line-up, samples, reviews, booking CTA | 1 | none | L, Er, O |
| M-DISC-07 | Venue profile | Specs, backline, events, reviews | 1 | none | L, Er, O |
| M-DISC-08 | Organizer / agency profile | Events, roster (agency), reviews | 1 | none | L, Er, O |
| M-DISC-09 | Event detail | Info, line-up, venue, add to calendar | 5 | none | L, Er, O |
| M-DISC-10 | Events calendar | Month/list of public events nearby | 5 | none | L, E, Er, O |
| M-DISC-11 | Badge explainer sheet | What badge proves / doesn't, date | 2 | none | — |
| M-DISC-12 | "Why sponsored?" sheet | Sponsored explanation, advertiser, report | 6 | none | — |
| M-DISC-13 | Media player | Audio/video sample playback | 2 | none | L, Er, O |
| M-DISC-14 | Reviews list | All reviews of an entity | 4 | none | L, E, Er, O |

### 1.4 Jobs tab

| ID | Name | Purpose | Phase | Auth | States |
|---|---|---|---|---|---|
| M-JOBS-01 | Jobs home | Segments: For you, Emergency near me, Saved, My applications, My postings | 2 | user | L, E, Er, O |
| M-JOBS-02 | Job detail | Requirements, fee, location, poster badges, apply CTA | 2 | none | L, Er, O, V |
| M-JOBS-03 | Apply | Message, proposed fee, pick samples | 2 | user+V | Er, O (queued), V |
| M-JOBS-04 | My applications | Status per application | 2 | user | L, E, Er, O |
| M-JOBS-05 | My postings | Jobs/emergencies I or my orgs posted | 2 | user / org:`org.jobs.manage` | L, E, Er, O, P |
| M-JOBS-06 | Applicants list | Filter, shortlist, decline, message, make offer | 2 | org:`org.jobs.manage` | L, E, Er, O, P |
| M-JOBS-07 | Emergency alert detail | Full-screen alert: role, time, fee, distance, "I'm available" / "Not this time" | 2 | user+V | L, Er, O, filled/expired state |
| M-JOBS-08 | Emergency live board (poster) | Responders in real time, wave status, select | 2 | org:`org.jobs.manage` | L, E (waiting), Er, O, P, filled |
| M-JOBS-09 | Saved jobs | Bookmarked jobs | 2 | user | L, E, Er, O |

### 1.5 Create (sheet → flows)

| ID | Name | Purpose | Phase | Auth | States |
|---|---|---|---|---|---|
| M-CRT-01 | Create sheet | Choose: Emergency request, Job, Event, Post, Challenge entry; shows acting context | 1 | user | P (per option) |
| M-CRT-02 | Emergency request wizard | ≤ 4 steps, fixed fee, preview reach estimate | 2 | user+V / org:`org.jobs.manage` | Er, O (blocked), P, V, limit-reached |
| M-CRT-03 | Job wizard | Full job form | 2 | user+V / org:`org.jobs.manage` | Er, O (draft saved), P, V |
| M-CRT-04 | Event wizard | Event basics + positions | 5 | org:`org.events.manage` | Er, O (draft), P |
| M-CRT-05 | Position editor | Role, count, fee, call time | 5 | org:`org.events.manage` | Er, P |
| M-CRT-06 | Post composer | Text/media post | 6 | user+V | Er, O (queued), V |
| M-CRT-07 | Challenge submission | Upload, rights declaration | 6 | user+V | Er, O, V, closed |
| M-CRT-08 | Community event form | Free community event | 5 | user+V | Er, O, V |

### 1.6 Messages tab

| ID | Name | Purpose | Phase | Auth | States |
|---|---|---|---|---|---|
| M-MSG-01 | Inbox | Conversations, filter Personal / each org / Requests | 3 | user | L, E, Er, O |
| M-MSG-02 | Conversation | Messages, attachments, scam warning banner, offer cards inline | 3 | user | L, E, Er, O (queued send), blocked |
| M-MSG-03 | Message requests | Accept/decline requests from strangers | 3 | user | L, E, Er, O |
| M-MSG-04 | Offer thread | Versions timeline, diff, accept/counter/decline | 3 | user / org:`org.offers.negotiate` | L, Er, O (read-only), P, expired, stale (409) |
| M-MSG-05 | Counter-offer composer | Edit terms, see diff and fee preview | 3 | user / org:`org.offers.negotiate` | Er, O (disabled), P |
| M-MSG-06 | Accept confirmation | Re-confirm amount, currency, date, policy | 3 | user / org:`org.offers.negotiate` | Er, P |
| M-MSG-07 | Report / block sheet | Report reasons, block | 3 | user | Er |

### 1.7 Profile tab & secondary sections

| ID | Name | Purpose | Phase | Auth | States |
|---|---|---|---|---|---|
| M-PROF-01 | My profile hub | Own profile preview, completeness, context switcher, shortcuts | 1 | user | L, Er, O |
| M-PROF-02 | Edit profile | All profile fields, per-locale bio | 1 | user | Er, O (draft) |
| M-PROF-03 | Media manager | Upload/order samples, processing status | 2 | user | L, E, Er, O |
| M-PROF-04 | Availability calendar | Busy blocks, emergency availability windows | 2 | user | L, Er, O |
| M-PROF-05 | Bookings list | Upcoming / past / cancelled | 3 | user | L, E, Er, O |
| M-PROF-06 | Booking detail | Snapshot terms, status, run-sheet, check-in, cancel, dispute | 3 | booking party | L, Er, O, P |
| M-PROF-07 | Cancel booking | Policy-computed refund preview | 3 | booking party / org:`org.bookings.manage` | Er, P |
| M-PROF-08 | Dispute flow | Reason, evidence, status timeline | 4 | booking party / org:`org.bookings.manage` | Er, O, P, window-closed |
| M-PROF-09 | Write review | Ratings + text, double-blind notice | 4 | booking party | Er, P, window-closed |
| M-PROF-10 | Payments & payouts | Provider onboarding status, history | 4 | user / org:`org.finance.view` | L, E, Er, O, P, provider-unavailable |
| M-PROF-11 | Verification center | Badges, request, status, appeal | 2 | user / org owner/admin | L, E, Er, P |
| M-PROF-12 | Verification request | Evidence upload | 2 | user+V | Er, O, V |
| M-PROF-13 | Organizations list | My orgs and roles; create org | 1 | user | L, E, Er, O |
| M-PROF-14 | Org dashboard | Org overview: jobs, offers, bookings, inbox counts | 1 | org member | L, Er, O, P |
| M-PROF-15 | Org members | Invite, change role, remove | 1 | org:`org.members.manage` | L, Er, O, P |
| M-PROF-16 | Org edit | Org profile edit | 1 | org:`org.profile.edit` | Er, O, P |
| M-PROF-17 | Org finance | Charges, payouts, invoices | 4 | org:`org.finance.view` | L, E, Er, O, P |
| M-PROF-18 | Event board | Positions & status, run-sheet | 5 | org:`org.events.manage` | L, E, Er, O, P |
| M-PROF-19 | Settings | Account, locale/region, notifications, quiet hours, privacy, sessions | 1 | user | L, Er, O |
| M-PROF-20 | Notification preferences | Per-category channels, quiet hours, emergency overrides | 2 | user | Er, O |
| M-PROF-21 | Privacy & data | Visibility, blocked users, export, delete account | 1 | user | Er, blockers listed |
| M-PROF-22 | Help & safety | Help articles, safety tips, contact support | 1 | none | L, Er, O |
| M-PROF-23 | Followers / following | Social graph | 6 | user | L, E, Er, O |
| M-PROF-24 | Challenges hub | Active/past challenges, my entries | 6 | none | L, E, Er, O |
| M-PROF-25 | Challenge detail & vote | Entries, vote, rules | 6 | none (vote: user+V ≥7d) | L, E, Er, O, P (not eligible), ended |
| M-PROF-26 | Premium | Plans & boosts via store billing | 6 | user | L, Er, unavailable-in-territory |
| M-NOTIF-01 | Notifications center | All in-app notifications, grouped | 2 | user | L, E, Er, O |
| M-SYS-01 | Force update | Unsupported app version | 1 | none | — |
| M-SYS-02 | Maintenance | Planned downtime | 1 | none | — |
| M-SYS-03 | Deep link not found | Invalid / removed content | 1 | none | — |

## 2. Web (Next.js)

URL pattern: `/{locale}/…` (e.g. `/tr/…`, `/ar/…`); `x-default` → `/en/…`.

### 2.1 Public & marketing

| ID | Name | Route | Purpose | Phase | Auth | States | SEO |
|---|---|---|---|---|---|---|---|
| W-PUB-01 | Landing | `/{l}` | What it is, who it's for, search entry | 1 | none | L, Er | idx |
| W-PUB-02 | For musicians | `/{l}/for/musicians` | Audience page | 1 | none | — | idx |
| W-PUB-03 | For venues | `/{l}/for/venues` | Audience page | 1 | none | — | idx |
| W-PUB-04 | For organizers & agencies | `/{l}/for/organizers` | Audience page | 1 | none | — | idx |
| W-PUB-05 | How it works / pricing | `/{l}/how-it-works` | Fees, protections, payments per country | 4 | none | — | idx |
| W-PUB-06 | Verification explained | `/{l}/verification` | All badges, what they mean | 2 | none | — | idx |
| W-PUB-07 | Trust & safety | `/{l}/safety` | Safety guidance | 1 | none | — | idx |

### 2.2 Directories & search

| ID | Name | Route | Purpose | Phase | Auth | States | SEO |
|---|---|---|---|---|---|---|---|
| W-DIR-01 | Musicians directory | `/{l}/musicians[/{city}[/{instrument}]]` | Browse performers | 1 | none | L, E, Er | cond (≥ 5 results) |
| W-DIR-02 | Bands directory | `/{l}/bands[/{city}[/{genre}]]` | Browse bands | 1 | none | L, E, Er | cond |
| W-DIR-03 | Venues directory | `/{l}/venues[/{city}]` | Browse venues | 1 | none | L, E, Er | cond |
| W-DIR-04 | Organizers & agencies | `/{l}/organizers[/{city}]` | Browse organizers | 1 | none | L, E, Er | cond |
| W-DIR-05 | Tech crew directory | `/{l}/crew[/{city}[/{skill}]]` | Sound/lighting | 1 | none | L, E, Er | cond |
| W-DIR-06 | Teachers directory | `/{l}/teachers[/{city}[/{instrument}]]` | Music teachers | 1 | none | L, E, Er | cond |
| W-DIR-07 | Search results | `/{l}/search?q=` | Free search, sponsored slots labelled | 2 | none | L, E, Er | noidx |

### 2.3 Public profiles

| ID | Name | Route | Purpose | Phase | Auth | States | SEO |
|---|---|---|---|---|---|---|---|
| W-PRF-01 | Person profile | `/{l}/u/{handle}` | Public profile | 1 | none | L, Er, E (reviews), 410 (deleted), P (`members_only`) | idx if `public` |
| W-PRF-02 | Band profile | `/{l}/b/{slug}` | Band page | 1 | none | L, Er, 410 | idx |
| W-PRF-03 | Venue profile | `/{l}/v/{slug}` | Venue page | 1 | none | L, Er, 410 | idx |
| W-PRF-04 | Organizer/agency profile | `/{l}/o/{slug}` | Org page | 1 | none | L, Er, 410 | idx |
| W-PRF-05 | Reviews page | `/{l}/{type}/{slug}/reviews` | Paginated reviews | 4 | none | L, E, Er | idx (page 1), noidx (others canonical to 1) |

### 2.4 Job marketplace

| ID | Name | Route | Purpose | Phase | Auth | States | SEO |
|---|---|---|---|---|---|---|---|
| W-JOB-01 | Jobs list | `/{l}/jobs[/{city}[/{role}]]` | Browse open jobs | 2 | none | L, E, Er | cond |
| W-JOB-02 | Job detail | `/{l}/jobs/{id}-{slug}` | Job + apply | 2 | none | L, Er, closed (410 after 30 d) | idx while open |
| W-JOB-03 | Emergency board | `/{l}/jobs/emergency` | Open emergencies near me | 2 | user | L, E, Er, P (location) | noidx |
| W-JOB-04 | Apply | `/{l}/jobs/{id}/apply` | Application form | 2 | user+V | Er, V | noidx |
| W-JOB-05 | Post job / emergency | `/{l}/jobs/new` | Job wizard | 2 | user+V / org:`org.jobs.manage` | Er, P, V, limit-reached | noidx |
| W-JOB-06 | Manage applicants | `/{l}/dashboard/jobs/{id}` | Shortlist, offers | 2 | org:`org.jobs.manage` | L, E, Er, P | noidx |

### 2.5 Events calendar & challenges

| ID | Name | Route | Purpose | Phase | Auth | States | SEO |
|---|---|---|---|---|---|---|---|
| W-EVT-01 | Events calendar | `/{l}/events[/{city}]` | Month/list view | 5 | none | L, E, Er | cond |
| W-EVT-02 | Event detail | `/{l}/events/{id}-{slug}` | Event page | 5 | none | L, Er, cancelled, past | idx (public), noidx (private) |
| W-CHL-01 | Challenges list | `/{l}/challenges` | Active/past | 6 | none | L, E, Er | idx |
| W-CHL-02 | Challenge detail | `/{l}/challenges/{slug}` | Rules, entries, vote | 6 | none (vote: user+V) | L, E, Er, P, ended | idx |
| W-CHL-03 | Entry detail | `/{l}/challenges/{slug}/{entryId}` | Single entry | 6 | none | L, Er, removed (copyright) | idx |

### 2.6 Auth

| ID | Name | Route | Phase | Auth | States | SEO |
|---|---|---|---|---|---|---|
| W-AUTH-01 | Sign in | `/{l}/signin` | 1 | none | Er | noidx |
| W-AUTH-02 | Sign up | `/{l}/signup` | 1 | none | Er | noidx |
| W-AUTH-03 | Verify email | `/{l}/verify` | 1 | none | Er, expired | noidx |
| W-AUTH-04 | Reset password | `/{l}/reset` | 1 | none | Er, expired | noidx |
| W-AUTH-05 | Onboarding | `/{l}/onboarding` | 1 | user | Er | noidx |

### 2.7 Messaging & bookings

| ID | Name | Route | Purpose | Phase | Auth | States | SEO |
|---|---|---|---|---|---|---|---|
| W-MSG-01 | Inbox (split view) | `/{l}/messages[/{id}]` | Conversations | 3 | user | L, E, Er, O (reconnecting) | noidx |
| W-MSG-02 | Offer thread | `/{l}/offers/{id}` | Versions, diff, actions | 3 | party / org:`org.offers.negotiate` | L, Er, P, expired, stale | noidx |
| W-BKG-01 | Bookings list | `/{l}/bookings` | Upcoming/past | 3 | user | L, E, Er | noidx |
| W-BKG-02 | Booking detail | `/{l}/bookings/{id}` | Snapshot, status, actions, printable PDF | 3 | booking party | L, Er, P | noidx |
| W-BKG-03 | Dispute | `/{l}/bookings/{id}/dispute` | Dispute flow | 4 | party / org:`org.bookings.manage` | Er, P | noidx |
| W-BKG-04 | Review | `/{l}/bookings/{id}/review` | Write review | 4 | booking party | Er, P | noidx |
| W-BKG-05 | Checkout | `/{l}/bookings/{id}/pay` | Provider-hosted / embedded payment | 4 | booker party | L, Er, provider-unavailable, TEST banner | noidx |

### 2.8 Dashboards

| ID | Name | Route | Purpose | Phase | Auth | States | SEO |
|---|---|---|---|---|---|---|---|
| W-DSH-01 | User dashboard | `/{l}/dashboard` | Today, upcoming bookings, offers awaiting me, applications | 2 | user | L, E, Er | noidx |
| W-DSH-02 | Profile editor | `/{l}/dashboard/profile` | Full profile edit | 1 | user | Er | noidx |
| W-DSH-03 | Calendar | `/{l}/dashboard/calendar` | Availability + bookings, iCal link | 3 | user / org:`org.calendar.manage` | L, Er, P | noidx |
| W-DSH-04 | Venue dashboard | `/{l}/dashboard/venue/{orgId}` | Calendar fill, open slots, offers, bookings, reviews | 3 | venue org member | L, E, Er, P | noidx |
| W-DSH-05 | Organizer dashboard | `/{l}/dashboard/organizer/{orgId}` | Events, positions fill, budgets | 5 | organizer org member | L, E, Er, P | noidx |
| W-DSH-06 | Event board | `/{l}/dashboard/events/{id}` | Positions, run-sheet | 5 | org:`org.events.manage` | L, E, Er, P | noidx |
| W-DSH-07 | Org members | `/{l}/dashboard/org/{orgId}/members` | Members & roles | 1 | org:`org.members.manage` | L, Er, P | noidx |
| W-DSH-08 | Org finance | `/{l}/dashboard/org/{orgId}/finance` | Charges/payouts/invoices | 4 | org:`org.finance.view` | L, E, Er, P | noidx |
| W-DSH-09 | Verification center | `/{l}/dashboard/verification` | Requests & appeals | 2 | user | L, E, Er | noidx |
| W-DSH-10 | Settings | `/{l}/settings[/…]` | Account, locale/region, notifications, privacy, sessions, data | 1 | user | L, Er | noidx |

### 2.9 Legal, help, contact

| ID | Name | Route | Phase | Auth | SEO |
|---|---|---|---|---|---|
| W-LGL-01 | Terms of Service | `/{l}/legal/terms` | 1 | none | idx |
| W-LGL-02 | Privacy Policy | `/{l}/legal/privacy` | 1 | none | idx |
| W-LGL-03 | Cookie Policy + preferences | `/{l}/legal/cookies` | 1 | none | idx |
| W-LGL-04 | Community Guidelines | `/{l}/legal/guidelines` | 1 | none | idx |
| W-LGL-05 | Payments terms (per country/provider) | `/{l}/legal/payments` | 4 | none | idx |
| W-LGL-06 | Copyright / takedown | `/{l}/legal/copyright` | 6 | none | idx |
| W-LGL-07 | Imprint (where required, e.g. DE) | `/{l}/legal/imprint` | 1 | none | idx |
| W-HLP-01 | Help center | `/{l}/help` | 1 | none | idx |
| W-HLP-02 | Help article | `/{l}/help/{slug}` | 1 | none | idx |
| W-CNT-01 | Contact / support form | `/{l}/contact` | 1 | none | idx |
| W-SYS-01 | 404 | — | 1 | none | noidx |
| W-SYS-02 | 410 Gone (removed profile/job) | — | 1 | none | noidx |
| W-SYS-03 | 500 / maintenance | — | 1 | none | noidx |

## 3. Admin (separate Next.js app)

All admin screens: `noidx`, staff auth audience, MFA, audit of every PII view. States L, E, Er, P apply to all.

| ID | Name | Purpose | Phase | Auth |
|---|---|---|---|---|
| A-AUTH-01 | Staff sign-in + MFA | Separate identity provider audience | 1 | none |
| A-HOME-01 | Overview | Queue sizes, SLA breaches, alerts | 1 | any staff |
| A-USR-01 | User search | By email/handle/ID | 1 | staff:`admin.users.read` |
| A-USR-02 | User detail | Profile, orgs, bookings, reports, sessions | 1 | staff:`admin.users.read` |
| A-USR-03 | Suspend / lock | Temporary or permanent, reason, four-eyes for permanent | 1 | staff:`admin.users.suspend` |
| A-ORG-01 | Org detail | Members, roles, badges | 1 | staff:`admin.users.read` |
| A-VER-01 | Verification queue | Pending requests, SLA timers | 2 | staff:`admin.verification.review` |
| A-VER-02 | Verification review | Evidence viewer, decision, reason codes | 2 | staff:`admin.verification.review` |
| A-VER-03 | Appeals queue | Appeals routed to different reviewer | 2 | staff:`admin.verification.review` |
| A-MOD-01 | Reports queue | Reported users/content/messages | 2 | staff:`admin.moderation.act` |
| A-MOD-02 | Moderation case | Context, actions (hide, remove, warn, revoke badge) | 2 | staff:`admin.moderation.act` |
| A-MOD-03 | Copyright notices | Takedowns & counter-notices | 6 | staff:`admin.moderation.act` |
| A-MOD-04 | Challenge vote integrity | Flagged vote clusters, hold/release | 6 | staff:`admin.moderation.act` |
| A-FIN-01 | Payments overview | Provider status, failed payments, webhook lag | 4 | staff:`admin.finance.read` |
| A-FIN-02 | Booking finance detail | Snapshot, charges, payouts, refunds | 4 | staff:`admin.finance.read` |
| A-FIN-03 | Refund | Full/partial refund with reason, four-eyes over threshold | 4 | staff:`admin.finance.refund` |
| A-DSP-01 | Disputes queue | Open disputes, SLA | 4 | staff:`admin.moderation.act` or `admin.finance.refund` |
| A-DSP-02 | Dispute case | Evidence, timeline, resolution | 4 | as above |
| A-I18N-01 | Locales | Completeness, `machine_draft` status, promote | 1 | staff:`admin.i18n.manage` |
| A-I18N-02 | Missing/flagged strings | Strings failing review, overflow reports | 1 | staff:`admin.i18n.manage` |
| A-CTY-01 | Countries | Enable, provider binding, minimum fees, legal versions, age limits | 1 | staff:`admin.countries.manage` |
| A-FLG-01 | Feature flags | Targeting per country/locale/% | 1 | staff:`admin.flags.manage` |
| A-SPN-01 | Sponsored placements | Review/approve sponsored items, labels | 6 | staff:`admin.moderation.act` |
| A-STF-01 | Staff management | Staff accounts, roles, four-eyes approvals | 1 | staff:`admin.staff.manage` |
| A-AUD-01 | Audit log | Search, filter, export | 1 | staff:`admin.audit.read` |
| A-ANL-01 | Analytics | Aggregated metrics (pseudonymised) | 2 | `analyst` / `super_admin` |
