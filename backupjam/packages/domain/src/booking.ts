import { DomainError } from './errors';

/**
 * Booking lifecycle. Payment-related transitions are only ever driven by verified payment-provider
 * events (webhooks), never by client requests. No funds are held by BackUpJam itself.
 */
export const BOOKING_STATUSES = [
  'awaiting_payment', 'confirmed', 'completed', 'settled',
  'cancelled', 'expired', 'disputed', 'resolved',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingEvent =
  | 'payment_succeeded' | 'payment_failed_final' | 'payment_window_elapsed'
  | 'cancel' | 'service_completed' | 'auto_complete' | 'payout_settled'
  | 'open_dispute' | 'resolve_dispute';

export type BookingActor = 'customer' | 'performer' | 'provider_webhook' | 'system' | 'staff';

interface Rule { from: readonly BookingStatus[]; to: BookingStatus; actors: readonly BookingActor[] }

export const BOOKING_TRANSITIONS: Readonly<Record<BookingEvent, Rule>> = {
  payment_succeeded: { from: ['awaiting_payment'], to: 'confirmed', actors: ['provider_webhook'] },
  payment_failed_final: { from: ['awaiting_payment'], to: 'cancelled', actors: ['provider_webhook'] },
  payment_window_elapsed: { from: ['awaiting_payment'], to: 'expired', actors: ['system'] },
  cancel: { from: ['awaiting_payment', 'confirmed'], to: 'cancelled', actors: ['customer', 'performer', 'staff'] },
  service_completed: { from: ['confirmed'], to: 'completed', actors: ['customer', 'staff'] },
  auto_complete: { from: ['confirmed'], to: 'completed', actors: ['system'] },
  payout_settled: { from: ['completed', 'resolved'], to: 'settled', actors: ['provider_webhook'] },
  open_dispute: { from: ['confirmed', 'completed'], to: 'disputed', actors: ['customer', 'performer', 'staff'] },
  resolve_dispute: { from: ['disputed'], to: 'resolved', actors: ['staff'] },
};

export const TERMINAL_BOOKING_STATUSES: ReadonlySet<BookingStatus> = new Set(['settled', 'cancelled', 'expired']);

export function nextBookingStatus(current: BookingStatus, event: BookingEvent, actor: BookingActor): BookingStatus {
  const rule = BOOKING_TRANSITIONS[event];
  if (!rule.actors.includes(actor)) throw new DomainError('booking.actor_not_allowed', `${actor} cannot trigger ${event}`);
  if (!rule.from.includes(current)) throw new DomainError('booking.invalid_transition', `${event} not allowed from ${current}`);
  return rule.to;
}

/** Auto-completion only after the scheduled end plus a grace period, and only if not disputed. */
export function isEligibleForAutoComplete(status: BookingStatus, endsAt: Date, now: Date, graceHours = 48): boolean {
  return status === 'confirmed' && now.getTime() >= endsAt.getTime() + graceHours * 3_600_000;
}

/** Reviews may only be written for completed (or settled) bookings, by a party, about the other party. */
export function canReview(status: BookingStatus, reviewerPartyId: string, parties: { customerPartyId: string; performerPartyId: string }, subjectPartyId: string): boolean {
  const isParty = reviewerPartyId === parties.customerPartyId || reviewerPartyId === parties.performerPartyId;
  const subjectIsOther = subjectPartyId !== reviewerPartyId && (subjectPartyId === parties.customerPartyId || subjectPartyId === parties.performerPartyId);
  return (status === 'completed' || status === 'settled' || status === 'resolved') && isParty && subjectIsOther;
}
