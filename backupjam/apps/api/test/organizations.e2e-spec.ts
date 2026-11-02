import { bearer, createTestContext, register, registerVerified, TestContext } from './helpers';

const slug = () => `band-${Math.random().toString(36).slice(2, 10)}`;

describe('organizations & memberships (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestContext(); });
  afterAll(async () => { await ctx.close(); });

  async function createBand(access: string) {
    const r = await ctx.http().post('/v1/organizations').set(bearer(access)).send({ type: 'band', name: 'The Backups', slug: slug(), countryCode: 'TR', city: 'Istanbul' }).expect(201);
    return r.body as { id: string; slug: string; myRole: string };
  }

  it('requires a verified email to create an organization', async () => {
    const u = await register(ctx);
    const r = await ctx.http().post('/v1/organizations').set(bearer(u.access)).send({ type: 'venue', name: 'Club', slug: slug() }).expect(403);
    expect(r.body.error.details.reason).toBe('email_verification_required');
  });

  it('one account can own a band and a venue; slugs are unique', async () => {
    const owner = await registerVerified(ctx);
    const band = await createBand(owner.access);
    expect(band.myRole).toBe('owner');
    await ctx.http().post('/v1/organizations').set(bearer(owner.access)).send({ type: 'venue', name: 'Moda Stage', slug: `venue-${band.slug}` }).expect(201);
    await ctx.http().post('/v1/organizations').set(bearer(owner.access)).send({ type: 'band', name: 'Dup', slug: band.slug }).expect(409);
    const mine = await ctx.http().get('/v1/organizations/mine').set(bearer(owner.access)).expect(200);
    expect(mine.body.map((o: { type: string }) => o.type).sort()).toEqual(['band', 'venue']);
    const pub = await ctx.http().get(`/v1/organizations/by-slug/${band.slug}`).expect(200);
    expect(pub.body.myRole).toBeUndefined();
  });

  it('invitation requires explicit acceptance; permissions follow the role matrix', async () => {
    const owner = await registerVerified(ctx);
    const drummer = await register(ctx);
    const outsider = await register(ctx);
    const band = await createBand(owner.access);

    await ctx.http().post(`/v1/organizations/${band.id}/members`).set(bearer(owner.access)).send({ email: drummer.email, role: 'member', title: 'Drummer' }).expect(201);
    // Invited but not yet accepted → still an outsider.
    await ctx.http().get(`/v1/organizations/${band.id}/members`).set(bearer(drummer.access)).expect(404);
    const inv = await ctx.http().get('/v1/organizations/invitations').set(bearer(drummer.access)).expect(200);
    expect(inv.body.map((o: { id: string }) => o.id)).toEqual([band.id]);
    await ctx.http().post(`/v1/organizations/${band.id}/invitation/accept`).set(bearer(drummer.access)).expect(204);
    const members = await ctx.http().get(`/v1/organizations/${band.id}/members`).set(bearer(drummer.access)).expect(200);
    expect(members.body.map((m: { role: string }) => m.role)).toEqual(['owner', 'member']);

    // member lacks org.members.manage / org.profile.edit
    const denied = await ctx.http().post(`/v1/organizations/${band.id}/members`).set(bearer(drummer.access)).send({ email: outsider.email, role: 'member' }).expect(403);
    expect(denied.body.error.details.required).toBe('org.members.manage');
    await ctx.http().patch(`/v1/organizations/${band.id}`).set(bearer(drummer.access)).send({ name: 'Hijacked' }).expect(403);
    // non-members get 404, not 403
    await ctx.http().get(`/v1/organizations/${band.id}/members`).set(bearer(outsider.access)).expect(404);
    await ctx.http().patch(`/v1/organizations/${band.id}`).set(bearer(outsider.access)).send({ name: 'Hijacked' }).expect(404);
  });

  it('admins manage members but cannot touch owner/admin roles; last owner cannot leave', async () => {
    const owner = await registerVerified(ctx);
    const admin = await register(ctx);
    const member = await register(ctx);
    const band = await createBand(owner.access);
    for (const [u, role] of [[admin, 'admin'], [member, 'member']] as const) {
      await ctx.http().post(`/v1/organizations/${band.id}/members`).set(bearer(owner.access)).send({ email: u.email, role }).expect(201);
      await ctx.http().post(`/v1/organizations/${band.id}/invitation/accept`).set(bearer(u.access)).expect(204);
    }
    await ctx.http().patch(`/v1/organizations/${band.id}/members/${member.userId}`).set(bearer(admin.access)).send({ role: 'manager' }).expect(200);
    await ctx.http().patch(`/v1/organizations/${band.id}/members/${member.userId}`).set(bearer(admin.access)).send({ role: 'owner' }).expect(403);
    await ctx.http().patch(`/v1/organizations/${band.id}/members/${owner.userId}`).set(bearer(admin.access)).send({ role: 'member' }).expect(403);
    await ctx.http().delete(`/v1/organizations/${band.id}/members/${owner.userId}`).set(bearer(admin.access)).expect(403);

    const leave = await ctx.http().delete(`/v1/organizations/${band.id}/members/${owner.userId}`).set(bearer(owner.access)).expect(409);
    expect(leave.body.error.details.reason).toBe('organization_requires_owner');
    await ctx.http().patch(`/v1/organizations/${band.id}/members/${owner.userId}`).set(bearer(owner.access)).send({ role: 'admin' }).expect(409);

    // Transfer: promote, then the old owner can leave.
    await ctx.http().patch(`/v1/organizations/${band.id}/members/${admin.userId}`).set(bearer(owner.access)).send({ role: 'owner' }).expect(200);
    await ctx.http().delete(`/v1/organizations/${band.id}/members/${owner.userId}`).set(bearer(owner.access)).expect(204);
    const roles = await ctx.db.query(`SELECT role FROM organization_memberships WHERE organization_id = $1 ORDER BY role`, [band.id]);
    expect(roles.map((r) => r.role)).toEqual(['manager', 'owner']);
  });
});
