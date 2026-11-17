# 10 — SQL Schema & Migrations

Source of truth: [`apps/api/db/migrations`](../apps/api/db/migrations).

| File | Contents |
|---|---|
| `0001_extensions.sql` | `pgcrypto`, `citext`, `postgis`; `set_updated_at()` and `forbid_mutation()` helpers |
| `0002_reference_data.sql` | `locales`, `currencies` (ISO exponent), `countries` (market rules, launch status, payment provider), `instruments`, `genres`, `feature_flags` |
| `0003_users.sql` | `users`, `user_identities`, `user_preferences` (locale/country/currency/time zone independent), `user_capabilities`, `onboarding_profiles` (PostGIS point), `user_instruments`, `user_genres`, `user_languages` |
| `0004_auth_sessions_consents.sql` | `sessions`, `refresh_tokens` (hash, parent chain, single use), `email_tokens`, append-only `consent_records` |
| `0005_organizations.sql` | `organizations`, `organization_memberships` + deferred "≥1 owner" constraint trigger |
| `0006_staff_audit.sql` | `staff_members`, append-only `audit_logs` |
| `0007_seed_reference.sql` | 16 locales, 32 currencies, 40 countries (all `hidden`, payments off), 37 instruments, 31 genres, feature flags |

## Migration rules

1. **Forward-only.** Never edit an applied file — the migrator stores a SHA-256 checksum per file and aborts on mismatch (tested).
2. One transaction per file; `pg_advisory_lock` serialises concurrent deploys.
3. Expand → migrate → contract for breaking changes (add column nullable → backfill job → add constraint → remove old column in a later release) so old and new API versions run side by side during rolling deploys.
4. Seed data that the code relies on (locales, currencies, flags) is versioned in migrations; environment-specific data is not.
5. Run: `pnpm db:migrate` (uses `DATABASE_URL`). Tests rebuild the schema from zero on every run.

## Critical invariants (database-enforced today)

| Invariant | Mechanism |
|---|---|
| Emails unique, case-insensitive | `citext` + partial unique index |
| Token secrets never stored | `bytea token_hash` (SHA-256) only |
| Org always has an owner | deferred constraint trigger `memberships_keep_owner` |
| Audit/consent trails immutable | `forbid_mutation()` triggers |
| Payments cannot be switched on without a provider | `CHECK (NOT payments_enabled OR payment_provider IS NOT NULL)` |
| Valid enums | `CHECK (... IN (...))` on every status/role column |

Financial invariants for Phase 4 tables are specified in docs/15 §invariants and must be enforced with constraints/triggers as well as in `packages/domain`.
