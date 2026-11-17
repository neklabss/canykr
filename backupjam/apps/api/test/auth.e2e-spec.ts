import { bearer, createTestContext, lastMailTo, register, STRONG_PASSWORD, TestContext, uniqueEmail } from './helpers';

describe('auth (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestContext(); });
  afterAll(async () => { await ctx.close(); });

  describe('registration', () => {
    it('creates an account, records consents and sends a localized verification email', async () => {
      const email = uniqueEmail('reg');
      const res = await ctx.http().post('/v1/auth/register').set('Accept-Language', 'tr-TR,tr;q=0.9')
        .send({ email, password: STRONG_PASSWORD, displayName: 'Ayla', acceptTerms: true, capabilities: ['musician', 'band_member'], countryCode: 'DE' })
        .expect(201);
      expect(res.body.user).toMatchObject({ email, emailVerified: false, displayName: 'Ayla', capabilities: ['band_member', 'musician'] });
      // Language and market are independent: Turkish UI (auto), German market with EUR display currency.
      expect(res.body.user.preferences).toMatchObject({ locale: null, effectiveLocale: 'tr', countryCode: 'DE', currencyCode: 'EUR' });
      expect(res.body.tokens.refreshToken).toMatch(/^bujr_/);
      const mail = lastMailTo(ctx, email, 'verify_email');
      expect(mail.subject).toBe('BackUpJam e-posta adresini doğrula');
      expect(mail.text).toContain('http://localhost:3000/tr/verify-email?token=');
      const consents = await ctx.db.query(`SELECT consent_type, granted FROM consent_records WHERE user_id = $1 ORDER BY consent_type`, [res.body.user.id]);
      expect(consents).toEqual([
        { consent_type: 'marketing_email', granted: false },
        { consent_type: 'privacy', granted: true },
        { consent_type: 'terms', granted: true },
      ]);
    });

    it('rejects duplicate emails case-insensitively with a localized error', async () => {
      const { email } = await register(ctx);
      const res = await ctx.http().post('/v1/auth/register').set('Accept-Language', 'de')
        .send({ email: email.toUpperCase(), password: STRONG_PASSWORD, displayName: 'X', acceptTerms: true }).expect(409);
      expect(res.body.error).toEqual({ code: 'auth.email_taken', message: 'Mit dieser E-Mail existiert bereits ein Konto.' });
    });

    it.each([
      ['short', 'too_short'], ['password123', 'too_common'], ['aaaaaaaaaaaa', 'too_common'],
    ])('rejects weak password %p', async (password, problem) => {
      const res = await ctx.http().post('/v1/auth/register').send({ email: uniqueEmail(), password, displayName: 'X', acceptTerms: true }).expect(400);
      expect(res.body.error.code).toBe('auth.weak_password');
      expect(res.body.error.details.problems).toContain(problem);
    });

    it('requires terms acceptance and rejects unknown fields', async () => {
      await ctx.http().post('/v1/auth/register').send({ email: uniqueEmail(), password: STRONG_PASSWORD, displayName: 'X', acceptTerms: false }).expect(400);
      const res = await ctx.http().post('/v1/auth/register').send({ email: uniqueEmail(), password: STRONG_PASSWORD, displayName: 'X', acceptTerms: true, isAdmin: true }).expect(400);
      expect(res.body.error.code).toBe('validation_failed');
    });
  });

  describe('login & sessions', () => {
    it('returns the same error for wrong password and unknown email (no enumeration), localized', async () => {
      const { email } = await register(ctx);
      const a = await ctx.http().post('/v1/auth/login').set('Accept-Language', 'ar').send({ email, password: 'wrong password!!' }).expect(401);
      const b = await ctx.http().post('/v1/auth/login').set('Accept-Language', 'ar').send({ email: uniqueEmail(), password: 'wrong password!!' }).expect(401);
      expect(a.body.error).toEqual(b.body.error);
      expect(a.body.error).toEqual({ code: 'auth.invalid_credentials', message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    });

    it('requires a token on protected routes and rejects forged tokens', async () => {
      await ctx.http().get('/v1/me').expect(401);
      await ctx.http().get('/v1/me').set(bearer('eyJhbGciOiJIUzI1NiJ9.e30.invalid')).expect(401);
    });

    it('lists devices and revokes a specific session', async () => {
      const { email, access } = await register(ctx, { deviceName: 'Phone' });
      const second = await ctx.http().post('/v1/auth/login').send({ email, password: STRONG_PASSWORD, deviceName: 'Laptop' }).expect(200);
      const list = await ctx.http().get('/v1/auth/sessions').set(bearer(access)).expect(200);
      expect(list.body.map((s: { deviceName: string }) => s.deviceName).sort()).toEqual(['Laptop', 'Phone']);
      expect(list.body.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
      await ctx.http().delete(`/v1/auth/sessions/${second.body.tokens.sessionId}`).set(bearer(access)).expect(204);
      await ctx.http().get('/v1/me').set(bearer(second.body.tokens.accessToken)).expect(401);
      await ctx.http().get('/v1/me').set(bearer(access)).expect(200);
    });

    it('cannot revoke someone else’s session (object-level authorization)', async () => {
      const a = await register(ctx);
      const b = await register(ctx);
      await ctx.http().delete(`/v1/auth/sessions/${b.body.tokens.sessionId}`).set(bearer(a.access)).expect(404);
      await ctx.http().get('/v1/me').set(bearer(b.access)).expect(200);
    });

    it('logout revokes the session immediately', async () => {
      const { access } = await register(ctx);
      await ctx.http().post('/v1/auth/logout').set(bearer(access)).expect(204);
      await ctx.http().get('/v1/me').set(bearer(access)).expect(401);
    });
  });

  describe('refresh token rotation', () => {
    it('rotates tokens and revokes the session when an old token is replayed', async () => {
      const { refresh } = await register(ctx);
      const r1 = await ctx.http().post('/v1/auth/refresh').send({ refreshToken: refresh }).expect(200);
      expect(r1.body.refreshToken).not.toBe(refresh);
      await ctx.http().get('/v1/me').set(bearer(r1.body.accessToken)).expect(200);

      const replay = await ctx.http().post('/v1/auth/refresh').send({ refreshToken: refresh }).expect(401);
      expect(replay.body.error.code).toBe('auth.refresh_reused');
      // Whole session is dead: the newest tokens stop working too.
      await ctx.http().get('/v1/me').set(bearer(r1.body.accessToken)).expect(401);
      await ctx.http().post('/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
      const audit = await ctx.db.one(`SELECT 1 FROM audit_logs WHERE action = 'auth.refresh_reuse_detected' AND target_id = $1`, [r1.body.sessionId]);
      expect(audit).toBeDefined();
    });

    it('rejects unknown refresh tokens', async () => {
      await ctx.http().post('/v1/auth/refresh').send({ refreshToken: 'bujr_doesnotexist000000' }).expect(401);
    });
  });

  describe('email verification & password reset', () => {
    it('verifies email with a single-use token', async () => {
      const { email, access } = await register(ctx);
      const token = lastMailTo(ctx, email, 'verify_email').data.token;
      await ctx.http().post('/v1/auth/verify-email').send({ token }).expect(204);
      await ctx.http().post('/v1/auth/verify-email').send({ token }).expect(400);
      const me = await ctx.http().get('/v1/me').set(bearer(access)).expect(200);
      expect(me.body.emailVerified).toBe(true);
    });

    it('resend invalidates the previous verification token', async () => {
      const { email, access } = await register(ctx);
      const first = lastMailTo(ctx, email, 'verify_email').data.token;
      await ctx.http().post('/v1/auth/verify-email/resend').set(bearer(access)).expect(202);
      const second = lastMailTo(ctx, email, 'verify_email').data.token;
      expect(second).not.toBe(first);
      await ctx.http().post('/v1/auth/verify-email').send({ token: first }).expect(400);
      await ctx.http().post('/v1/auth/verify-email').send({ token: second }).expect(204);
    });

    it('forgot-password always answers 202; reset signs out every device', async () => {
      await ctx.http().post('/v1/auth/password/forgot').send({ email: uniqueEmail('nobody') }).expect(202);
      const { email, access } = await register(ctx);
      await ctx.http().post('/v1/auth/password/forgot').send({ email }).expect(202);
      const token = lastMailTo(ctx, email, 'reset_password').data.token;
      await ctx.http().post('/v1/auth/password/reset').send({ token, newPassword: 'short' }).expect(400);
      // The failed attempt rolled back, so the token is still usable.
      await ctx.http().post('/v1/auth/password/reset').send({ token, newPassword: 'a brand new long passphrase' }).expect(204);
      await ctx.http().get('/v1/me').set(bearer(access)).expect(401);
      await ctx.http().post('/v1/auth/login').send({ email, password: STRONG_PASSWORD }).expect(401);
      await ctx.http().post('/v1/auth/login').send({ email, password: 'a brand new long passphrase' }).expect(200);
      await ctx.http().post('/v1/auth/password/reset').send({ token, newPassword: 'another long passphrase' }).expect(400);
    });
  });

  describe('account deletion', () => {
    it('requires the password, revokes sessions, and a later sign-in cancels the request', async () => {
      const { email, access, userId } = await register(ctx);
      await ctx.http().delete('/v1/me').set(bearer(access)).send({ password: 'wrong wrong wrong' }).expect(401);
      const res = await ctx.http().delete('/v1/me').set(bearer(access)).send({ password: STRONG_PASSWORD }).expect(202);
      expect(res.body.status).toBe('pending_deletion');
      await ctx.http().get('/v1/me').set(bearer(access)).expect(401);
      const login = await ctx.http().post('/v1/auth/login').send({ email, password: STRONG_PASSWORD }).expect(200);
      expect(login.body.user.status).toBe('active');
      const audit = await ctx.db.query(`SELECT action FROM audit_logs WHERE target_id = $1 AND action LIKE 'user.deletion%' ORDER BY id`, [userId]);
      expect(audit.map((a) => a.action)).toEqual(['user.deletion_requested', 'user.deletion_cancelled']);
    });
  });
});
