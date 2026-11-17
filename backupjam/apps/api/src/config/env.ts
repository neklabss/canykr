import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

const bool = z
  .string()
  .default('false')
  .transform((s) => s === 'true' || s === '1');

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: csv,
  APP_WEB_URL: z.string().url().default('http://localhost:3000'),
  TRUST_PROXY: bool,
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().default('https://api.backupjam.local'),
  JWT_AUDIENCE: z.string().default('backupjam-api'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),
  GOOGLE_CLIENT_IDS: csv,
  APPLE_CLIENT_IDS: csv,
  MAIL_DRIVER: z.enum(['console']).default('console'),
  MAIL_FROM: z.string().default('BackUpJam <no-reply@backupjam.local>'),
  TERMS_VERSION: z.string().default('2026-11-01'),
  PRIVACY_VERSION: z.string().default('2026-11-01'),
  RATE_LIMIT_DEFAULT: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_AUTH: z.coerce.number().int().min(1).default(10),
  PASSWORD_SCRYPT_LOG_N: z.coerce.number().int().min(10).max(20).default(15),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (env.JWT_ACCESS_SECRET.includes('change-me')) throw new Error('Refusing to start: default JWT secret in production');
    if (env.PASSWORD_SCRYPT_LOG_N < 15) throw new Error('Refusing to start: weak scrypt cost in production');
  }
  return env;
}

export const ENV = Symbol('ENV');
