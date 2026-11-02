# 12 — Authentication & Authorization Design

## Authentication

| Mechanism | Implementation (apps/api/src/modules/auth) |
|---|---|
| Password hashing | `scrypt` (N=2¹⁵, r=8, p=1, 32-byte key, 16-byte salt, NFKC normalisation), versioned format `scrypt$v1$…`, transparent rehash on login when cost rises |
| Password policy | 10–128 chars, common-password and email-local-part checks (length-first, NIST 800-63B style) |
| Access token | JWT HS256, 15 min, `iss`/`aud`/`exp`/`sub`/`sid`. Every request also checks the session row → revocation is immediate. Production should move to asymmetric keys (EdDSA) with `kid` rotation (backlog) |
| Refresh token | 256-bit opaque `bujr_…`, stored as SHA-256, single use, parent chain; **reuse revokes the whole session** and is audited |
| Sessions | Per device: name, user agent, IP, last seen; list and revoke individually; logout; password reset revokes all |
| Email verification | 256-bit token, 24 h, single use, resend invalidates previous; required to create organizations |
| Password reset | Always `202` (no enumeration), 1 h single-use token, completes email verification, revokes all sessions |
| Google / Apple | Client obtains ID token (PKCE in app/web); API verifies signature via provider JWKS, issuer, audience (our client IDs), expiry, nonce (raw or SHA-256 for Apple) |
| Account linking | Link to an existing account only if **provider email is verified AND local email is verified**; otherwise `409 auth.identity_conflict` (prevents pre-hijacking) |
| Timing | Unknown-email logins run a dummy scrypt verification |
| Rate limiting | Per-IP limits on all credential endpoints (`RATE_LIMIT_AUTH`) |
| Deletion | Password re-auth, `pending_deletion` + 30-day grace, sign-in cancels, purge job (Phase 2) anonymises PII |
| Not yet built | TOTP/WebAuthn MFA (mandatory for staff before production), optional phone verification (needs SMS provider), new-device email alerts, breached-password (k-anonymity) check |

Client storage: mobile uses Keychain/EncryptedSharedPreferences; web currently uses `sessionStorage` — **must move to an httpOnly SameSite cookie via a BFF route before launch** (tracked in backlog and threat model).

## Authorization layers

1. **Authentication guard** (global, deny by default).
2. **Platform staff RBAC** — `StaffGuard` + `@RequireStaff(permission)`; roles → permissions in `STAFF_ROLE_PERMISSIONS`; non-staff get 404.
3. **Organization RBAC** — `OrganizationsService.authorize(orgId, userId, permission)` with `ORG_ROLE_PERMISSIONS` (explicit lists, no inheritance). Owner/admin role changes need `org.roles.assign_admin` (owners only). The database guarantees ≥1 owner.
4. **Object-level rules** — ownership checks (sessions, invitations), future marketplace rules from `packages/domain` (e.g. only booking parties can review, only the offer recipient can accept/counter, payment state changes only from verified provider webhooks).
5. **Feature/country gates** — feature flags with country targeting; country `launch_status` and `payments_enabled`.

| Who | Can | Cannot |
|---|---|---|
| Anonymous | Public pages, reference data, register/login | Anything personal |
| User | Own account, sessions, preferences, consents, onboarding; create orgs (verified email) | Others' sessions or private data |
| Org member | Actions granted by role (see 03 matrix) | Owner-only actions (delete org, payouts, assign admins) |
| Staff | Exactly the permissions of their role | Suspend themselves, revoke their own staff role |
