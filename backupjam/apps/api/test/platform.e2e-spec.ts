import { cpSync, mkdtempSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { MIGRATIONS_DIR, migrate } from '../src/database/migrator';
import { createTestContext, uniqueEmail } from './helpers';

describe('platform (e2e)', () => {
  it('migrations are idempotent and tamper-evident', async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const again = await migrate(pool);
      expect(again.applied).toEqual([]);
      expect(again.skipped.length).toBeGreaterThanOrEqual(7);
      const dir = mkdtempSync(join(tmpdir(), 'buj-mig-'));
      cpSync(MIGRATIONS_DIR, dir, { recursive: true });
      appendFileSync(join(dir, '0002_reference_data.sql'), '\n-- sneaky edit\n');
      await expect(migrate(pool, dir)).rejects.toThrow(/checksum mismatch/);
      writeFileSync(join(dir, 'README.txt'), 'ignored');
    } finally {
      await pool.end();
    }
  });

  it('rate-limits credential endpoints per IP with a localized 429', async () => {
    const ctx = await createTestContext({ RATE_LIMIT_AUTH: '3' });
    try {
      const body = { email: uniqueEmail('rl'), password: 'not the password' };
      for (let i = 0; i < 3; i++) await ctx.http().post('/v1/auth/login').send(body).expect(401);
      const r = await ctx.http().post('/v1/auth/login').set('Accept-Language', 'es').send(body).expect(429);
      expect(r.body.error).toEqual({ code: 'rate_limited', message: 'Demasiados intentos. Espera e inténtalo de nuevo.' });
    } finally {
      await ctx.close();
    }
  });

  it('serves security headers and no x-powered-by', async () => {
    const ctx = await createTestContext();
    try {
      const r = await ctx.http().get('/health/live').expect(200);
      expect(r.headers['x-powered-by']).toBeUndefined();
      expect(r.headers['x-content-type-options']).toBe('nosniff');
    } finally {
      await ctx.close();
    }
  });
});
