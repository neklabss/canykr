# 16 — Threat Model (STRIDE)

Status: **Living document.** Review at every phase gate and whenever a new trust boundary is introduced (realtime D13, media D15, payments D10, digital billing D11).

Method: identify assets → draw trust boundaries → enumerate threats per STRIDE category (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) → map each threat to controls with an ID → track residual risk.

---

## 1. Assets

| ID | Asset | Sensitivity | Notes |
|---|---|---|---|
| AS1 | Account credentials, refresh token families, OIDC links | Critical | D5, D6, D7 |
| AS2 | Personal data: name, email, phone, precise location, date of birth | High | Privacy regimes per doc 20 |
| AS3 | Verification documents & review notes (`identity_verified`, `official_band`, `verified_venue`…) | Critical | D12; stored separately, short retention |
| AS4 | Offers, offer snapshots, bookings, cancellation policy acceptance | High | Basis for payments and disputes |
| AS5 | Payment records, seller account links, provider API keys & webhook secrets | Critical | Doc 15 |
| AS6 | Private messages & attachments | High | |
| AS7 | Media uploads (audio, video, images, riders/PDFs) | Medium–High | D15 |
| AS8 | Reviews & ratings, challenge votes | Medium (integrity-critical) | Reputation economy |
| AS9 | Emergency request fan-out capability (push/SMS/email) | High (abuse potential) | Cost + harassment vector |
| AS10 | Admin dashboard & staff permissions | Critical | D17 separate audience |
| AS11 | Audit log | Critical (integrity) | Append-only |
| AS12 | Backups | Critical | Contains everything above |
| AS13 | Brand trust / platform reputation | High | |

---

## 2. Trust boundaries

```
[Mobile app / Web browser]  --TB1 (Internet, TLS)-->  [CDN/WAF]  --TB2-->  [API (NestJS)]
[Admin browser]             --TB3 (separate domain, separate JWT audience, MFA)--> [API admin routes]
[API] --TB4--> [PostgreSQL+PostGIS]   [API] --TB4--> [Redis/BullMQ]
[API] --TB5 (signed URLs)--> [Object storage] <--TB5-- [clients upload/download directly]
[Media workers] --TB6--> [Malware scanner / transcoder]
[Payment provider] --TB7 (signed webhooks)--> [API /webhooks]
[API] --TB8--> [Push (APNs/FCM), email, SMS providers]
[OIDC providers: Google, Apple] --TB9 (JWKS)--> [API auth]
[CI/CD] --TB10--> [registries, prod infra, secrets manager]
```

Everything arriving across TB1, TB3, TB5 (client-originated), TB7 and TB9 is untrusted until validated.

---

## 3. Control catalogue

| Control | Description |
|---|---|
| C-RL | Rate limiting (Redis token bucket) per IP, per user, per route class; stricter on auth, messaging, emergency, votes, reviews |
| C-AUTHZ | Object-level authorization: every resource load checks ownership/org-role permission (doc 00 matrix); deny by default; tests for IDOR on every route |
| C-SURL | Signed, short-lived (≤ 15 min) object-storage URLs; private buckets; per-object keys; no public listing |
| C-MAL | Malware scanning of all uploads before they become visible; quarantine bucket; content-type sniffing; size limits; image re-encoding strips EXIF/GPS |
| C-WH | Webhook signature verification over raw body + timestamp tolerance (replay protection) + unique provider event id |
| C-RTR | Refresh-token rotation with family reuse detection: reuse of a rotated token revokes the whole family and forces re-auth (D5) |
| C-MFA | MFA (TOTP / passkeys) mandatory for all staff; optional, then nudged, for users with payouts or org owner role |
| C-AUD | Append-only audit log of security- and money-relevant actions (actor, target, before/after, IP, UA); staff reads need `admin.audit.read` |
| C-RET | Data retention schedules; automatic deletion of verification docs after decision + N days; message retention per policy |
| C-VAL | Input validation (DTO schemas), output encoding, parameterized SQL only (D3) |
| C-CSP | CSP, HSTS, secure cookies (SameSite), CSRF tokens for cookie-auth web |
| C-MOD | Content moderation pipeline: user reports, keyword/heuristic classifiers, trust & safety queue (`admin.moderation.act`) |
| C-RISK | Risk scoring: account age, verification status, device/IP reputation, velocity, dispute history |
| C-VER | Verification review workflow (D12): document + liveness via vendor where available, manual review, never purchasable |
| C-NOTIF | Notification budget/caps per sender and per recipient; opt-out; quiet hours |
| C-SEC | Secrets in secrets manager, rotation, least-privilege IAM (doc 18) |
| C-BKP | Encrypted backups, restore drills (doc 18) |
| C-OBS | Security monitoring & alerting (auth anomalies, 4xx/5xx spikes, webhook failures) |
| C-UX | Safety UX: warnings on off-platform payment, "never pay outside BackUpJam" banners, report buttons |

---

## 4. Threats by scenario

Each row: STRIDE category, likelihood (L/M/H), impact (L/M/H), controls, residual risk.

