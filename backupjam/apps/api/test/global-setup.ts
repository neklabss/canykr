import { Pool } from 'pg';
import { migrate } from '../src/database/migrator';

/** Recreates the test schema from scratch and applies all migrations (proves migrations are deterministic). */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://backupjam:backupjam@localhost:5432/backupjam_test';
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await migrate(pool);
  } finally {
    await pool.end();
  }
}
