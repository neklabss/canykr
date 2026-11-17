/** Writes the OpenAPI document to packages/api-contract/openapi.json (shared contract for web/admin/mobile). */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '../config/env';
import { buildOpenApi, createApp } from '../app.factory';

async function main() {
  const env = loadEnv({ ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://unused/unused', JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'x'.repeat(48), LOG_LEVEL: 'silent' });
  const app = await createApp(env);
  const doc = buildOpenApi(app);
  const out = join(__dirname, '..', '..', '..', '..', 'packages', 'api-contract', 'openapi.json');
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  await app.close();
  console.log(`OpenAPI written to ${out} (${Object.keys(doc.paths).length} paths)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
