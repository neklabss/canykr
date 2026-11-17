# 15 — Payments Architecture

Status: **Draft / design**. No provider contract is signed. Until one is, only the clearly labelled `MockPaymentProvider` exists (D10). Nothing in this document is legal or tax advice; every provider and compliance statement below is an **assumption to be validated** by counsel and the provider's commercial team before launch in any country.

Related decisions: D3 (plain SQL for financial tables), D4 (money in `bigint` minor units + ISO-4217), D10 (no homemade escrow/wallet), D11 (digital purchases vs in-person bookings separated), D12 (verification never purchasable).

---

## 1. Scope and non-goals

| In scope | Out of scope (explicitly) |
|---|---|
| Customer → musician/band/venue payment for an **in-person booking** created from an accepted offer | BackUpJam holding customer funds in its own bank account |
| Platform commission on those bookings | Homemade escrow, wallet, stored balance, "credits" redeemable for cash |
| Seller onboarding (KYC/KYB) **performed by the licensed provider** | BackUpJam performing KYC itself or storing raw ID documents for payment purposes |
| Refunds (full/partial), payouts where the provider supports platform-initiated payouts | FX conversion by BackUpJam; display currency never changes settlement currency (D4) |
| Webhooks, reconciliation, disputes/chargebacks, tax record keeping | Paying for verification badges (D12) — not a product, not a SKU |
| Interface for digital purchases (subscriptions/boosts) — **separate module** (D11) | Mixing digital-goods revenue with booking ledgers |

**Fund holding rule:** We do **not** claim, in UI copy, terms, or marketing, that funds are "held", "protected" or "released on completion" until (a) the selected provider supports delayed capture / delayed payout / separate charges-and-transfers in that country, (b) counsel confirms the flow is permitted under the provider's licence, and (c) the completion → release flow is implemented and tested end-to-end. Until then, UI copy says only "Payment processed by {provider}".

---

## 2. Module layout (NestJS)

```
apps/api/src/modules/payments/
  payments.module.ts
  domain/
    money.ts                 # Money { amountMinor: bigint; currency: CurrencyCode }
    payment-intent.ts        # state machine
    invariants.ts            # pure functions, unit-tested (see §8)
  ports/
    payment-provider.ts      # PaymentProvider interface (§3)
  providers/
    mock.provider.ts         # MockPaymentProvider — dev/test only, refuses to boot in prod
    stripe-connect.provider.ts   # placeholder, not implemented until contract
    ...
  application/
    create-payment.usecase.ts
    refund.usecase.ts
    webhook-ingest.usecase.ts
    reconciliation.job.ts    # BullMQ repeatable job
  infra/
    payments.repo.sql.ts     # plain SQL via pg (D3)
  http/
    payments.controller.ts
    webhooks.controller.ts   # raw body, no global JSON parser
apps/api/src/modules/billing-digital/   # D11: App Store / Play / web subscriptions — separate
```

Provider selection: `ProviderRegistry.resolve(countryCode, currencyCode)` reads from the `country_payment_config` table (managed by `admin.countries.manage`). A country with no configured provider has **bookings with payment disabled** (offers can still be agreed; UI states that payment is off-platform-free only where legally acceptable, otherwise booking is not offered). Default in all environments except prod: `mock`.

---

## 3. `PaymentProvider` interface

