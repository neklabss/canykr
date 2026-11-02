import { Pool } from 'pg';
import { migrate } from './migrator';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: url });
  try {
    const r = await migrate(pool, undefined, (m) => console.log(m));
    console.log(`migrations: ${r.applied.length} applied, ${r.skipped.length} already up to date`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
