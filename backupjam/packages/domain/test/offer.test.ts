import { describe, expect, it } from 'vitest';
import {
  OFFER_STATUSES, OFFER_TRANSITIONS, OfferRevision, OfferTerms, canTransition, counter, createAgreementSnapshot,
  isExpired, money, nextOfferStatus, verifySnapshot, TERMINAL_OFFER_STATUSES, OfferAction,
} from '../src';

const VENUE = 'party_venue';
const BAND = 'party_band';

const terms = (amountMinor: bigint, currency = 'TRY'): OfferTerms => ({
  price: money(amountMinor, currency),
  serviceTitle: 'Live jazz set, 2 × 45 min',
  startsAt: '2026-12-12T20:00:00+03:00',
  endsAt: '2026-12-12T22:00:00+03:00',
  timeZone: 'Europe/Istanbul',
  venue: { name: 'Moda Jazz Bar', countryCode: 'TR', city: 'Istanbul' },
  equipmentResponsibilities: 'Venue provides PA and drum kit; band brings instruments.',
  travelExpenses: { coveredBy: 'none' },
  cancellationPolicy: { code: 'standard_72h', text: 'Free cancellation until 72 h before start.' },
  paymentConditions: { code: 'provider_capture_on_confirm', text: 'Paid via licensed provider at confirmation.' },
});

describe('offer state machine', () => {
  it('terminal states allow no further actions', () => {
    for (const s of TERMINAL_OFFER_STATUSES) {
      for (const a of Object.keys(OFFER_TRANSITIONS) as OfferAction[]) {
        for (const actor of ['author', 'recipient', 'system'] as const) expect(canTransition(s, a, actor)).toBe(false);
      }
    }
  });
  it('only the recipient may accept; only the author may withdraw', () => {
    expect(() => nextOfferStatus('submitted', 'accept', 'author')).toThrow(/cannot accept/);
    expect(nextOfferStatus('viewed', 'accept', 'recipient')).toBe('accepted');
    expect(() => nextOfferStatus('submitted', 'withdraw', 'recipient')).toThrow();
    expect(nextOfferStatus('submitted', 'withdraw', 'author')).toBe('withdrawn');
  });
  it('drafts cannot be accepted', () => {
    expect(() => nextOfferStatus('draft', 'accept', 'recipient')).toThrow(/invalid_transition|Cannot accept/);
  });
  it('every status is reachable from draft', () => {
    const seen = new Set<string>(['draft']);
    let frontier = ['draft'];
    while (frontier.length) {
      const next: string[] = [];
      for (const s of frontier) for (const r of Object.values(OFFER_TRANSITIONS)) if (r.from.has(s as never) && !seen.has(r.to)) { seen.add(r.to); next.push(r.to); }
      frontier = next;
    }
    expect([...seen].sort()).toEqual([...OFFER_STATUSES].sort());
  });
});

describe('negotiation: 12,000 budget → 14,000 offer → 12,500 counter → accepted', () => {
  it('produces an immutable, verifiable agreement snapshot', () => {
    // Band submits 14,000 TRY to the venue.
    let bandOffer: OfferRevision = { id: 'o1', negotiationId: 'n1', authorPartyId: BAND, recipientPartyId: VENUE, status: 'draft', terms: terms(1_400_000n), expiresAt: null };
    bandOffer = { ...bandOffer, status: nextOfferStatus(bandOffer.status, 'submit', 'author') };
    bandOffer = { ...bandOffer, status: nextOfferStatus(bandOffer.status, 'view', 'recipient') };

    // Venue counters at 12,500 TRY.
    const { closed, created } = counter(bandOffer, VENUE, 'o2', terms(1_250_000n), new Date('2026-12-10T00:00:00Z'));
    expect(closed.status).toBe('countered');
    expect(created).toMatchObject({ authorPartyId: VENUE, recipientPartyId: BAND, status: 'submitted' });

    // Band accepts.
    const accepted = { ...created, status: nextOfferStatus(created.status, 'accept', 'recipient') };
    const acceptedAt = new Date('2026-12-01T10:00:00Z');
    const { snapshot, hash } = createAgreementSnapshot(accepted, { customerPartyId: VENUE, performerPartyId: BAND }, acceptedAt);

    expect(snapshot.terms.price).toEqual(money(1_250_000n, 'TRY'));
    expect(verifySnapshot(snapshot, hash)).toBe(true);
    expect(Object.isFrozen(snapshot.terms.price)).toBe(true);
    expect(() => { (snapshot.terms as { serviceTitle: string }).serviceTitle = 'changed'; }).toThrow();

    // Mutating the source offer afterwards does not change the snapshot.
    (accepted.terms as { serviceTitle: string }).serviceTitle = 'Edited job description';
    expect(snapshot.terms.serviceTitle).toBe('Live jazz set, 2 × 45 min');

    // A tampered copy fails verification.
    const tampered = structuredClone(snapshot) as typeof snapshot;
    (tampered.terms as { price: unknown }).price = money(1_000_000n, 'TRY');
    expect(verifySnapshot(tampered, hash)).toBe(false);
  });

  it('rejects counters by the wrong party or in another currency', () => {
    const open: OfferRevision = { id: 'o1', negotiationId: 'n1', authorPartyId: BAND, recipientPartyId: VENUE, status: 'submitted', terms: terms(1_400_000n), expiresAt: null };
    expect(() => counter(open, BAND, 'o2', terms(1_300_000n), null)).toThrow(/recipient/);
    expect(() => counter(open, VENUE, 'o2', terms(30_000n, 'EUR'), null)).toThrow(/currency/);
    expect(() => counter(open, VENUE, 'o2', terms(0n), null)).toThrow();
  });

  it('snapshot requires accepted status and matching parties', () => {
    const o: OfferRevision = { id: 'o1', negotiationId: 'n1', authorPartyId: BAND, recipientPartyId: VENUE, status: 'submitted', terms: terms(1n), expiresAt: null };
    expect(() => createAgreementSnapshot(o, { customerPartyId: VENUE, performerPartyId: BAND }, new Date())).toThrow(/not_accepted/);
    expect(() => createAgreementSnapshot({ ...o, status: 'accepted' }, { customerPartyId: 'x', performerPartyId: BAND }, new Date())).toThrow(/parties/);
  });

  it('detects expiry only for open offers', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    expect(isExpired({ status: 'submitted', expiresAt: new Date('2026-01-01T00:00:00Z') }, now)).toBe(true);
    expect(isExpired({ status: 'accepted', expiresAt: new Date('2026-01-01T00:00:00Z') }, now)).toBe(false);
    expect(isExpired({ status: 'viewed', expiresAt: null }, now)).toBe(false);
  });
});