```ts
// apps/api/src/modules/payments/ports/payment-provider.ts
export type CurrencyCode = string; // ISO-4217, validated against allow-list
export interface Money { amountMinor: bigint; currency: CurrencyCode }

export interface ProviderCapabilities {
  delayedCapture: boolean;          // authorize now, capture later
  maxAuthHoldDays: number | null;
  platformInitiatedPayouts: boolean;
  partialRefunds: boolean;
  splitPayments: boolean;           // commission deducted at charge time
  supportedCurrencies: CurrencyCode[];
}

export interface PaymentProvider {
  readonly key: 'mock' | 'stripe_connect' | 'adyen_platforms' | 'iyzico' | 'mercadopago' | 'razorpay_route';
  capabilities(country: string): ProviderCapabilities;

  /** Create/continue seller (sub-merchant / connected account) onboarding. Returns hosted onboarding URL. */
  onboardSeller(input: {
    sellerRef: string;               // our seller_accounts.id
    country: string;                 // ISO-3166-1 alpha-2
    entityType: 'individual' | 'company';
    returnUrl: string; refreshUrl: string;
    idempotencyKey: string;
  }): Promise<{ providerAccountId: string; onboardingUrl: string }>;

  /** Provider-side KYC/KYB status. Source of truth is the provider; we cache. */
  getSellerStatus(providerAccountId: string): Promise<{
    status: 'pending' | 'restricted' | 'active' | 'rejected' | 'disabled';
    chargesEnabled: boolean; payoutsEnabled: boolean;
    requirementsDue: string[];       // provider codes, shown via i18n mapping
  }>;

  createPaymentIntent(input: {
    paymentIntentId: string;         // our id, sent as provider metadata
    amount: Money;                   // gross, from accepted offer snapshot
    applicationFee: Money;           // commission, same currency
    sellerAccountId: string;
    captureMode: 'automatic' | 'manual';
    customerRef: string;
    idempotencyKey: string;
  }): Promise<{ providerIntentId: string; clientSecret?: string; redirectUrl?: string; status: ProviderIntentStatus }>;

  capture(input: { providerIntentId: string; amount?: Money; idempotencyKey: string }):
    Promise<{ status: ProviderIntentStatus; capturedAmount: Money; providerChargeId: string }>;

  refund(input: {
    providerChargeId: string;
    amount: Money;                   // full = captured − already refunded; partial = less
    reason: 'requested_by_customer' | 'cancellation_policy' | 'duplicate' | 'fraudulent' | 'dispute_settlement';
    refundApplicationFee: boolean;
    idempotencyKey: string;
  }): Promise<{ providerRefundId: string; status: 'pending' | 'succeeded' | 'failed' }>;

  /** Only if capabilities().platformInitiatedPayouts; otherwise throws NotSupportedByProvider. */
  createPayout?(input: { sellerAccountId: string; amount: Money; idempotencyKey: string }):
    Promise<{ providerPayoutId: string; status: 'pending' | 'paid' | 'failed' }>;

  /** MUST verify signature over raw body and reject stale timestamps. Never trust unparsed JSON. */
  parseWebhook(input: { rawBody: Buffer; headers: Record<string, string>; receivedAt: Date }):
    Promise<NormalizedProviderEvent>; // throws WebhookSignatureError
}

export type ProviderIntentStatus =
  | 'requires_action' | 'authorized' | 'captured' | 'canceled' | 'failed';

export interface NormalizedProviderEvent {
  providerEventId: string;           // unique per provider
  provider: PaymentProvider['key'];
  type: 'intent.authorized' | 'intent.captured' | 'intent.failed' | 'intent.canceled'
      | 'refund.succeeded' | 'refund.failed' | 'payout.paid' | 'payout.failed'
      | 'dispute.opened' | 'dispute.updated' | 'dispute.closed'
      | 'seller.updated' | 'unknown';
  occurredAt: Date;
  objectRef: string;                 // provider object id
  ourRef?: string;                   // metadata echo of our id, if present
  amount?: Money;
  raw: unknown;                      // stored encrypted, redacted of card data (we never receive PAN)
}
```

Rules for every implementation:

- [ ] All amounts in and out are `bigint` minor units; conversion to provider's format (some use integers, some decimal strings) lives in the adapter and is unit-tested per currency exponent (JPY/KRW = 0, KWD/BHD = 3, most = 2).
- [ ] Every mutating call carries an `idempotencyKey` derived deterministically: `${operation}:${ourEntityId}:${attempt}`.
- [ ] Adapters never log raw request/response bodies; only provider ids and status.
- [ ] `MockPaymentProvider` throws at module init if `NODE_ENV=production` and `PAYMENTS_ALLOW_MOCK` is not explicitly set (it must never be set in prod).
- [ ] Card data never touches our servers: hosted fields / SDK / redirect only (keeps us at the lowest PCI DSS self-assessment scope — scope to be confirmed with provider).

