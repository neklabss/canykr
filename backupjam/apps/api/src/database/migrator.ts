import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

export const MIGRATIONS_DIR = join(__dirname, '..', '..', 'db', 'migrations');
const LOCK_ID = 727_001; // advisory lock: one migrator at a time across replicas

export interface MigrationResult { applied: string[]; skipped: string[] }

/**
 * Forward-only, checksummed SQL migrations. Each file runs in its own transaction.
 * Editing an already-applied file is detected and aborts the deploy (deterministic schemas).
 */
export async function migrate(pool: Pool, dir = MIGRATIONS_DIR, log: (m: string) => void = () => undefined): Promise<MigrationResult> {
  const files = readdirSync(dir).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  const client = await pool.connect();
  const result: MigrationResult = { applied: [], skipped: [] };
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const { rows } = await client.query<{ version: string; checksum: string }>('SELECT version, checksum FROM schema_migrations');
    const applied = new Map(rows.map((r) => [r.version, r.checksum]));
    for (const file of files) {
      const sql = readFileSync(join(dir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const prior = applied.get(file);
      if (prior) {
        if (prior !== checksum) throw new Error(`Migration ${file} was modified after being applied (checksum mismatch)`);
        result.skipped.push(file);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
        result.applied.push(file);
        log(`applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    client.release();
  }
  return result;
}
