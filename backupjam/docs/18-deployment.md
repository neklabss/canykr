# 18 — Deployment

Status: **Plan.** Cloud vendor not yet selected; terms below are vendor-neutral with examples. Choice depends on data-residency needs per launch country (doc 20).

---

## 1. Environments

| Env | Purpose | Data | Payments | Access | Deploy trigger |
|---|---|---|---|---|---|
| `local` | Developer machines via `docker compose` | Seed fixtures only | `MockPaymentProvider` | Developer | Manual |
| `dev` | Integration of `main`, ephemeral preview envs per PR (optional) | Synthetic seed | Mock | Engineering | Merge to `main` |
| `staging` | Release candidate, prod-like topology, load & DAST | Synthetic + anonymized (DPO-approved) | Provider **sandbox** accounts only | Engineering, QA, T&S, finance_ops | Tag `vX.Y.Z-rc.N` |
| `prod` | Production | Real | Live provider accounts per enabled country | On-call engineers (break-glass), CI deploy role | Tag `vX.Y.Z` + manual approval |

Rules:
- [ ] No production data in `local`/`dev`; anonymized only in staging with approval.
- [ ] Prod and non-prod in separate cloud accounts/projects; no network peering.
- [ ] Prod payment keys exist only in prod secrets manager.
- [ ] `MockPaymentProvider` refuses to boot in prod (doc 15).

---

## 2. Local development

`backupjam/docker-compose.yml` (to be created with Phase 1):

| Service | Image (pinned by digest in practice) |
|---|---|
| `postgres` | `postgis/postgis:16-3.4` |
| `redis` | `redis:7-alpine` |
| `minio` | S3-compatible object storage |
| `mailpit` | SMTP capture |
| `api`, `web`, `admin` | Built from repo Dockerfiles (dev target with hot reload) |

Flutter runs natively against `http://10.0.2.2:<port>` (Android emulator) / `localhost` (iOS simulator).

---

## 3. Docker images

| Image | Base | Notes |
|---|---|---|
| `backupjam/api` | `node:22-slim` (distroless runtime stage optional) | Multi-stage: `pnpm fetch` → build → prune to prod deps; runs as non-root; `NODE_ENV=production`; healthcheck `/health/live`, `/health/ready` |
| `backupjam/worker` | Same as API, different entrypoint (`node dist/worker.js`) | BullMQ processors (notifications, media, reconciliation) |
| `backupjam/web` | `node:22-slim` | Next.js `output: 'standalone'` |
| `backupjam/admin` | `node:22-slim` | Separate image and deployment (D17) |
| `backupjam/migrate` | Same as API | Runs migration CLI only |

Image requirements:
- [ ] Tagged with git SHA and semver; `latest` never used in deploy manifests.
- [ ] SBOM generated (Syft) and image signed (cosign); signature verified at deploy.
- [ ] Trivy scan: no critical vulns at release.
- [ ] Read-only root filesystem; writable `/tmp` only.

---

## 4. Managed infrastructure

| Component | Choice (managed) | Config notes |
|---|---|---|
| PostgreSQL 16 + PostGIS | Managed service supporting PostGIS extension (e.g. AWS RDS/Aurora PostgreSQL, Google Cloud SQL, Azure Flexible Server) | Multi-AZ; PITR enabled; `pg_stat_statements`; TLS required; app role without DDL rights; migration role separate |
| Redis 7 | Managed (ElastiCache / Memorystore / Azure Cache) | TLS + AUTH; `noeviction` for BullMQ instance; separate instance (or DB) for cache vs queues |
| Object storage | S3 / GCS (S3-compatible API) / R2 | Buckets: `media-public-derivatives`, `media-private`, `uploads-quarantine`, `verification-docs` (separate KMS key, no replication unless residency allows); block public access by default |
| CDN | CloudFront / Cloud CDN / Cloudflare | Serves web static assets and public media derivatives; signed URLs/cookies for private media; WAF rules + bot management |
| Compute | Containers on managed orchestration (ECS Fargate / Cloud Run / Kubernetes) | Separate services: `api`, `worker`, `web`, `admin`; autoscaling on CPU/RPS/queue depth |
| Email / push / SMS | Transactional email provider, APNs, FCM, SMS provider | Per-region sender configuration |
| DNS & TLS | Managed DNS; ACME/managed certs | `api.`, `www.`, `admin.` (admin optionally behind identity-aware proxy), `media.` |