---

## 4. Provider candidates per region

**All entries are candidates requiring legal and commercial validation.** Availability, licence model, supported payout countries, fee structure, and whether delayed payout / split payment is allowed for our use case (services marketplace, in-person events) must be confirmed in writing.

| Region | Candidate | Model (to confirm) | Notes / open questions |
|---|---|---|---|
| US, CA, UK, EU/EEA, AU, JP, SG, others | Stripe Connect | Connected accounts (Express/Custom), destination charges or separate charges & transfers, application fee | Confirm "services marketplace / events" category acceptance; max auth hold; which countries support cross-border payouts; MoR vs platform liability for disputes |
| EU/EEA, UK, US, APAC | Adyen for Platforms | Balance platform with account holders, split payments | Typically higher minimum volume; confirm onboarding UX and KYC hosted flow availability |
| Turkey (TR) | iyzico Marketplace (submerchant) | Submerchant registration, basket item split, settlement after "approval" call | Confirm submerchant KYC requirements for individual musicians; TRY-only settlement; BDDK/TCMB licensing context via counsel |
| Latin America (BR, MX, AR, CO, CL…) | Mercado Pago Marketplace | Split payments with marketplace fee, OAuth-linked seller accounts | Confirm per-country availability; Pix/boleto support for BR; installment handling |
| India (IN) | Razorpay Route | Linked accounts, transfers with on-hold option | Confirm RBI payment aggregator rules for marketplaces; settlement timelines; GST on commission |
| Other / unsupported | None | — | Payment disabled for country; bookings may be restricted per §2 |

Selection criteria checklist (per country):

- [ ] Provider holds the required licence in that country and accepts our merchant category.
- [ ] Seller onboarding is hosted by the provider (we do not collect raw KYC data for payments).
- [ ] Supports settlement in the offer currency used in that market.
- [ ] Supports partial refunds and platform commission (application fee or split).
- [ ] Documents dispute liability allocation (platform vs seller).
- [ ] Webhooks are signed; replay window documented.
- [ ] Sandbox available for CI contract tests.
- [ ] Data-processing agreement (DPA) and data location acceptable (see doc 20).

---

## 5. Payment flow (in-person booking)

Pre-conditions: offer is `accepted`; `offer_snapshots` row frozen (amount, currency, commission rate, cancellation policy version, parties); seller account `chargesEnabled = true`.

```
Customer app        API (payments)            DB                      Provider
    |  POST /bookings/{id}/payment-intents  (Idempotency-Key: K)
    |------------------->|
    |                    | load accepted offer snapshot
    |                    | compute commission (pure fn, §8 I3)
    |                    | INSERT payment_intents(status=created) ---->|
    |                    | INSERT idempotency_keys(K, hash(req))       |
    |                    |-- createPaymentIntent(idemKey=pi:{id}:1) ------------------>|
    |                    |<- providerIntentId, clientSecret/redirectUrl ---------------|
    |                    | UPDATE status=requires_action + history row |
    |<-- 201 {clientSecret|redirectUrl}
    |-- confirm with provider SDK / hosted page ----------------------------------------->|
    |                                                                    webhook intent.authorized/captured
    |                    |<--------------------------------------------------------------|
    |                    | verify signature + timestamp; INSERT provider_events (unique event id)
    |                    | enqueue apply-event job (BullMQ)
    |                    | worker: transition intent, INSERT payment_transactions,
    |                    |         INSERT commissions (status=accrued)
    |                    | booking.status = confirmed_paid ; notify parties
```

Capture mode per provider capability:

| Capability | Flow |
|---|---|
| `delayedCapture` and gig date within `maxAuthHoldDays` | Authorize at booking, capture at a configured point (e.g. gig start − N hours) — **only after counsel sign-off** |
| No delayed capture or gig too far out | Automatic capture at booking; refunds per cancellation policy |
| Provider supports delayed payout / transfer on completion | Payout (or transfer) triggered after `booking.completed` + dispute window; until verified, payout follows provider default schedule |

