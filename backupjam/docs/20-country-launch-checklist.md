# 20 — Country Launch Readiness Checklist

> **Software multi-locale support ≠ legal readiness.** BackUpJam supports 16 launch locales (doc 00), but a locale being "supported" only means the UI strings are complete. It says nothing about whether we may legally operate, take payments, process personal data, or host user content in a country. A country is enabled only when **this checklist** is completed and signed off.

Locale (language) and country (market rules) are independent (D9): e.g. `ar` UI may be used in many countries; `pt-BR` UI does not by itself enable Brazil.

Nothing in this document is legal advice. Every country requires **local counsel** review; entries below are prompts for that review, not conclusions.

---

## 0. How to use

1. Copy §2 into `docs/countries/<CC>.md` (ISO-3166-1 alpha-2) for the target country.
2. Fill owner, evidence link, and status for every row.
3. Launch gate review: Legal, Privacy/DPO, Finance/Tax, T&S, Engineering, Localization, Support.
4. Only after sign-off: `admin.countries.manage` enables features per country in `country_payment_config` and feature flags.

Features can be enabled independently per country:

| Feature tier | Can launch without | Requires |
|---|---|---|
| Tier A: profiles, search, messaging, jobs (no payments) | Payment provider | Legal entity/terms, privacy, content regulation, translation, support |
| Tier B: + in-person booking payments | — | Tier A + payment provider contract + tax + consumer law on cancellations |
| Tier C: + digital purchases (premium/boosts) | — | Tier B items relevant + app-store billing review (doc 15 §12) |
| Tier D: + events with tickets/age-restricted venues, challenges with prizes | — | Event/age rules, prize/sweepstakes law |

---

## 1. Status vocabulary

`not_started` · `in_review` (counsel/vendor engaged) · `validated` (written confirmation on file) · `not_applicable` (with reason) · `blocked`

---

## 2. Checklist

### 2.1 Legal entity & corporate

- [ ] Determine contracting entity for users in the country (local entity vs foreign entity serving cross-border).
- [ ] Business registration / tax registration if required to operate or invoice commission.
- [ ] Local representative requirements (e.g. GDPR Art. 27 EU representative if no EU establishment; DSA legal representative; KVKK data controller representative for non-resident controllers; similar in other regimes).
- [ ] Trademark and app name availability in the country (doc 00 notes name not verified).
- [ ] Sanctions / export-control screening of the market and of sellers (provider usually performs; confirm).

### 2.2 Terms localization

- [ ] Terms of Service, Seller Terms, Privacy Notice, Cookie Notice, Community Guidelines adapted by local counsel (not merely translated).
- [ ] Governing law and jurisdiction clauses permissible for consumers in that country.
- [ ] Mandatory language versions (some countries require the local language to prevail for consumer contracts).
- [ ] Platform role statement: BackUpJam is a marketplace intermediary; contract for the gig is between customer and performer/org (confirm enforceability).
- [ ] Versioning: each accepted version recorded per user with timestamp (BUJ-442).

### 2.3 Consumer rights & cancellation

- [ ] Cooling-off / withdrawal rights for services booked online (e.g. EU Consumer Rights Directive exemption for leisure services on a specific date — confirm applicability).
- [ ] Cancellation policy templates allowed by local consumer law; refund deadlines.
- [ ] Mandatory pre-contract information (total price incl. fees and taxes, identity of the seller, trader vs non-trader status of the performer).
- [ ] Price display rules (tax-inclusive pricing for consumers where required).
- [ ] Ranking transparency (EU P2B Regulation / Omnibus: main ranking parameters disclosed; paid boosts labelled).
- [ ] Review authenticity disclosures (how reviews are verified — only completed bookings).
- [ ] Consumer dispute resolution body / ODR info where required.

### 2.4 Privacy & data protection

Local counsel / DPO required for each regime. Non-exhaustive:

