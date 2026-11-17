# 11 — API Endpoint Specification

Machine-readable contract: [`packages/api-contract/openapi.json`](../packages/api-contract/openapi.json) (generated; Swagger UI at `/api/docs` in non-production). Base path `/v1`. JSON only.

**Conventions**
- Auth: `Authorization: Bearer <accessToken>` on every route except those marked 🌐.
- Locale: account preference → `X-BUJ-Locale` → `Accept-Language` → `en`, used for error messages and emails.
- Errors: `{ "error": { "code": "auth.invalid_credentials", "message": "<localized>", "details": … }, "requestId": "…" }`. Codes are stable (`packages/api-contract/src/errors.ts`).
- Validation: unknown fields are rejected (400 `validation_failed`).
- Pagination: opaque `cursor` / `nextCursor`.
- Rate limits: per-IP default + stricter on credential endpoints → 429 `rate_limited`.
- Object-level authz: resources you are not entitled to see return **404**, insufficient permission on a visible resource returns **403** with `details.required`.

## Implemented (Phase 1)

| Method & path | Auth | Purpose |
|---|---|---|
| POST `/v1/auth/register` | 🌐 | Email sign-up; records Terms/Privacy/marketing consent; sends verification email |
| POST `/v1/auth/login` | 🌐 | Password login (constant-time for unknown emails) |
| POST `/v1/auth/oauth/google` · `/oauth/apple` | 🌐 | ID-token sign-in/up with safe account linking |
| POST `/v1/auth/refresh` | 🌐 | Rotate refresh token; reuse ⇒ session revoked |
| POST `/v1/auth/logout` | ✓ | Revoke current session |
| POST `/v1/auth/verify-email` · `/verify-email/resend` | 🌐 / ✓ | Email verification (single-use, 24 h) |
| POST `/v1/auth/password/forgot` · `/password/reset` | 🌐 | Reset (always 202; 1 h token; signs out all devices) |
| GET `/v1/auth/sessions` · DELETE `/v1/auth/sessions/:id` | ✓ | Device/session management |
| GET · PATCH `/v1/me` | ✓ | Account profile (display name, username) |
| PUT `/v1/me/preferences` | ✓ | Locale (`null` = automatic), country, display currency, time zone, theme, quiet hours |
| PUT `/v1/me/capabilities` | ✓ | Declared roles (musician, venue_owner, …) |
| GET · PUT `/v1/me/onboarding` | ✓ | Skippable onboarding answers incl. PostGIS location |
| GET · POST `/v1/me/consents` | ✓ | Consent state / append-only changes |
| DELETE `/v1/me` | ✓ | Request deletion (password check, 30-day grace, sessions revoked) |
| POST `/v1/organizations` | ✓ (verified email) | Create band/venue/agency/organizer/company; creator = owner |
| GET `/v1/organizations/mine` · `/invitations` | ✓ | My organizations / pending invitations |
| GET `/v1/organizations/by-slug/:slug` | 🌐 | Public organization card |
| PATCH `/v1/organizations/:id` | `org.profile.edit` | Update profile |
| GET · POST `/v1/organizations/:id/members` | member · `org.members.manage` | List / invite (explicit acceptance required) |
| POST `/v1/organizations/:id/invitation/accept` · `/decline` | invitee | Respond to invitation |
| PATCH · DELETE `/v1/organizations/:id/members/:userId` | `org.members.manage` (+`org.roles.assign_admin` for owner/admin) | Change role / remove / leave |
| GET `/v1/i18n/locales` · `/negotiate` · `/messages/:locale` | 🌐 | Locale registry, negotiation, catalogs (ETag) |
| GET `/v1/reference/countries` · `/currencies` · `/languages` · `/instruments` · `/genres` · `/feature-flags` | 🌐 | Localized reference data |
| GET `/v1/admin/overview` · `/users` | `admin.users.read` | Ops counters, user search |
| POST `/v1/admin/users/:id/suspend` · `/unsuspend` | `admin.users.suspend` | Suspend (revokes sessions) |
| GET `/v1/admin/audit-logs` | `admin.audit.read` | Audit trail |
| GET · PUT `/v1/admin/feature-flags[/:key]` | `admin.flags.manage` | Flags with country targeting |
| GET · PATCH `/v1/admin/countries[/:code]` | `admin.countries.manage` | Launch status, payments (requires provider) |
| GET · POST · DELETE `/v1/admin/staff[/:userId]` | `admin.staff.manage` | Staff roles |
| GET `/health/live` · `/health/ready` | 🌐 | Probes |

## Planned (resource sketch, Phases 2–6)

| Phase | Resources |
|---|---|
| 2 | `/v1/musicians`, `/v1/musicians/:id/services`, `/v1/bands`, `/v1/venues`, `/v1/media/uploads` (pre-signed), `/v1/jobs`, `/v1/jobs/:id/applications`, `/v1/search?type=&lat=&lng=&radiusKm=&instrument=&genre=…`, `/v1/notifications`, `/v1/me/notification-settings` |
| 3 | `/v1/conversations`, `/v1/conversations/:id/messages` (+ WebSocket), `/v1/negotiations/:id/offers` (`submit`/`view`/`accept`/`reject`/`counter`/`withdraw` mapped to `packages/domain` transitions), `/v1/availability`, `/v1/bookings`, `/v1/emergency-requests` |
| 4 | `/v1/bookings/:id/payment-intents` (Idempotency-Key required), `/v1/webhooks/payments/:provider` (signature + replay protection), `/v1/me/payout-account`, `/v1/refunds`, `/v1/disputes`, `/v1/verification-requests`, `/v1/bookings/:id/reviews` |
| 5 | `/v1/events`, `/v1/events/:id/rsvps`, `/v1/events/:id/positions` |
| 6 | `/v1/challenges`, `/v1/challenges/:id/submissions`, `/v1/submissions/:id/votes`, `/v1/reports`, `/v1/admin/moderation` |

Versioning: additive changes within `/v1`; breaking changes ship as `/v2` endpoints with a deprecation window. Mobile clients send their app version; the API can return `426` for unsupported versions.