Client never decides amounts: the API ignores any amount in the request body and uses the snapshot.

---

## 6. Idempotency

### 6.1 Our API (inbound from clients)

- `Idempotency-Key` header **required** on: create payment intent, refund request, cancel booking, payout request.
- Table `idempotency_keys(key, user_id, route, request_hash, response_status, response_body, created_at, expires_at)`, unique `(user_id, route, key)`.
- Same key + same hash → replay stored response. Same key + different hash → `409 idempotency_key_reused`.
- Keys retained 24h minimum; financial routes 7 days.

### 6.2 Provider webhooks (inbound from provider)

- Table `provider_events(id, provider, provider_event_id, type, occurred_at, received_at, payload_enc, processed_at, process_error)` with **`UNIQUE (provider, provider_event_id)`**.
- Ingest = verify → `INSERT ... ON CONFLICT DO NOTHING` → return `200` quickly → process asynchronously.
- Processing is idempotent by design: state transitions check current state; applying the same event twice is a no-op.
- Out-of-order events: transitions that would go "backwards" are recorded in history as `ignored_out_of_order`, never applied.
- Replay protection: reject signatures whose timestamp is outside the provider's tolerance (default 5 min); clock skew monitored.

### 6.3 Outbound (to provider)

Deterministic idempotency keys (§3) so a retried job never double-charges or double-refunds.

---

## 7. Ledger-style records

All tables: `id uuid`, `created_at timestamptz`, amounts `bigint` (minor units) + `currency char(3)`. No `UPDATE` of amounts after insert; corrections are new rows. Status changes write to `*_status_history` (append-only, enforced by a trigger that rejects `UPDATE`/`DELETE`).

| Table | Key columns | Notes |
|---|---|---|
| `payment_intents` | `booking_id`, `offer_snapshot_id`, `provider`, `provider_intent_id` (unique per provider), `amount_minor`, `currency`, `application_fee_minor`, `status`, `capture_mode` | One active intent per booking (partial unique index where status not in canceled/failed) |
| `payment_intent_status_history` | `payment_intent_id`, `from_status`, `to_status`, `cause` (`api`/`webhook`/`reconciliation`), `provider_event_id` | Append-only |
| `payment_transactions` | `payment_intent_id`, `kind` (`authorization`,`capture`,`refund`,`dispute_debit`,`dispute_credit`,`fee`), `amount_minor` (signed by kind), `currency`, `provider_ref` | Ledger lines; balance of an intent = sum |
| `refunds` | `payment_intent_id`, `amount_minor`, `currency`, `reason`, `requested_by`, `approved_by`, `provider_refund_id`, `status` | Admin refunds require `admin.finance.refund` |
| `payouts` | `seller_account_id`, `amount_minor`, `currency`, `provider_payout_id`, `status`, `source` (`provider_scheduled`/`platform_initiated`) | Mirrors provider; we do not originate payouts unless supported |
| `commissions` | `payment_intent_id`, `rate_bps`, `base_minor`, `amount_minor`, `currency`, `status` (`accrued`,`reversed`,`partially_reversed`) | Reversals are new rows referencing the original |
| `seller_accounts` | `owner_type` (`user`/`organization`), `owner_id`, `provider`, `provider_account_id`, `country`, `status`, `charges_enabled`, `payouts_enabled` | Org payouts require `org.payouts.manage` |
| `disputes` | `payment_intent_id`, `provider_dispute_id`, `reason`, `amount_minor`, `status`, `evidence_due_at` | |
| `tax_records` | see §11 | |

### Status machine — `payment_intents`

```
created → requires_action → authorized → captured → (partially_refunded) → refunded
                     ↘ failed     ↘ canceled         ↘ disputed → dispute_won | dispute_lost
```

