import { describe, expect, it } from 'vitest';
import { DomainError, add, money, percentageOf, splitCommission } from '../src';

describe('money', () => {
  it('rejects floats and bad currencies', () => {
    expect(() => money(1.5, 'USD')).toThrow(DomainError);
    expect(() => money(1, 'usd')).toThrow(/Invalid currency/);
  });
  it('refuses cross-currency arithmetic', () => {
    expect(() => add(money(1, 'EUR'), money(1, 'TRY'))).toThrow(/currency_mismatch|≠/);
  });
  it('computes commission with half-up rounding and fee + net = gross', () => {
    const gross = money(1_250_000n, 'TRY'); // 12,500.00 TRY
    const s = splitCommission(gross, 1_000);
    expect(s.platformFee.amountMinor).toBe(125_000n);
    expect(s.sellerNet.amountMinor).toBe(1_125_000n);
    expect(percentageOf(money(5, 'USD'), 1_000).amountMinor).toBe(1n); // 0.5 → 1
    expect(percentageOf(money(4, 'USD'), 1_000).amountMinor).toBe(0n); // 0.4 → 0
  });
  it('fee + net always equals gross (property check)', () => {
    for (let i = 0; i < 2_000; i++) {
      const g = BigInt(Math.floor(Math.random() * 1e12));
      const bp = Math.floor(Math.random() * 10_001);
      const s = splitCommission(money(g, 'EUR'), bp);
      expect(s.platformFee.amountMinor + s.sellerNet.amountMinor).toBe(g);
      expect(s.sellerNet.amountMinor >= 0n).toBe(true);
    }
  });
  it('validates basis points', () => {
    expect(() => percentageOf(money(1, 'USD'), 10_001)).toThrow();
    expect(() => percentageOf(money(1, 'USD'), 1.5)).toThrow();
  });
});
