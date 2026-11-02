import { describe, expect, it } from 'vitest';
import { assertRefundAllowed, canReview, isEligibleForAutoComplete, money, nextBookingStatus } from '../src';

describe('booking lifecycle', () => {
  it('happy path awaiting_payment → confirmed → completed → settled', () => {
    let s = nextBookingStatus('awaiting_payment', 'payment_succeeded', 'provider_webhook');
    expect(s).toBe('confirmed');
    s = nextBookingStatus(s, 'service_completed', 'customer');
    s = nextBookingStatus(s, 'payout_settled', 'provider_webhook');
    expect(s).toBe('settled');
  });
  it('clients can never mark payments as succeeded', () => {
    expect(() => nextBookingStatus('awaiting_payment', 'payment_succeeded', 'customer')).toThrow(/cannot/);
    expect(() => nextBookingStatus('awaiting_payment', 'payment_succeeded', 'staff')).toThrow();
  });
  it('performers cannot self-complete; disputes resolve only by staff', () => {
    expect(() => nextBookingStatus('confirmed', 'service_completed', 'performer')).toThrow();
    const d = nextBookingStatus('completed', 'open_dispute', 'performer');
    expect(() => nextBookingStatus(d, 'resolve_dispute', 'customer')).toThrow();
    expect(nextBookingStatus(d, 'resolve_dispute', 'staff')).toBe('resolved');
  });
  it('terminal states are final', () => {
    expect(() => nextBookingStatus('settled', 'open_dispute', 'customer')).toThrow();
    expect(() => nextBookingStatus('cancelled', 'payment_succeeded', 'provider_webhook')).toThrow();
  });
  it('auto-completes only after grace period', () => {
    const end = new Date('2026-05-01T22:00:00Z');
    expect(isEligibleForAutoComplete('confirmed', end, new Date('2026-05-02T22:00:00Z'))).toBe(false);
    expect(isEligibleForAutoComplete('confirmed', end, new Date('2026-05-03T22:00:00Z'))).toBe(true);
    expect(isEligibleForAutoComplete('disputed', end, new Date('2026-06-03T22:00:00Z'))).toBe(false);
  });
  it('reviews require completed booking, a party reviewer and the other party as subject', () => {
    const parties = { customerPartyId: 'c', performerPartyId: 'p' };
    expect(canReview('completed', 'c', parties, 'p')).toBe(true);
    expect(canReview('completed', 'c', parties, 'c')).toBe(false); // self-review
    expect(canReview('completed', 'x', parties, 'p')).toBe(false); // outsider
    expect(canReview('confirmed', 'c', parties, 'p')).toBe(false); // not completed
  });
});

describe('refund invariant', () => {
  it('Σ refunds must not exceed captured amount', () => {
    const cap = money(10_000n, 'EUR');
    expect(() => assertRefundAllowed(cap, [money(6_000n, 'EUR')], money(4_000n, 'EUR'))).not.toThrow();
    expect(() => assertRefundAllowed(cap, [money(6_000n, 'EUR')], money(4_001n, 'EUR'))).toThrow(/exceeds/);
    expect(() => assertRefundAllowed(cap, [], money(1n, 'USD'))).toThrow();
    expect(() => assertRefundAllowed(cap, [], money(0n, 'EUR'))).toThrow();
  });
});