Region strategy: start single primary region per data-residency cluster; add regions only where law requires local storage (doc 20 data residency).

---

## 5. Secrets management

- **Never in the repo.** `gitleaks` in pre-commit and CI; `.env*` gitignored except `.env.example` with placeholder values.
- Stored in cloud secrets manager (AWS Secrets Manager / GCP Secret Manager / Vault); injected as env vars or mounted files at runtime.
- Per-environment secrets; prod secrets readable only by prod runtime roles and break-glass.
- CI authenticates to cloud via OIDC federation (GitHub Actions → cloud role); no long-lived cloud keys in GitHub secrets.

| Secret | Rotation |
|---|---|
| JWT signing keys (asymmetric in prod, D5) | 90 days, with `kid` overlap |
| DB credentials | Managed rotation, 30–90 days |
| Payment provider API keys & webhook secrets | Per provider guidance; immediately on suspicion |
| OIDC client secrets (Apple key) | Per provider expiry |
| Push credentials (APNs key, FCM service account) | Annually |
| Encryption keys (KMS) | Automatic annual rotation |

---

## 6. Database migrations in the release pipeline

D3: plain SQL, forward-only, checksummed.

- [ ] Migrations live in `apps/api/migrations/NNNN_description.sql`; checksum stored in `schema_migrations`.
- [ ] CI applies all migrations to a fresh DB and to a snapshot of staging schema.
- [ ] Release runs `backupjam/migrate` as a one-off job **before** rolling out new app versions.
- [ ] **Expand/contract** pattern: every migration must be compatible with the currently running app version (add nullable column → deploy code → backfill → enforce constraint → remove old column in a later release).
- [ ] Long-running operations: `CREATE INDEX CONCURRENTLY` (in its own non-transactional migration), batched backfills as jobs, `lock_timeout` set.
- [ ] No down migrations; rollback = forward fix or restore (§9).
- [ ] Financial tables changes require review from payments owner.

---

## 7. Rollout strategy

| Service | Strategy |
|---|---|
| `api` | Rolling with readiness gates (min healthy 100 %, surge 25 %); blue/green optional for major releases |
| `worker` | Rolling; graceful shutdown waits for in-flight BullMQ jobs (SIGTERM → stop fetching → finish up to 60 s) |
| `web`, `admin` | Rolling; static assets versioned and kept for N previous releases so old clients don't 404 |

- Feature flags (`admin.flags.manage`) decouple deploy from release; kill switches listed in doc 16 §6.
- Automatic rollback when error rate or p95 latency exceeds thresholds for 5 min post-deploy.
- API versioning: `/v1`; mobile clients must keep working for at least the two previous app versions → no breaking API change without version bump (doc 17 contract gate). Server enforces `min_supported_app_version` for forced upgrade.

---

## 8. Observability

| Signal | Implementation | Requirements |
|---|---|---|
| Structured logs | JSON (pino) to stdout → log pipeline | Fields: `ts`, `level`, `service`, `env`, `version`, `request_id`, `trace_id`, `user_id` (pseudonymous id only), `route`, `status`, `duration_ms`. **No** passwords, tokens, PAN, full message bodies, verification-doc content, raw webhook payloads |
| Metrics | OpenTelemetry → Prometheus-compatible backend | RED per route; queue depth/age per BullMQ queue; DB pool; webhook received/processed/failed; reconciliation breaks; emergency fan-out sent/capped |
| Traces | OpenTelemetry SDK (Nest HTTP, pg, ioredis, BullMQ) | Trace id propagated from clients via `traceparent`; sampled 10 % + 100 % of errors |
| Mobile crash/ANR | Crash reporting SDK with PII scrubbing | Release-tagged symbols uploaded in CI |
| Web RUM | Core Web Vitals per locale | |
| Uptime | External synthetic checks per region | |

Alerts (initial): API 5xx > 1 % 5 min; p95 > 1 s; queue age > 5 min; webhook failures > 0 for 10 min; reconciliation breaks > 0; DB CPU > 80 %; replica lag; certificate expiry < 14 days; auth failure spike.

SLOs (initial, revisit after launch): API availability 99.9 % monthly; booking/payment endpoints 99.95 %.

---

## 9. Backups, RPO, RTO

