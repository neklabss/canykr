import { bearer, createTestContext, register, TestContext } from './helpers';

describe('preferences, onboarding & i18n (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestContext(); });
  afterAll(async () => { await ctx.close(); });

  it('manual locale overrides device language and persists; null returns to automatic', async () => {
    const { access } = await register(ctx);
    const set = await ctx.http().put('/v1/me/preferences').set(bearer(access)).set('Accept-Language', 'de-DE')
      .send({ locale: 'tr', countryCode: 'DE', currencyCode: 'EUR', timeZone: 'Europe/Berlin', theme: 'dark', quietHoursStart: '22:00', quietHoursEnd: '08:00' })
      .expect(200);
    expect(set.body.preferences).toEqual({ locale: 'tr', effectiveLocale: 'tr', countryCode: 'DE', currencyCode: 'EUR', timeZone: 'Europe/Berlin', theme: 'dark', quietHoursStart: '22:00', quietHoursEnd: '08:00' });
    // Errors follow the stored preference, not the browser header.
    const err = await ctx.http().put('/v1/me/preferences').set(bearer(access)).set('Accept-Language', 'de-DE').send({ timeZone: 'Mars/Olympus' }).expect(400);
    expect(err.body.error.message).toBe('Lütfen işaretli alanları kontrol et.');
    const auto = await ctx.http().put('/v1/me/preferences').set(bearer(access)).set('Accept-Language', 'ja-JP').send({ locale: null }).expect(200);
    expect(auto.body.preferences).toMatchObject({ locale: null, effectiveLocale: 'ja' });
  });

  it('normalises locale aliases and rejects unsupported locales', async () => {
    const { access } = await register(ctx);
    const r = await ctx.http().put('/v1/me/preferences').set(bearer(access)).send({ locale: 'zh-TW' }).expect(200);
    expect(r.body.preferences.locale).toBe('zh-Hant');
    await ctx.http().put('/v1/me/preferences').set(bearer(access)).send({ locale: 'tlh' }).expect(400);
    await ctx.http().put('/v1/me/preferences').set(bearer(access)).send({ quietHoursStart: '22:00' }).expect(400);
    await ctx.http().put('/v1/me/preferences').set(bearer(access)).send({ countryCode: 'ZZ' }).expect(400);
  });

  it('saves partial onboarding answers, including skips and a PostGIS location', async () => {
    const { access } = await register(ctx);
    await ctx.http().put('/v1/me/onboarding').set(bearer(access)).send({ instruments: ['drums', 'percussion'], skippedSteps: ['genres'] }).expect(200);
    const r = await ctx.http().put('/v1/me/onboarding').set(bearer(access))
      .send({ capabilities: ['musician'], homeCountryCode: 'TR', homeCity: 'İzmir', location: { lat: 38.4237, lng: 27.1428 }, availableForBookings: true, discoverGoals: ['jobs', 'venues'], languages: ['tr', 'en'], travelCountryCodes: ['DE', 'NL'], travelRadiusKm: 150, complete: true })
      .expect(200);
    expect(r.body).toMatchObject({
      capabilities: ['musician'], instruments: ['drums', 'percussion'], genres: [], homeCity: 'İzmir', availableForBookings: true,
      discoverGoals: ['jobs', 'venues'], languages: ['en', 'tr'], travelCountryCodes: ['DE', 'NL'], travelRadiusKm: 150, skippedSteps: ['genres'],
    });
    expect(r.body.location.lat).toBeCloseTo(38.4237, 4);
    expect(r.body.completedAt).not.toBeNull();
    await ctx.http().put('/v1/me/onboarding').set(bearer(access)).send({ instruments: ['kazoo_of_doom'] }).expect(400);
    await ctx.http().put('/v1/me/onboarding').set(bearer(access)).send({ location: { lat: 200, lng: 0 } }).expect(400);
  });

  it('records consent changes append-only and returns the latest state', async () => {
    const { access, userId } = await register(ctx);
    await ctx.http().post('/v1/me/consents').set(bearer(access)).send({ consentType: 'marketing_email', granted: true }).expect(201);
    const r = await ctx.http().post('/v1/me/consents').set(bearer(access)).send({ consentType: 'marketing_email', granted: false }).expect(201);
    expect(r.body.find((c: { consentType: string }) => c.consentType === 'marketing_email').granted).toBe(false);
    await expect(ctx.db.query(`UPDATE consent_records SET granted = true WHERE user_id = $1`, [userId])).rejects.toThrow(/append-only/);
  });

  describe('i18n & reference endpoints', () => {
    it('lists 16 locales with RTL info and completeness status', async () => {
      const r = await ctx.http().get('/v1/i18n/locales').expect(200);
      expect(r.body).toHaveLength(16);
      expect(r.body.find((l: { tag: string }) => l.tag === 'ar')).toMatchObject({ dir: 'rtl', status: 'machine_draft' });
    });

    it.each([['zh-TW,zh;q=0.8', 'zh-Hant'], ['sw-KE', 'en'], ['pt-PT', 'pt-BR'], ['ar-EG', 'ar']])('negotiates %s → %s', async (header, expected) => {
      const r = await ctx.http().get('/v1/i18n/negotiate').set('Accept-Language', header).expect(200);
      expect(r.body.locale).toBe(expected);
    });

    it('serves message catalogs with ETag / 304 and English fallback for unknown locales', async () => {
      const r = await ctx.http().get('/v1/i18n/messages/ar').expect(200);
      expect(r.body).toMatchObject({ locale: 'ar', dir: 'rtl' });
      expect(r.body.messages['nav.discover']).toBe('استكشاف');
      await ctx.http().get('/v1/i18n/messages/ar').set('If-None-Match', r.headers.etag).expect(304);
      const fb = await ctx.http().get('/v1/i18n/messages/xx').expect(200);
      expect(fb.body.locale).toBe('en');
    });

    it('localizes country and currency names without hard-coded strings', async () => {
      const tr = await ctx.http().get('/v1/reference/countries').set('Accept-Language', 'tr').expect(200);
      expect(tr.body.find((c: { code: string }) => c.code === 'DE').name).toBe('Almanya');
      const ja = await ctx.http().get('/v1/reference/currencies').set('Accept-Language', 'ja').expect(200);
      expect(ja.body.find((c: { code: string }) => c.code === 'JPY')).toMatchObject({ exponent: 0, name: '日本円' });
      const inst = await ctx.http().get('/v1/reference/instruments').expect(200);
      expect(inst.body.find((i: { slug: string }) => i.slug === 'baglama')).toMatchObject({ nameKey: 'instrument.baglama' });
    });

    it('exposes feature flags; launch countries start hidden with payments disabled', async () => {
      const flags = await ctx.http().get('/v1/reference/feature-flags?country=TR').expect(200);
      expect(flags.body['payments.bookings']).toBe(false);
      const countries = await ctx.db.query(`SELECT count(*)::int AS n FROM countries WHERE launch_status <> 'hidden' OR payments_enabled`);
      expect(countries[0].n).toBe(0);
    });
  });

  it('health endpoints report readiness', async () => {
    await ctx.http().get('/health/live').expect(200);
    const r = await ctx.http().get('/health/ready').expect(200);
    expect(r.body.checks.database).toBe('ok');
    expect(r.headers['x-request-id']).toBeDefined();
  });
});
