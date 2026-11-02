import { DomainError } from './errors';
import { Money, add, compare, money } from './money';

/** INVARIANT: Σ refunds ≤ captured amount, same currency as the capture. */
export function assertRefundAllowed(captured: Money, previousRefunds: readonly Money[], requested: Money): void {
  if (requested.amountMinor <= 0n) throw new DomainError('refund.non_positive');
  const already = previousRefunds.reduce((acc, r) => add(acc, r), money(0n, captured.currency));
  if (compare(add(already, requested), captured) > 0) throw new DomainError('refund.exceeds_captured');
}