| Data | Backup | RPO | RTO |
|---|---|---|---|
| PostgreSQL | PITR (continuous WAL) + daily snapshot, retained 35 days; weekly copy to separate account/region (residency permitting) | ≤ 5 min | ≤ 4 h |
| Object storage (media) | Versioning + lifecycle; cross-region replication for public derivatives | ≤ 24 h | ≤ 24 h |
| Verification docs | Versioned, no cross-region copy by default; short retention (doc 16 C-RET) | ≤ 24 h | Best effort |
| Redis | Not backed up as source of truth; queues reconstructable from Postgres outbox | n/a | ≤ 1 h |
| Secrets | Managed by secrets manager with versioning | n/a | ≤ 1 h |

- [ ] Quarterly restore drill into an isolated account; record actual RPO/RTO.
- [ ] Restores require two-person approval and are audit-logged.
- [ ] After a restore, replay the erasure log so deleted users stay deleted.
- [ ] Reconcile payments against provider after any restore (doc 15 §9).

---

## 10. Mobile release

| Stage | iOS | Android |
|---|---|---|
| Internal | TestFlight internal testers | Play **internal testing** track |
| Beta | TestFlight external (beta review) | Closed testing track |
| Staged rollout | Phased release (7 days) | Staged rollout 1 % → 10 % → 50 % → 100 % |
| Flavors | `dev`, `staging`, `prod` with different bundle ids / app ids and API base URLs | same |

- [ ] Build in CI (GitHub Actions macOS runner for iOS; Fastlane for signing/upload).
- [ ] Signing keys: iOS certificates via App Store Connect API key in secrets manager; Android upload key in secrets manager, Play App Signing enabled.
- [ ] Store listing localized per launch locale (reviewed, not machine-only; doc 20).
- [ ] Privacy nutrition labels (Apple) and Data safety form (Google) kept in sync with actual data collection.
- [ ] Digital purchases reviewed per doc 15 §12 before submission.
- [ ] Remote config / feature flags allow disabling features without new binary.

---

## 11. CI/CD pipeline (GitHub Actions)

```
.github/workflows/
  ci.yml            # on: pull_request, push to main
  release.yml       # on: tag v*
  mobile.yml        # on: tag mobile-v*, workflow_dispatch
  nightly.yml       # on: schedule (full Playwright, ZAP, dep audit)
```

### `ci.yml` (PR)

| Job | Steps |
|---|---|
| `setup` | Checkout, pnpm cache, Flutter cache, detect changed paths (turbo/nx affected or path filters) |
| `lint-typecheck` | eslint, tsc, `dart analyze`, prettier check |
| `api-test` | Services: `postgis/postgis:16-3.4`, `redis:7`; run migrations; unit + e2e; upload coverage |
| `contract` | Regenerate OpenAPI, diff, Spectral, oasdiff vs `main` |
| `i18n` | Completeness, ICU, plurals, ARB export |
| `mobile-test` | `flutter test` incl. goldens (pinned container) |
| `web-test` | Unit + Playwright smoke via docker compose |
| `security` | gitleaks, CodeQL/Semgrep, `pnpm audit --audit-level high`, osv-scanner |
| `build-images` | Build (no push) to verify Dockerfiles |

### `release.yml` (tag)

1. Build & push images (tag SHA + version), SBOM, cosign sign, Trivy scan.
2. Deploy to **staging**: run `migrate` job → roll out `api`, `worker`, `web`, `admin` → smoke tests → k6 short run (if search/emergency touched).
3. **Manual approval** (GitHub Environment protection, required reviewers).
4. Deploy to **prod**: `migrate` → rolling deploy → synthetic checks → automatic rollback on alert breach.
5. Create GitHub release notes; notify channel.

### `mobile.yml`
Build flavors → run tests → Fastlane upload to TestFlight / Play internal track → promotion is manual.

Branch protection on `main`: required checks from `ci.yml`, one approving review (two for `payments`, `auth`, migrations — enforced via CODEOWNERS), linear history, no force-push.

---

## 12. Release checklist

- [ ] All CI gates green; contract diff reviewed.
- [ ] Migrations expand/contract compatible with running version.
- [ ] Feature flags default safe (off) in prod for new features.
- [ ] Dashboards/alerts exist for new endpoints and queues.
- [ ] Runbook updated for new failure modes.
- [ ] Rollback plan stated in release PR.
- [ ] For payment changes: reconciliation run on staging sandbox clean.
