import { DomainError } from './errors';
import { Money } from './money';
import { canonicalJson, sha256Hex } from './canonical';

export const OFFER_STATUSES = ['draft', 'submitted', 'viewed', 'countered', 'accepted', 'rejected', 'expired', 'withdrawn'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const TERMINAL_OFFER_STATUSES: ReadonlySet<OfferStatus> = new Set(['countered', 'accepted', 'rejected', 'expired', 'withdrawn']);
const OPEN: ReadonlySet<OfferStatus> = new Set(['submitted', 'viewed']);

export type OfferAction = 'submit' | 'view' | 'accept' | 'reject' | 'counter' | 'withdraw' | 'expire';
/** author = party that created this offer revision; recipient = the other party; system = scheduler. */
export type OfferActor = 'author' | 'recipient' | 'system';

interface Rule { from: ReadonlySet<OfferStatus>; to: OfferStatus; actor: OfferActor }

/** Single source of truth for allowed offer transitions (mirrored in docs/14-state-machines.md). */
export const OFFER_TRANSITIONS: Readonly<Record<OfferAction, Rule>> = {
  submit: { from: new Set(['draft']), to: 'submitted', actor: 'author' },
  view: { from: new Set(['submitted']), to: 'viewed', actor: 'recipient' },
  accept: { from: OPEN, to: 'accepted', actor: 'recipient' },
  reject: { from: OPEN, to: 'rejected', actor: 'recipient' },
  counter: { from: OPEN, to: 'countered', actor: 'recipient' },
  withdraw: { from: new Set(['draft', 'submitted', 'viewed']), to: 'withdrawn', actor: 'author' },
  expire: { from: OPEN, to: 'expired', actor: 'system' },
};

export function nextOfferStatus(current: OfferStatus, action: OfferAction, actor: OfferActor): OfferStatus {
  const rule = OFFER_TRANSITIONS[action];
  if (rule.actor !== actor) throw new DomainError('offer.actor_not_allowed', `${actor} cannot ${action}`);
  if (!rule.from.has(current)) throw new DomainError('offer.invalid_transition', `Cannot ${action} an offer that is ${current}`);
  return rule.to;
}

export function canTransition(current: OfferStatus, action: OfferAction, actor: OfferActor): boolean {
  try {
    nextOfferStatus(current, action, actor);
    return true;
  } catch {
    return false;
  }
}

export interface OfferTerms {
  price: Money;
  serviceTitle: string;
  startsAt: string; // ISO-8601 with offset
  endsAt: string;
  timeZone: string; // IANA
  venue: { name: string; address?: string; countryCode: string; city: string } | null;
  equipmentResponsibilities: string;
  travelExpenses: { coveredBy: 'customer' | 'performer' | 'shared' | 'none'; capMinor?: bigint; note?: string };
  cancellationPolicy: { code: string; text: string };
  paymentConditions: { code: string; text: string };
}

export interface OfferRevision {
  id: string;
  negotiationId: string;
  authorPartyId: string;
  recipientPartyId: string;
  status: OfferStatus;
  terms: OfferTerms;
  expiresAt: Date | null;
}

export function assertCurrencyConsistent(previous: OfferRevision | undefined, next: OfferTerms): void {
  if (previous && previous.terms.price.currency !== next.price.currency) {
    throw new DomainError('offer.currency_change_not_allowed', 'Counter-offers must keep the negotiation currency');
  }
  if (next.price.amountMinor <= 0n) throw new DomainError('offer.non_positive_price');
}

/**
 * Applies a counter-offer: the open revision becomes `countered` and a new revision authored by the
 * former recipient is `submitted`. Exactly one open revision per negotiation at any time.
 */
export function counter(open: OfferRevision, actingPartyId: string, newId: string, terms: OfferTerms, expiresAt: Date | null) {
  if (actingPartyId !== open.recipientPartyId) throw new DomainError('offer.actor_not_allowed', 'Only the recipient can counter');
  assertCurrencyConsistent(open, terms);
  const closed: OfferRevision = { ...open, status: nextOfferStatus(open.status, 'counter', 'recipient') };
  const created: OfferRevision = {
    id: newId,
    negotiationId: open.negotiationId,
    authorPartyId: actingPartyId,
    recipientPartyId: open.authorPartyId,
    status: 'submitted',
    terms,
    expiresAt,
  };
  return { closed, created };
}

export function isExpired(offer: Pick<OfferRevision, 'status' | 'expiresAt'>, now: Date): boolean {
  return OPEN.has(offer.status) && offer.expiresAt !== null && offer.expiresAt.getTime() <= now.getTime();
}

export interface AgreementSnapshot {
  version: 1;
  negotiationId: string;
  offerId: string;
  parties: { customerPartyId: string; performerPartyId: string };
  terms: OfferTerms;
  acceptedAt: string;
}

/**
 * Freezes accepted terms. Later edits to the job/listing never alter this snapshot; the hash is stored
 * alongside it and re-verified whenever the booking is read for payment, payout or dispute.
 */
export function createAgreementSnapshot(
  offer: OfferRevision,
  roles: { customerPartyId: string; performerPartyId: string },
  acceptedAt: Date,
): { snapshot: AgreementSnapshot; hash: string } {
  if (offer.status !== 'accepted') throw new DomainError('offer.not_accepted');
  const ids = new Set([offer.authorPartyId, offer.recipientPartyId]);
  if (!ids.has(roles.customerPartyId) || !ids.has(roles.performerPartyId) || roles.customerPartyId === roles.performerPartyId) {
    throw new DomainError('offer.parties_mismatch');
  }
  const snapshot: AgreementSnapshot = deepFreeze({
    version: 1,
    negotiationId: offer.negotiationId,
    offerId: offer.id,
    parties: { ...roles },
    terms: structuredClone(offer.terms),
    acceptedAt: acceptedAt.toISOString(),
  });
  return { snapshot, hash: sha256Hex(canonicalJson(snapshot)) };
}

export function verifySnapshot(snapshot: AgreementSnapshot, hash: string): boolean {
  return sha256Hex(canonicalJson(snapshot)) === hash;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.values(o as object).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}