### 4.1 Fake artist accounts / impersonation
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Account claims to be a known band/artist to receive bookings | S | H | H | C-VER (`official_band`/`official_artist`), name-similarity check vs verified profiles, C-MOD impersonation report type, C-UX badge explainer | M |
| Stolen media (videos of another artist) used in portfolio | S/T | H | M | Perceptual-hash duplicate detection across uploads, DMCA-style takedown flow, C-MOD | M |
| Impersonating staff ("BackUpJam Support") in messages | S | M | H | Reserved names, staff messages only via system channel with distinct UI, C-UX warning | L |

### 4.2 Fraudulent venue listings / events
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Fake venue posts jobs to harvest musician contact data or lure to unsafe locations | S/I | M | H | `verified_venue` badge, address geocode sanity (PostGIS), new-org job post limits (C-RL), C-RISK, contact details hidden until booking | M |
| Event listings for non-existent events | S | M | M | `verified_organizer`, report flow, post-event review signal | M |

### 4.3 Booking scams — off-platform payment requests
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Counterparty requests deposit via bank transfer/crypto/gift card | S | H | H | Message classifier for payment-solicitation patterns (IBAN, crypto addresses, gift cards, multilingual keywords) → inline C-UX warning + T&S flag; C-RISK; repeated → suspension | M |
| Phishing links in messages | S/I | H | H | Link safety check, link preview disabled for new accounts, C-RL on link-bearing messages | M |
| Overpayment/refund scam | S | M | M | Amounts only from offer snapshot (doc 15 I3); refunds only via provider to original method | L |

### 4.4 Payment fraud
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Stolen cards used to book | S | M | H | Provider fraud tools (3DS/SCA), C-RISK, velocity limits | M |
| Seller + buyer collusion to launder or farm commission refunds | T | L | H | Same-device/IP linkage detection, reconciliation anomalies, manual review on refunds over threshold | M |
| Forged webhook marks booking paid | S/T | M | H | C-WH, intent status always re-fetched from provider on ambiguous events | L |
| Client tampers with amount | T | H | H | Server ignores client amounts (doc 15 §5) | L |
| Double refund via retries | T | M | M | Idempotency keys + I4 invariant | L |

### 4.5 Harassment and abuse
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Unwanted messages, threats, stalking via location | I/D | H | H | Block/mute, message requests from non-connections, C-RL, approximate location only (geohash precision reduced) for public profiles, C-MOD | M |
| Doxxing in reviews/comments | I | M | H | PII detection in reviews, takedown SLA | M |

### 4.6 Malicious uploads
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Malware in PDFs (riders, contracts) | T | M | H | C-MAL, serve with `Content-Disposition: attachment`, separate download domain | L |
| Polyglot/SVG XSS | T/E | M | H | SVG disallowed or rasterized, content-type sniff, separate media origin, C-CSP | L |
| Decompression bombs / huge files (DoS) | D | M | M | Size limits pre-signed in URL policy, worker resource limits | L |
| Illegal content (CSAM, extremist) | — | L | H | Hash matching (where vendor/legal access available), mandatory reporting procedure per jurisdiction, C-MOD | M |
| EXIF GPS leak | I | H | M | Re-encode & strip metadata | L |

### 4.7 Account takeover (ATO)
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Credential stuffing | S | H | H | C-RL on login, breached-password check (k-anonymity), scrypt (D6), progressive delays, C-OBS alerts | M |
| Stolen refresh token | S | M | H | C-RTR, bind token family to device id, revoke on password change | L |
| SIM swap / email takeover then password reset | S | M | H | Reset links single-use 30 min, notify old email, step-up (C-MFA) for payout/sensitive changes, 24h cooling-off on payout-related changes | M |
| OIDC token confusion (wrong audience) | S | L | H | Verify `iss`, `aud`, `exp`, nonce against JWKS (D7) | L |
| Session hijack on admin | S/E | L | Critical | Separate admin audience (D17), C-MFA, short sessions, IP allow-list optional | L |

### 4.8 Review manipulation
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Fake positive reviews / review bombing | T | H | M | Reviews only from completed bookings (verified-booking reviews), one per party per booking, C-RISK weighting, C-RL | L–M |
| Extortion ("pay me or 1-star") | T | M | M | Report type, review hold during dispute, C-MOD | M |
| Seller deletes negative reviews | T/R | — | M | No seller delete; response only (`org.reviews.respond`); C-AUD | L |

### 4.9 Automated spam
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Bot sign-ups | S/D | H | M | C-RL, email/phone verification, device attestation (App Attest / Play Integrity) where available, privacy-friendly CAPTCHA on web | M |
| Mass messaging / job-post spam | D | H | M | New-account limits, C-RL, similarity detection | M |

### 4.10 Emergency-notification abuse
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Fake "emergency" requests to spam nearby musicians | D | M | H | Emergency requests only from verified orgs or accounts with completed bookings; C-NOTIF caps (per sender/day, per recipient/day); radius cap; cost budget | M |
| Fan-out amplification causes provider cost/DoS | D | M | M | BullMQ rate-limited queue, batch sizes, circuit breaker | L |
| Lure to unsafe location | S | L | H | Venue verification, report flow, location shared only after acceptance | M |

