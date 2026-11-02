import { HttpStatus, Injectable } from '@nestjs/common';
import { MembershipDto, OrgPermission, OrgRole, OrganizationDto, orgRoleHas } from '@backupjam/api-contract';
import { Db, Queryable } from '../../database/db';
import { AppError } from '../../common/app-error';
import { AuditService } from '../audit/audit.service';
import type { ClientMeta } from '../auth/auth.service';
import type { CreateOrganizationDto, InviteMemberDto, UpdateOrganizationDto } from './organizations.dto';

interface OrgRow { id: string; type: OrganizationDto['type']; name: string; slug: string; country_code: string | null; city: string | null; status: 'active' | 'suspended'; created_at: Date; my_role?: OrgRole | null }

const toDto = (r: OrgRow): OrganizationDto => ({
  id: r.id, type: r.type, name: r.name, slug: r.slug, countryCode: r.country_code, city: r.city, status: r.status, createdAt: r.created_at.toISOString(),
  ...(r.my_role !== undefined ? { myRole: r.my_role } : {}),
});

const ELEVATED: ReadonlySet<OrgRole> = new Set(['owner', 'admin']);

@Injectable()
export class OrganizationsService {
  constructor(private readonly db: Db, private readonly audit: AuditService) {}

  /**
   * Object-level authorization. Non-members get 404 (no existence leak); members lacking the
   * permission get 403.
   */
  async authorize(orgId: string, userId: string, permission: OrgPermission | null, client?: Queryable): Promise<OrgRole> {
    const m = await this.db.one<{ role: OrgRole }>(
      `SELECT m.role FROM organization_memberships m JOIN organizations o ON o.id = m.organization_id
        WHERE m.organization_id = $1 AND m.user_id = $2 AND m.status = 'active' AND o.status = 'active'`,
      [orgId, userId],
      client,
    );
    if (!m) throw AppError.notFound();
    if (permission && !orgRoleHas(m.role, permission)) throw AppError.forbidden({ required: permission });
    return m.role;
  }

  async create(userId: string, dto: CreateOrganizationDto, meta: ClientMeta): Promise<OrganizationDto> {
    const verified = await this.db.one(`SELECT 1 FROM users WHERE id = $1 AND email_verified_at IS NOT NULL`, [userId]);
    if (!verified) throw AppError.forbidden({ reason: 'email_verification_required' });
    return this.db.tx(async (c) => {
      const taken = await this.db.one(`SELECT 1 FROM organizations WHERE slug = $1`, [dto.slug], c);
      if (taken) throw AppError.conflict('conflict', { field: 'slug', problem: 'taken' });
      const org = await this.db.one<OrgRow>(
        `INSERT INTO organizations (type, name, slug, country_code, city, created_by) VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, type, name, slug, country_code, city, status, created_at`,
        [dto.type, dto.name.trim(), dto.slug, dto.countryCode ?? null, dto.city ?? null, userId],
        c,
      );
      await this.db.query(`INSERT INTO organization_memberships (organization_id, user_id, role, status) VALUES ($1,$2,'owner','active')`, [org!.id, userId], c);
      await this.audit.record({ actorUserId: userId, actorType: 'user', action: 'org.created', targetType: 'organization', targetId: org!.id, metadata: { type: dto.type }, ip: meta.ip, requestId: meta.requestId }, c);
      return toDto({ ...org!, my_role: 'owner' });
    });
  }

  async mine(userId: string): Promise<OrganizationDto[]> {
    const rows = await this.db.query<OrgRow>(
      `SELECT o.id, o.type, o.name, o.slug, o.country_code, o.city, o.status, o.created_at, m.role AS my_role
         FROM organizations o JOIN organization_memberships m ON m.organization_id = o.id
        WHERE m.user_id = $1 AND m.status = 'active' ORDER BY o.created_at DESC`,
      [userId],
    );
    return rows.map(toDto);
  }

  async invitations(userId: string): Promise<OrganizationDto[]> {
    const rows = await this.db.query<OrgRow>(
      `SELECT o.id, o.type, o.name, o.slug, o.country_code, o.city, o.status, o.created_at, m.role AS my_role
         FROM organizations o JOIN organization_memberships m ON m.organization_id = o.id
        WHERE m.user_id = $1 AND m.status = 'invited' AND o.status = 'active' ORDER BY m.created_at DESC`,
      [userId],
    );
    return rows.map(toDto);
  }

  async publicBySlug(slug: string): Promise<OrganizationDto> {
    const r = await this.db.one<OrgRow>(
      `SELECT id, type, name, slug, country_code, city, status, created_at FROM organizations WHERE slug = $1 AND status = 'active'`,
      [slug],
    );
    if (!r) throw AppError.notFound();
    return toDto(r);
  }

  async update(orgId: string, userId: string, dto: UpdateOrganizationDto, meta: ClientMeta): Promise<OrganizationDto> {
    const role = await this.authorize(orgId, userId, 'org.profile.edit');
    const r = await this.db.one<OrgRow>(
      `UPDATE organizations SET name = COALESCE($2, name), country_code = COALESCE($3, country_code), city = COALESCE($4, city)
        WHERE id = $1 RETURNING id, type, name, slug, country_code, city, status, created_at`,
      [orgId, dto.name?.trim() ?? null, dto.countryCode ?? null, dto.city ?? null],
    );
    await this.audit.record({ actorUserId: userId, actorType: 'user', action: 'org.updated', targetType: 'organization', targetId: orgId, metadata: { fields: Object.keys(dto) }, ip: meta.ip, requestId: meta.requestId });
    return toDto({ ...r!, my_role: role });
  }