Allowed transitions are a static table in `domain/payment-intent.ts`; anything else throws and is unit-tested exhaustively.

---

## 8. Critical financial invariants

Each invariant is (a) a pure function in `domain/invariants.ts` with unit tests, (b) enforced in SQL where feasible (CHECK / trigger), and (c) re-checked by the reconciliation job (§9).

| # | Invariant | Enforcement |
|---|---|---|
| I1 | All amounts are `bigint` minor units ≥ 0 (sign carried by `kind`), never float/numeric with decimals | Column types; lint rule bans `number` for money in domain; `CHECK (amount_minor >= 0)` |
| I2 | **Settlement currency = offer currency.** `payment_intents.currency = offer_snapshots.currency`; refunds, commissions, transactions share it | FK + trigger comparing currency; display currency (D9) never written to financial tables |
| I3 | **Commission computed from the accepted offer snapshot**, never from live offer/profile/rate tables: `amount = floor(base_minor * rate_bps / 10000)` (rounding rule fixed and documented) | Pure fn; `commissions.offer_snapshot_id` required |
| I4 | **Σ(succeeded + pending refunds) ≤ captured amount** per intent | Row lock (`SELECT ... FOR UPDATE`) on intent during refund creation + trigger check |
| I5 | Commission reversed ≤ commission accrued | Same pattern as I4 |
| I6 | Captured ≤ authorized | Check on capture transaction insert |
| I7 | Status transitions are append-only history; current status = last history row | Trigger blocks UPDATE/DELETE on history; nightly job compares |
| I8 | One `provider_event_id` processed at most once | Unique constraint |
| I9 | At most one non-terminal intent per booking | Partial unique index |
| I10 | `application_fee_minor < amount_minor` | CHECK |
| I11 | Verification badges have no price, SKU, or payment path (D12) | No product row type for verification; contract test asserts no endpoint links badge ↔ payment |
| I12 | Digital-goods revenue (D11) never appears in booking ledgers | Separate schema `billing_digital`; no FK between them |

---

## 9. Reconciliation job

BullMQ repeatable job `payments.reconcile`, hourly (incremental) + daily (full previous day per provider/currency).

Checks:

- [ ] Every provider charge/refund/payout/dispute in the provider's list/report API has a matching row (by provider id) — missing → create from provider data with `cause=reconciliation` and alert.
- [ ] Every local row in a non-terminal state older than threshold (e.g. `requires_action` > 24h) → fetch from provider, transition or cancel.
- [ ] Amount and currency match exactly for each matched pair; mismatch → `reconciliation_breaks` row, **no auto-fix**, page `finance_ops`.
- [ ] Invariants I2–I10 re-evaluated over the window.
- [ ] Daily totals per (provider, currency): gross captured, refunds, fees, commission, disputes — compared to provider settlement report.

Output: `reconciliation_runs(id, provider, window_start, window_end, status, breaks_count)`, `reconciliation_breaks(...)` viewable in admin with `admin.finance.read`. Breaks resolved only by staff action, audit-logged.

---

## 10. Chargebacks and disputes

| Step | Action |
|---|---|
| `dispute.opened` webhook | Create `disputes` row; intent → `disputed`; freeze further refunds on that intent; notify seller + `finance_ops` |
| Evidence | Admin UI assembles: offer snapshot, messages (in-platform only), booking confirmation, check-in/completion events, cancellation policy version accepted. Submitted via provider API/dashboard before `evidence_due_at` |
| Liability | Per provider contract (platform vs connected account). Record `liability_party` on dispute |
| `dispute.closed` | Write `dispute_debit`/`dispute_credit` transactions; adjust commission if contract says so (new reversal row) |
| Abuse signal | Repeated disputes by a customer or against a seller feed trust & safety risk score (doc 16) |

Refunds cannot be issued on an intent with an open dispute (provider would double-debit).

---

## 11. Tax records

We record facts; tax determination rules are configured per country after tax advisor review.