### 4.11 Vote bots (challenges)
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Bot accounts vote | T | H | M | Votes require verified email + minimum account age; C-RL; device/IP clustering; votes counted asynchronously with fraud scoring; prizes require manual audit | M |
| Vote buying | T | M | M | Terms prohibit; anomaly detection; disqualification flow | M |

### 4.12 Verification-document leakage
| Threat | STRIDE | L | I | Controls | Residual |
|---|---|---|---|---|---|
| Bucket misconfiguration exposes ID docs | I | L | Critical | Dedicated private bucket, separate KMS key, no public ACLs (policy-enforced), C-SURL ≤ 5 min, access only with `admin.verification.review` | L |
| Insider browsing | I/R | L | H | Per-view C-AUD entries, alerts on volume, reviewer sees watermarked view | L |
| Over-retention | I | M | H | C-RET: delete originals N days after decision; keep only decision metadata | L |
| Leak via backups | I | L | H | Encrypted backups, restricted restore access | L |

### 4.13 Platform-level
| Threat | STRIDE | Controls |
|---|---|---|
| Staff privilege escalation | E | `admin.staff.manage` only for `super_admin`; dual control for granting super_admin; C-AUD |
| Repudiation of offer acceptance | R | Offer snapshot + acceptance event with actor, timestamp, IP, policy version |
| Search scraping of musician data | I/D | C-RL, pagination caps, coarse location in results |
| Supply-chain compromise | T/E | Lockfiles, dependency audit in CI, pinned base images, SBOM, signed images (doc 18) |

---

## 5. Control → threat traceability (summary)

| Control | Primary threats mitigated |
|---|---|
| C-RL | 4.7 stuffing, 4.9 spam, 4.10, 4.11, scraping |
| C-AUTHZ | IDOR on bookings/messages/offers, org-role misuse |
| C-SURL | 4.6, 4.12 |
| C-MAL | 4.6 |
| C-WH | 4.4 forged webhooks |
| C-RTR | 4.7 stolen tokens |
| C-MFA | 4.7, 4.13 |
| C-AUD | 4.8, 4.12 insider, 4.13 |
| C-RET | 4.12, privacy minimization |

---

## 6. Incident response

### Severity levels

| Sev | Example | Response target |
|---|---|---|
| SEV1 | Data breach (verification docs, credentials), payment forgery, prod down | Page on-call immediately; incident commander within 15 min |
| SEV2 | ATO wave, emergency-notification abuse, webhook processing halted | Within 1 h |
| SEV3 | Spam surge, single-account compromise | Next business day |

### Playbook (generic)

- [ ] Declare incident, assign incident commander (IC), open incident channel and timeline doc.
- [ ] Contain: feature flags (kill switches exist for messaging links, emergency requests, uploads, payments per country, new sign-ups).
- [ ] Preserve evidence: snapshot logs, audit log export, DB snapshot if needed; do not delete.
- [ ] Rotate affected secrets (provider keys, JWT signing keys → forces re-auth, webhook secrets).
- [ ] Revoke sessions: all refresh-token families for affected users or globally.
- [ ] Assess personal-data breach: involve DPO/counsel; regulatory notification clocks (e.g. GDPR 72 h, KVKK "shortest time"/72 h guidance, others per doc 20).
- [ ] Notify affected users in their locale (pre-approved templates in `packages/i18n`).
- [ ] Notify payment provider if payment data/flows are affected.
- [ ] Recover, verify, and monitor for recurrence.
- [ ] Post-incident review within 5 business days; blameless; action items into backlog (doc 19).

### Kill switches (must exist before launch)

| Switch | Effect |
|---|---|
| `payments.country.<cc>.enabled` | Stops new intents in a country |
| `emergency.enabled` | Disables emergency requests |
| `uploads.enabled` | Rejects new upload URLs |
| `messaging.links.enabled` | Strips links from new messages |
| `signup.enabled` | Pauses registration |
| `auth.global_logout` | Revokes all refresh families |

---

## 7. Backup and restore (security view)

| Item | Requirement |
|---|---|
| PostgreSQL | Managed PITR (WAL), daily snapshots, encrypted with KMS; copy to separate account/region |
| Object storage | Versioning on; verification bucket excluded from cross-region copy unless residency permits |
| Redis | Treated as ephemeral; queues must be rebuildable (outbox pattern in Postgres) |
| Access | Restore requires two-person approval; restores audited |
| Drills | Quarterly restore drill to isolated env; measure RPO/RTO (targets in doc 18) |
| Deletion | Erasure requests honoured in backups by expiry (documented backup retention) and re-applied after restore via deletion log |

---

## 8. Review checklist per feature

- [ ] New trust boundary? Update §2.
- [ ] New asset or PII field? Update §1, retention, and privacy notice.
- [ ] Every route has object-level authz test (doc 17).
- [ ] Abuse cases written as acceptance criteria.
- [ ] Rate limits defined.
- [ ] Audit events defined.
- [ ] Kill switch needed?