  async members(orgId: string, userId: string): Promise<MembershipDto[]> {
    await this.authorize(orgId, userId, null);
    const rows = await this.db.query<{ user_id: string; display_name: string; role: OrgRole; status: 'invited' | 'active'; created_at: Date }>(
      `SELECT m.user_id, u.display_name, m.role, m.status, m.created_at FROM organization_memberships m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = $1 ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END, m.created_at`,
      [orgId],
    );
    return rows.map((r) => ({ userId: r.user_id, displayName: r.display_name, role: r.role, status: r.status, createdAt: r.created_at.toISOString() }));
  }

  private assertCanAssign(actorRole: OrgRole, targetRole: OrgRole, currentRole?: OrgRole) {
    if (!orgRoleHas(actorRole, 'org.members.manage')) throw AppError.forbidden({ required: 'org.members.manage' });
    const touchesElevated = ELEVATED.has(targetRole) || (currentRole !== undefined && ELEVATED.has(currentRole));
    if (touchesElevated && !orgRoleHas(actorRole, 'org.roles.assign_admin')) throw AppError.forbidden({ required: 'org.roles.assign_admin' });
  }

  /** Invites an existing account. Membership stays 'invited' until the invitee accepts (explicit consent). */
  async invite(orgId: string, actorId: string, dto: InviteMemberDto, meta: ClientMeta): Promise<MembershipDto[]> {
    const actorRole = await this.authorize(orgId, actorId, 'org.members.manage');
    this.assertCanAssign(actorRole, dto.role);
    const invitee = await this.db.one<{ id: string }>(`SELECT id FROM users WHERE email = $1 AND status = 'active'`, [dto.email.toLowerCase()]);
    // Unknown emails get the same response shape; email invitations to non-users arrive with the notifications module.
    if (invitee) {
      await this.db.query(
        `INSERT INTO organization_memberships (organization_id, user_id, role, status, title, invited_by) VALUES ($1,$2,$3,'invited',$4,$5)
         ON CONFLICT (organization_id, user_id) DO NOTHING`,
        [orgId, invitee.id, dto.role, dto.title ?? null, actorId],
      );
      await this.audit.record({ actorUserId: actorId, actorType: 'user', action: 'org.member_invited', targetType: 'organization', targetId: orgId, metadata: { inviteeId: invitee.id, role: dto.role }, ip: meta.ip, requestId: meta.requestId });
    }
    return this.members(orgId, actorId);
  }

  async respondToInvitation(orgId: string, userId: string, accept: boolean, meta: ClientMeta): Promise<void> {
    const r = accept
      ? await this.db.one(`UPDATE organization_memberships SET status = 'active' WHERE organization_id = $1 AND user_id = $2 AND status = 'invited' RETURNING 1`, [orgId, userId])
      : await this.db.one(`DELETE FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'invited' RETURNING 1`, [orgId, userId]);
    if (!r) throw AppError.notFound();
    await this.audit.record({ actorUserId: userId, actorType: 'user', action: accept ? 'org.invitation_accepted' : 'org.invitation_declined', targetType: 'organization', targetId: orgId, ip: meta.ip, requestId: meta.requestId });
  }

  async changeRole(orgId: string, actorId: string, targetUserId: string, role: OrgRole, meta: ClientMeta): Promise<MembershipDto[]> {
    await this.db.tx(async (c) => {
      const actorRole = await this.authorize(orgId, actorId, 'org.members.manage', c);
      const current = await this.db.one<{ role: OrgRole }>(`SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 FOR UPDATE`, [orgId, targetUserId], c);
      if (!current) throw AppError.notFound();
      this.assertCanAssign(actorRole, role, current.role);
      await this.db.query(`UPDATE organization_memberships SET role = $3 WHERE organization_id = $1 AND user_id = $2`, [orgId, targetUserId, role], c);
      await this.audit.record({ actorUserId: actorId, actorType: 'user', action: 'org.member_role_changed', targetType: 'organization', targetId: orgId, metadata: { userId: targetUserId, from: current.role, to: role }, ip: meta.ip, requestId: meta.requestId }, c);
    });
    return this.members(orgId, actorId);
  }

  /** Remove a member, or leave (target = self). The DB guarantees an organization never loses its last owner. */
  async removeMember(orgId: string, actorId: string, targetUserId: string, meta: ClientMeta): Promise<void> {
    await this.db.tx(async (c) => {
      const actorRole = await this.authorize(orgId, actorId, null, c);
      const current = await this.db.one<{ role: OrgRole }>(`SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 FOR UPDATE`, [orgId, targetUserId], c);
      if (!current) throw AppError.notFound();
      if (targetUserId !== actorId) this.assertCanAssign(actorRole, current.role, current.role);
      await this.db.query(`DELETE FROM organization_memberships WHERE organization_id = $1 AND user_id = $2`, [orgId, targetUserId], c);
      await this.audit.record({ actorUserId: actorId, actorType: 'user', action: targetUserId === actorId ? 'org.member_left' : 'org.member_removed', targetType: 'organization', targetId: orgId, metadata: { userId: targetUserId }, ip: meta.ip, requestId: meta.requestId }, c);
    }).catch((e: { code?: string }) => {
      if (e?.code === 'P0002') throw new AppError('conflict', HttpStatus.CONFLICT, { reason: 'organization_requires_owner' });
      throw e;
    });
  }
}
