# 08 — Monorepo Structure

```
backupjam/
├── apps/
│   ├── api/                  NestJS modular monolith
│   │   ├── db/migrations/    forward-only SQL (0001…0007), checksummed
│   │   ├── src/
│   │   │   ├── config/       zod-validated env, runtime rate limits
│   │   │   ├── database/     pg pool, Db helper, migrator (+ CLI)
│   │   │   ├── common/       AppError, localized error filter, decorators, request context
│   │   │   ├── modules/      auth · users · organizations · reference(+i18n) · admin · audit · mail · health
│   │   │   └── scripts/      grant-staff (bootstrap), export-openapi
│   │   └── test/             e2e suites against real Postgres/PostGIS
│   ├── web/                  Next.js public site + account area (locale-prefixed routes)
│   │   ├── src/app/[locale]/ landing, directories, legal, help, contact, (account)/…
│   │   ├── src/middleware.ts locale negotiation & redirects
│   │   └── e2e/smoke.mjs     Playwright smoke test
│   ├── admin/                Next.js staff console (separate deploy, noindex)
│   └── mobile/               Flutter app (iOS/Android), lib/l10n ARB generated from packages/i18n
├── packages/
│   ├── i18n/                 ICU catalogs (16 locales) + registry, negotiation, formatting, ARB export
│   ├── domain/               money, offer & booking state machines, snapshots, invariants
│   ├── api-contract/         enums, permission matrix, DTO types, error codes, openapi.json
│   ├── api-client/           typed fetch client (web/admin)
│   └── design-tokens/        tokens.json → CSS variables + Dart constants, contrast check
├── infra/                    docker-compose (Postgres/PostGIS, Redis, apps), Dockerfiles
└── docs/                     00–20 deliverables
```

## Conventions

| Topic | Rule |
|---|---|
| Package manager | pnpm workspaces (`pnpm -r build` builds in dependency order) |
| Naming | `@backupjam/<name>`; DB tables `snake_case` plural; API paths `/v1/<resource>` |
| Shared code | Only via packages; apps never import from other apps |
| Generated files | `packages/i18n/src/generated` (gitignored, built), `apps/mobile/lib/l10n/*.arb` (committed, CI checks drift), `apps/mobile/lib/design/tokens.g.dart`, `packages/api-contract/openapi.json` (committed, CI checks drift) |
| Secrets | Only `.env.example` files are committed; real values from the secret manager (18) |
| Commits | Conventional summary + body; never include credentials |