| Regime | Country/region | Items to confirm |
|---|---|---|
| GDPR / UK GDPR | EU/EEA, UK | Lawful bases per processing; DPIA for location tracking & verification docs; Art. 27 representative; SCCs/transfer assessment; 72h breach notification; DPO need |
| KVKK | Turkey | VERBİS registration obligation; explicit consent vs other bases; cross-border transfer rules (amended 2024 regime — confirm current standard contract/notification requirements); aydınlatma metni (information notice) in Turkish |
| LGPD | Brazil | Legal bases; DPO (encarregado) appointment; ANPD breach notification; international transfer mechanisms |
| DPDP Act 2023 | India | Consent notices, consent manager rules, significant data fiduciary status, children's data (verifiable parental consent), rules in force at launch date |
| PIPL | China (mainland) | Separate consent for sensitive data & cross-border transfer; security assessment / standard contract / certification; local storage thresholds; **likely requires local entity and separate infrastructure — treat as separate program** |
| APPI | Japan | Purpose specification; third-party provision records; cross-border transfer consent/information |
| PIPA | South Korea | Consent granularity; overseas transfer disclosures; local representative thresholds |
| CCPA/CPRA & state laws | USA | Notice at collection, opt-out of sale/share, sensitive PI (precise geolocation) |
| PDPL | Saudi Arabia, UAE (separate laws) | Registration, transfer rules |
| Others (e.g. Indonesia PDP Law, Russia 152-FZ localization, Ukraine) | — | Data localization (e.g. Russia requires local storage of citizens' data — evaluate before any launch) |

Checklist:
- [ ] Record of processing activities covers this country.
- [ ] Privacy notice localized and legally reviewed.
- [ ] Consent flows (marketing, precise location, cookies/SDKs) meet local standard.
- [ ] Data subject rights flows (export, deletion, correction) operational (BUJ-443) and response deadlines known.
- [ ] Sub-processors listed (cloud, email, push, SMS, payment provider, crash reporting) with transfer mechanism.
- [ ] Breach notification authority and deadline recorded in incident runbook (doc 16 §6).
- [ ] Retention periods compatible with local law (including tax/financial record retention minimums).

### 2.5 Data residency

- [ ] Does local law require data (all, or certain categories) to be stored/processed in-country?
- [ ] If yes: region available from cloud vendor? Separate cluster? Impact on backups (doc 18 §9) and verification-doc bucket replication.
- [ ] Payment provider data location acceptable.
- [ ] Decision recorded: `residency_cluster` for the country.

### 2.6 Content regulation & platform obligations

- [ ] EU **DSA**: notice-and-action mechanism, statement of reasons to affected users, internal complaint handling, out-of-court dispute settlement info, trusted flaggers, transparency reporting, trader traceability (KYBC for business sellers), points of contact; check VLOP thresholds (unlikely at launch).
- [ ] Germany NetzDG successor obligations now under DSA — confirm no residual national requirements.
- [ ] Turkey Law No. 5651 (social network provider obligations above user thresholds: local representative, takedown timelines, reporting).
- [ ] India IT Rules 2021 (grievance officer, takedown timelines, intermediary due diligence).
- [ ] Brazil Marco Civil da Internet (log retention, court order compliance).
- [ ] Illegal-content reporting obligations (CSAM reporting routes per jurisdiction).
- [ ] Music copyright: user-uploaded performance videos/covers — collecting society rules (e.g. GEMA, MESAM/MSG, ECAD) for any platform-hosted streaming; counsel to assess safe-harbour applicability.
- [ ] Moderation coverage in the local language(s) (T&S staffing or vendor).

### 2.7 Payment provider availability (doc 15 §4)

- [ ] Candidate provider confirmed available for platforms/marketplaces in this country, in our merchant category.
- [ ] Settlement currency supported; payout to local bank accounts supported for individual musicians.
- [ ] Local payment methods covered (e.g. Pix in BR, UPI in IN, Troy/installments in TR, iDEAL in NL, Konbini in JP).
- [ ] Contract signed, DPA signed; sandbox configured in staging.
- [ ] Compliance assumptions A1–A10 (doc 15 §14) validated for this country.
- [ ] Cross-border booking policy decided (default: disabled).

### 2.8 Tax

- [ ] VAT/GST on BackUpJam commission: registration threshold, place-of-supply rules for electronic/intermediary services, rate.
- [ ] Marketplace facilitator / deemed supplier rules (does the platform become liable for tax on the underlying service?).
- [ ] Withholding tax on payouts to performers (some countries require platforms to withhold).
- [ ] Marketplace reporting regimes: EU DAC7, US 1099-K (via provider), OECD model rules adopted locally.
- [ ] E-invoicing requirements (e.g. Turkey e-Fatura/e-Arşiv, India GST e-invoicing, Brazil NF-e/NFS-e, Mexico CFDI).
- [ ] Digital services taxes applicable to platform revenue.
- [ ] Tax config entered and tested; tax records produced (doc 15 §11).

### 2.9 App-store billing (digital goods)

- [ ] Apple App Store and Google Play rules for this storefront reviewed (alternative billing / external links availability differs, e.g. KR, JP, EU, US).
- [ ] Price tiers and local currency mapping.
- [ ] Store listing, screenshots, privacy labels, Data safety form localized and accurate.
- [ ] Age rating questionnaire answered for the storefront.

### 2.10 Translation & localization quality

- [ ] UI locale(s) for this country marked `supported` in `_registry.json` (passes completeness tests, doc 17 §7).
- [ ] **Native-speaker review** completed for UI, legal documents (by counsel or certified translator), notification/email templates, and store listing — `machine_draft` not acceptable for launch.
- [ ] Music terminology glossary reviewed (instrument/genre names, local genres).
- [ ] Formats verified: dates, numbers, currency, addresses, phone numbers, names (single-name, family-name-first).
- [ ] RTL verified for RTL locales; script rendering verified (Devanagari, CJK).

### 2.11 Support coverage

- [ ] Support language(s) and hours; SLA defined.
- [ ] Escalation path for safety incidents (threats, unsafe venue) including local emergency numbers in help content.
- [ ] Help center articles localized: payments, cancellations, "never pay off-platform", verification.
- [ ] Legal/authority request handling contact (law-enforcement requests procedure).

### 2.12 Events, age restrictions & venues

- [ ] Minimum age to create an account (digital consent age varies: e.g. 13–16 in EU member states, 18 under DPDP for consent without parent).
- [ ] Minors as performers: child performance/labour permits — restrict bookings of minors unless validated.
- [ ] Age-restricted events (alcohol-serving venues, nightlife): age gate on event listings; local legal drinking/entry ages.
- [ ] Live-entertainment licensing/permits are venue/organizer responsibility — state in terms; verify `verified_venue` criteria match local business registration evidence.
- [ ] Challenges with prizes: sweepstakes/contest/lottery law (skill vs chance, registration, prohibited in some jurisdictions).
- [ ] Ticketing (if added later): resale/price caps, consumer law.

### 2.13 Trust & safety readiness

- [ ] Verification document types accepted in this country listed for reviewers (D12).
- [ ] Off-platform payment solicitation keywords added for local languages (doc 16 §4.3).
- [ ] Local fraud patterns briefed to T&S (common scams, payment apps).
- [ ] Emergency request caps tuned for population density.

### 2.14 Engineering readiness

- [ ] Country config row created; feature tiers set.
- [ ] Time zones of the country tested (incl. half-hour offsets, DST).
- [ ] Currency exponent and formatting tested.
- [ ] Geocoding/address formats tested with local samples.
- [ ] Monitoring dashboards segmented by country.
- [ ] Kill switches verified (`payments.country.<cc>.enabled`).

---

## 3. Sign-off record

| Function | Name | Date | Decision | Evidence |
|---|---|---|---|---|
| Legal (local counsel) | | | | |
| Privacy / DPO | | | | |
| Finance / Tax | | | | |
| Payments (provider contract) | | | | |
| Trust & Safety | | | | |
| Localization (native review) | | | | |
| Support | | | | |
| Engineering | | | | |

Launch decision: `Tier ___ approved on ____` — any `blocked` or `not_started` item in a required section prevents that tier from being enabled.

---

## 4. Re-review triggers

- [ ] New law/regulation in force (e.g. updated transfer rules, platform laws).
- [ ] Crossing a user-count threshold that triggers new obligations (DSA, 5651, IT Rules significant intermediary).
- [ ] New feature tier enabled.
- [ ] Payment provider change.
- [ ] Annual review regardless of changes.
