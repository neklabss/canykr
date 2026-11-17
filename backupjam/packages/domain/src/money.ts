import { DomainError } from './errors';

/**
 * Money is always an integer amount of ISO-4217 minor units plus a currency code.
 * INVARIANT: never use floating point for stored or settled amounts.
 */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: string;
}

const CURRENCY_RE = /^[A-Z]{3}$/;

export function money(amountMinor: bigint | number | string, currency: string): Money {
  if (!CURRENCY_RE.test(currency)) throw new DomainError('money.invalid_currency', `Invalid currency: ${currency}`);
  if (typeof amountMinor === 'number' && !Number.isSafeInteger(amountMinor)) {
    throw new DomainError('money.not_integer', 'Minor-unit amounts must be integers');
  }
  return Object.freeze({ amountMinor: BigInt(amountMinor), currency });
}

function same(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new DomainError('money.currency_mismatch', `${a.currency} ≠ ${b.currency}`);
}

export const add = (a: Money, b: Money): Money => (same(a, b), money(a.amountMinor + b.amountMinor, a.currency));
export const subtract = (a: Money, b: Money): Money => (same(a, b), money(a.amountMinor - b.amountMinor, a.currency));
export const isNegative = (a: Money): boolean => a.amountMinor < 0n;
export const compare = (a: Money, b: Money): -1 | 0 | 1 => (same(a, b), a.amountMinor < b.amountMinor ? -1 : a.amountMinor > b.amountMinor ? 1 : 0);

/**
 * Applies a rate in basis points (1 bp = 0.01 %), rounding half away from zero to the nearest minor unit.
 * Used for platform commission. Example: 12,500.00 TRY at 1,000 bp (10 %) → 1,250.00 TRY.
 */
export function percentageOf(a: Money, basisPoints: number): Money {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new DomainError('money.invalid_rate', 'Basis points must be an integer in [0, 10000]');
  }
  const num = a.amountMinor * BigInt(basisPoints);
  const sign = num < 0n ? -1n : 1n;
  const abs = num * sign;
  const q = abs / 10_000n;
  const r = abs % 10_000n;
  return money(sign * (r * 2n >= 10_000n ? q + 1n : q), a.currency);
}

export interface CommissionBreakdown {
  gross: Money;
  platformFee: Money;
  sellerNet: Money;
}

/** Splits a gross amount into platform fee and seller net. INVARIANT: fee + net === gross. */
export function splitCommission(gross: Money, basisPoints: number): CommissionBreakdown {
  if (isNegative(gross)) throw new DomainError('money.negative_gross');
  const platformFee = percentageOf(gross, basisPoints);
  return { gross, platformFee, sellerNet: subtract(gross, platformFee) };
}
