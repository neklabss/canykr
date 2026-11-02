import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, JWK } from 'jose';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { loadEnv } from '../src/config/env';
import { Db } from '../src/database/db';
import { OIDC_KEYS } from '../src/modules/auth/oidc';
import { ConsoleMockMailer, MAILER } from '../src/modules/mail/mailer';

export interface TestContext {
  app: NestExpressApplication;
  http: () => ReturnType<typeof request>;
  db: Db;
  mailer: ConsoleMockMailer;
  signIdToken: (provider: 'google' | 'apple', claims: Record<string, unknown>) => Promise<string>;
  close: () => Promise<void>;
}

export async function createTestContext(envOverrides: Record<string, string> = {}): Promise<TestContext> {
  const env = loadEnv({ ...process.env, ...envOverrides });
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const keys = createLocalJWKSet({ keys: [jwk] });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(env)] })
    .overrideProvider(OIDC_KEYS)
    .useValue({ google: keys, apple: keys })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, bufferLogs: true });
  configureApp(app, env);
  await app.init();

  const issuers = { google: 'https://accounts.google.com', apple: 'https://appleid.apple.com' };
  const audiences = { google: env.GOOGLE_CLIENT_IDS[0]!, apple: env.APPLE_CLIENT_IDS[0]! };
  return {
    app,
    http: () => request(app.getHttpServer()),
    db: app.get(Db),
    mailer: app.get(MAILER),
    signIdToken: (provider, claims) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuers[provider])
        .setAudience(audiences[provider])
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey),
    close: () => app.close(),
  };
}

export const uniqueEmail = (tag = 'user') => `${tag}.${randomUUID().slice(0, 8)}@example.com`;
export const STRONG_PASSWORD = 'correct horse battery staple';

export async function register(ctx: TestContext, overrides: Record<string, unknown> = {}) {
  const email = (overrides.email as string) ?? uniqueEmail();
  const res = await ctx.http()
    .post('/v1/auth/register')
    .send({ email, password: STRONG_PASSWORD, displayName: 'Test Musician', acceptTerms: true, ...overrides })
    .expect(201);
  return { email, userId: res.body.user.id as string, access: res.body.tokens.accessToken as string, refresh: res.body.tokens.refreshToken as string, body: res.body };
}

export function lastMailTo(ctx: TestContext, email: string, template: 'verify_email' | 'reset_password') {
  const m = [...ctx.mailer.outbox].reverse().find((x) => x.to === email && x.template === template);
  if (!m) throw new Error(`no ${template} mail for ${email}`);
  return m;
}

export async function registerVerified(ctx: TestContext, overrides: Record<string, unknown> = {}) {
  const u = await register(ctx, overrides);
  await ctx.http().post('/v1/auth/verify-email').send({ token: lastMailTo(ctx, u.email, 'verify_email').data.token }).expect(204);
  return u;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
