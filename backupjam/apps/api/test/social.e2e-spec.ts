import { createHash, randomUUID } from 'node:crypto';
import { bearer, createTestContext, register, registerVerified, TestContext, uniqueEmail } from './helpers';

describe('social login (e2e, local JWKS standing in for Google/Apple)', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestContext(); });
  afterAll(async () => { await ctx.close(); });

  it('signs up a new user with Google, then signs in again with the same subject', async () => {
    const sub = randomUUID();
    const email = uniqueEmail('g');
    const idToken = await ctx.signIdToken('google', { sub, email, email_verified: true });
    await ctx.http().post('/v1/auth/oauth/google').send({ idToken }).expect(400); // terms not accepted
    const first = await ctx.http().post('/v1/auth/oauth/google').send({ idToken, acceptTerms: true, displayName: 'Gigi' }).expect(200);
    expect(first.body.isNewUser).toBe(true);
    expect(first.body.user).toMatchObject({ email, emailVerified: true, displayName: 'Gigi' });
    const again = await ctx.http().post('/v1/auth/oauth/google').send({ idToken: await ctx.signIdToken('google', { sub, email, email_verified: true }) }).expect(200);
    expect(again.body.isNewUser).toBe(false);
    expect(again.body.user.id).toBe(first.body.user.id);
  });

  it('links Google to an existing verified email account', async () => {
    const u = await registerVerified(ctx);
    const res = await ctx.http().post('/v1/auth/oauth/google').send({ idToken: await ctx.signIdToken('google', { sub: randomUUID(), email: u.email, email_verified: true }) }).expect(200);
    expect(res.body.user.id).toBe(u.userId);
    expect(res.body.isNewUser).toBe(false);
  });

  it('refuses to link when the local account email is unverified (pre-hijack protection)', async () => {
    const u = await register(ctx);
    const res = await ctx.http().post('/v1/auth/oauth/google').send({ idToken: await ctx.signIdToken('google', { sub: randomUUID(), email: u.email, email_verified: true }), acceptTerms: true }).expect(409);
    expect(res.body.error.code).toBe('auth.identity_conflict');
  });

  it('rejects tokens with the wrong audience/issuer or bad signature', async () => {
    const forged = (await ctx.signIdToken('google', { sub: 'x' })).slice(0, -4) + 'AAAA';
    await ctx.http().post('/v1/auth/oauth/google').send({ idToken: forged, acceptTerms: true }).expect(401);
    const appleTokenAtGoogle = await ctx.signIdToken('apple', { sub: 'x' });
    await ctx.http().post('/v1/auth/oauth/google').send({ idToken: appleTokenAtGoogle, acceptTerms: true }).expect(401);
  });

  it('verifies the Apple nonce (hashed form) and supports hidden emails', async () => {
    const nonce = randomUUID();
    const hashed = createHash('sha256').update(nonce).digest('hex');
    const sub = `apple.${randomUUID()}`;
    const token = await ctx.signIdToken('apple', { sub, nonce: hashed, email: 'abc@privaterelay.appleid.com', email_verified: 'true' });
    await ctx.http().post('/v1/auth/oauth/apple').send({ idToken: token, nonce: 'wrong', acceptTerms: true }).expect(401);
    const ok = await ctx.http().post('/v1/auth/oauth/apple').send({ idToken: token, nonce, acceptTerms: true, displayName: 'Ana', locale: 'pt-BR' }).expect(200);
    expect(ok.body.user.preferences).toMatchObject({ locale: 'pt-BR', effectiveLocale: 'pt-BR' });
    await ctx.http().get('/v1/me').set(bearer(ok.body.tokens.accessToken)).expect(200);
  });
});
