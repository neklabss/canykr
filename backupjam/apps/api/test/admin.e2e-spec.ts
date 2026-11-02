import { bearer, createTestContext, register, STRONG_PASSWORD, TestContext } from './helpers';

describe('admin API (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestContext(); });
  afterAll(async () => { await ctx.close(); });

  const grant = (userId: string, role: string) => ctx.db.query(`INSERT INTO staff_members (user_id, role) VALUES ($1,$2)`, [userId, role]);

  it('hides the admin surface from non-staff (404)', async () => {
    const u = await register(ctx);
    await ctx.http().get('/v1/admin/overview').set(bearer(u.access)).expect(404);
    await ctx.http().get('/v1/admin/overview').expect(401);
  });

  it('enforces staff permissions per role', async () => {
    const support = await register(ctx);
    await grant(support.userId, 'support');
    const target = await register(ctx);
    const list = await ctx.http().get(`/v1/admin/users?q=${encodeURIComponent(target.email)}`).set(bearer(support.access)).expect(200);
    expect(list.body.items.map((u: { id: string }) => u.id)).toEqual([target.userId]);
    const r = await ctx.http().post(`/v1/admin/users/${target.userId}/suspend`).set(bearer(support.access)).send({ reason: 'spam' }).expect(403);
    expect(r.body.error.details.required).toBe('admin.users.suspend');
    await ctx.http().get('/v1/admin/audit-logs').set(bearer(support.access)).expect(403);
  });

  it('suspension revokes sessions, blocks login, and is audited', async () => {
    const ts = await register(ctx);
    await grant(ts.userId, 'trust_safety');
    const target = await register(ctx);
    await ctx.http().post(`/v1/admin/users/${target.userId}/suspend`).set(bearer(ts.access)).send({ reason: 'Impersonating an official artist' }).expect(204);
    await ctx.http().get('/v1/me').set(bearer(target.access)).expect(401);
    const login = await ctx.http().post('/v1/auth/login').send({ email: target.email, password: STRONG_PASSWORD }).expect(403);
    expect(login.body.error.code).toBe('auth.account_suspended');
    await ctx.http().post(`/v1/admin/users/${ts.userId}/suspend`).set(bearer(ts.access)).send({ reason: 'self' }).expect(403);

    const logs = await ctx.http().get(`/v1/admin/audit-logs?action=admin.user_suspended&targetId=${target.userId}`).set(bearer(ts.access)).expect(200);
    expect(logs.body).toHaveLength(1);
    expect(logs.body[0]).toMatchObject({ actorUserId: ts.userId, actorType: 'staff', metadata: { reason: 'Impersonating an official artist' } });

    await ctx.http().post(`/v1/admin/users/${target.userId}/unsuspend`).set(bearer(ts.access)).expect(204);
    await ctx.http().post('/v1/auth/login').send({ email: target.email, password: STRONG_PASSWORD }).expect(200);
  });

  it('paginates users with an opaque cursor', async () => {
    const sa = await register(ctx);
    await grant(sa.userId, 'super_admin');
    for (let i = 0; i < 3; i++) await register(ctx);
    const p1 = await ctx.http().get('/v1/admin/users?limit=2').set(bearer(sa.access)).expect(200);
    expect(p1.body.items).toHaveLength(2);
    const p2 = await ctx.http().get(`/v1/admin/users?limit=2&cursor=${p1.body.nextCursor}`).set(bearer(sa.access)).expect(200);
    expect(p2.body.items[0].id).not.toBe(p1.body.items[1].id);
    await ctx.http().get('/v1/admin/users?cursor=garbage').set(bearer(sa.access)).expect(400);
  });

  it('country payments cannot be enabled without a contracted provider (DB constraint)', async () => {
    const sa = await register(ctx);
    await grant(sa.userId, 'super_admin');
    await ctx.http().patch('/v1/admin/countries/TR').set(bearer(sa.access)).send({ paymentsEnabled: true }).expect(400);
    await ctx.http().patch('/v1/admin/countries/TR').set(bearer(sa.access)).send({ launchStatus: 'beta' }).expect(200);
    const flag = await ctx.http().put('/v1/admin/feature-flags/marketplace.jobs').set(bearer(sa.access)).send({ enabled: true, rules: { countries: ['TR'] } }).expect(200);
    expect(flag.body.enabled).toBe(true);
    const tr = await ctx.http().get('/v1/reference/feature-flags?country=TR').expect(200);
    const de = await ctx.http().get('/v1/reference/feature-flags?country=DE').expect(200);
    expect([tr.body['marketplace.jobs'], de.body['marketplace.jobs']]).toEqual([true, false]);
    await ctx.http().patch('/v1/admin/countries/TR').set(bearer(sa.access)).send({ launchStatus: 'hidden' }).expect(200);
    await ctx.http().put('/v1/admin/feature-flags/marketplace.jobs').set(bearer(sa.access)).send({ enabled: false, rules: {} }).expect(200);
  });

  it('audit log is append-only at the database level', async () => {
    await expect(ctx.db.query(`UPDATE audit_logs SET action = 'tampered'`)).rejects.toThrow(/append-only/);
    await expect(ctx.db.query(`DELETE FROM audit_logs`)).rejects.toThrow(/append-only/);
  });
});