| Record | Fields |
|---|---|
| `tax_records` | `payment_intent_id`, `jurisdiction`, `tax_type` (`vat`,`gst`,`sales_tax`,`withholding`), `taxable_base_minor`, `tax_minor`, `currency`, `rate_bps`, `applies_to` (`commission`,`service`), `source` (`provider_tax_engine`/`config`) |
| Seller tax profile | Collected by provider during onboarding where possible; we store only tax id presence flag + country, not raw documents |
| Invoices | Commission invoices to sellers per country rules; numbering sequence per legal entity (gapless if required) |
| Reporting | Exports for marketplace reporting regimes (e.g. EU DAC7, US 1099-K via provider) — **assumed provider-assisted, to be confirmed** |

---

## 12. Digital goods: App Store / Google Play (D11)

| Item | Mobile (iOS/Android) | Web |
|---|---|---|
| In-person booking payment | Marketplace provider (physical/real-world service — assumed outside IAP requirement; **confirm per current store guidelines**) | Marketplace provider |
| Premium subscription, profile boost, promoted listing | **Review required**: likely Apple IAP / Google Play Billing; alternative billing programs vary by territory (e.g. EU, KR, JP, US rulings) | Web checkout via provider |
| Verification badges | Not sold anywhere (D12) | Not sold |
| Tips / donations to artists | Product decision pending; store rules differ — **do not ship without review** | — |

Module `billing-digital` owns: `digital_products`, `digital_entitlements`, store receipt/notification verification (App Store Server Notifications v2, Play RTDN), and its own reconciliation. Entitlements are server-authoritative.

Checklist per territory before enabling digital purchases:

- [ ] Current Apple App Review Guidelines §3.1 and Google Play Payments policy reviewed.
- [ ] Alternative/external billing entitlement applicability evaluated.
- [ ] Price tiers mapped per currency; tax handled by store (store is MoR) documented.
- [ ] Refund flow via store, not via our marketplace provider.

---

## 13. Security controls specific to payments

- [ ] Webhook endpoint uses raw-body parser, verifies signature per provider, rejects outside timestamp tolerance, rate-limited, IP allow-list where provider publishes ranges.
- [ ] Webhook secrets and API keys in secrets manager (doc 18), rotated; separate keys per environment; prod keys never in non-prod.
- [ ] Refunds above threshold require two staff approvals (`admin.finance.refund` + second approver); all audit-logged.
- [ ] Seller payout destination changes happen only in provider-hosted flows; we alert the seller on any `seller.updated` change.
- [ ] Messaging detects off-platform payment solicitation (doc 16).

---

## 14. Compliance assumptions (explicit, to be validated)

| # | Assumption | Owner to validate | Status |
|---|---|---|---|
| A1 | Using a licensed marketplace provider means BackUpJam does not itself need a payment institution / e-money licence in launch countries | Legal counsel per country | Open |
| A2 | BackUpJam never takes possession of customer funds; provider holds/settles them | Provider + counsel | Open |
| A3 | In-person music services are outside Apple/Google in-app purchase requirements | Mobile lead + counsel | Open |
| A4 | Provider-hosted KYC satisfies seller onboarding obligations; we keep no raw KYC documents for payments | Provider | Open |
| A5 | Card data never reaches our infrastructure; PCI scope = SAQ A (or equivalent) | Provider + security | Open |
| A6 | Commission is a taxable service of the BackUpJam entity in the seller's/customer's jurisdiction per local rules | Tax advisor | Open |
| A7 | Delayed capture / delayed payout for future gigs is permitted for our category | Provider + counsel | Open |
| A8 | Marketplace reporting (DAC7, 1099-K, local equivalents) can be provider-assisted | Tax advisor + provider | Open |
| A9 | Cancellation/refund policy shown at offer acceptance meets consumer-law minimums per country | Counsel (doc 20) | Open |
| A10 | Cross-border bookings (customer and seller in different countries) are disabled until explicitly validated | Product + counsel | Default: disabled |

No country moves to "payments enabled" in `country_payment_config` until A1–A9 are marked validated for that country and recorded in the country launch checklist (doc 20).
