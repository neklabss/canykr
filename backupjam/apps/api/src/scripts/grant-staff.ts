/**
 * Bootstrap the first platform staff member (subsequent grants go through the admin API + audit log).
 * Usage: pnpm --filter @backupjam/api staff:grant <email> <role>
 */
import { Pool } from 'pg';
import { STAFF_ROLES } from '@backupjam/api-contract';

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role || !(STAFF_ROLES as readonly string[]).includes(role)) {
    throw new Error(`usage: staff:grant <email> <${STAFF_ROLES.join('|')}>`);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const u = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (!u.rows[0]) throw new Error(`no user with email ${email}`);
    await pool.query(`INSERT INTO staff_members (user_id, role) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, revoked_at = NULL`, [u.rows[0].id, role]);
    await pool.query(`INSERT INTO audit_logs (actor_type, action, target_type, target_id, metadata) VALUES ('system','admin.staff_granted','user',$1,$2)`, [u.rows[0].id, { role, via: 'cli' }]);
    console.log(`granted ${role} to ${email}`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
