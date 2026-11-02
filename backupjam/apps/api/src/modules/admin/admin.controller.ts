import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, RequireStaff, Req } from '../../common/decorators';
import { AppError } from '../../common/app-error';
import { AppRequest, AuthContext } from '../../common/request-context';
import { Db } from '../../database/db';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { clientMeta } from '../auth/auth.controller';
import { StaffGuard } from './staff.guard';
import { AuditQueryDto, CountryUpdateDto, FlagUpdateDto, GrantStaffDto, ListQueryDto, SuspendDto } from './admin.dto';

const encodeCursor = (createdAt: Date, id: string) => Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
function decodeCursor(c?: string): [string, string] | null {
  if (!c) return null;
  const [ts, id] = Buffer.from(c, 'base64url').toString().split('|');
  if (!ts || !id || Number.isNaN(Date.parse(ts))) throw AppError.validation([{ field: 'cursor' }]);
  return [ts, id];
}

/**
 * Administration API (consumed by apps/admin). Every route declares a staff permission; every
 * mutation is written to the append-only audit log in the same transaction.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(StaffGuard)
@Controller('v1/admin')
export class AdminController {
  constructor(private readonly db: Db, private readonly audit: AuditService, private readonly sessions: SessionService) {}

  @Get('overview') @RequireStaff('admin.users.read')
  @ApiOperation({ summary: 'Operational counters. Financial KPIs arrive with Phase 4 (gross vs settled vs fees vs refunds).' })
  async overview() {
    const r = await this.db.one<Record<string, string>>(`SELECT
      (SELECT count(*) FROM users WHERE status = 'active') AS active_users,
      (SELECT count(*) FROM users WHERE status = 'suspended') AS suspended_users,
      (SELECT count(*) FROM users WHERE status = 'pending_deletion') AS pending_deletion_users,
      (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days') AS signups_7d,
      (SELECT count(*) FROM user_capabilities WHERE capability = 'musician') AS musicians,
      (SELECT count(*) FROM organizations WHERE type = 'band' AND status = 'active') AS bands,
      (SELECT count(*) FROM organizations WHERE type = 'venue' AND status = 'active') AS venues,
      (SELECT count(*) FROM organizations WHERE type = 'organizer' AND status = 'active') AS organizers`);
    return Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, Number(v)]));
  }

  @Get('users') @RequireStaff('admin.users.read')
  async users(@Query() q: ListQueryDto) {
    const limit = q.limit ?? 25;
    const cursor = decodeCursor(q.cursor);
    const rows = await this.db.query<{ id: string; email: string | null; display_name: string; status: string; email_verified_at: Date | null; created_at: Date; country_code: string | null; locale: string | null; staff_role: string | null }>(
      `SELECT u.id, u.email, u.display_name, u.status, u.email_verified_at, u.created_at, p.country_code, p.locale,
              (SELECT role FROM staff_members s WHERE s.user_id = u.id AND s.revoked_at IS NULL) AS staff_role
         FROM users u LEFT JOIN user_preferences p ON p.user_id = u.id
        WHERE ($1::text IS NULL OR u.email ILIKE '%' || $1 || '%' OR u.display_name ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR u.status = $2)
          AND ($3::timestamptz IS NULL OR (u.created_at, u.id) < ($3::timestamptz, $4::uuid))
        ORDER BY u.created_at DESC, u.id DESC LIMIT $5`,
      [q.q?.replace(/[%_\\]/g, (m) => `\\${m}`) ?? null, q.status ?? null, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
    );
    const items = rows.slice(0, limit).map((r) => ({
      id: r.id, email: r.email, displayName: r.display_name, status: r.status, emailVerified: !!r.email_verified_at,
      countryCode: r.country_code, locale: r.locale, staffRole: r.staff_role, createdAt: r.created_at.toISOString(),
    }));
    const last = rows[limit - 1];
    return { items, nextCursor: rows.length > limit && last ? encodeCursor(last.created_at, last.id) : null };
  }

  @Post('users/:id/suspend') @HttpCode(204) @RequireStaff('admin.users.suspend')
  async suspend(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SuspendDto, @Req() req: AppRequest) {
    if (id === a.userId) throw AppError.forbidden({ reason: 'cannot_suspend_self' });
    const m = clientMeta(req);
    await this.db.tx(async (c) => {
      const r = await this.db.one(`UPDATE users SET status = 'suspended', suspended_reason = $2 WHERE id = $1 AND status IN ('active','pending_deletion') RETURNING 1`, [id, dto.reason], c);
      if (!r) throw AppError.notFound();
      await this.sessions.revokeAllForUser(id, 'account_suspended', c);
      await this.audit.record({ actorUserId: a.userId, actorType: 'staff', action: 'admin.user_suspended', targetType: 'user', targetId: id, metadata: { reason: dto.reason }, ip: m.ip, requestId: m.requestId }, c);
    });
  }

  @Post('users/:id/unsuspend') @HttpCode(204) @RequireStaff('admin.users.suspend')
  async unsuspend(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Req() req: AppRequest) {
    const m = clientMeta(req);
    await this.db.tx(async (c) => {
      const r = await this.db.one(`UPDATE users SET status = 'active', suspended_reason = NULL WHERE id = $1 AND status = 'suspended' RETURNING 1`, [id], c);
      if (!r) throw AppError.notFound();
      await this.audit.record({ actorUserId: a.userId, actorType: 'staff', action: 'admin.user_unsuspended', targetType: 'user', targetId: id, ip: m.ip, requestId: m.requestId }, c);
    });
  }

  @Get('audit-logs') @RequireStaff('admin.audit.read')
  async auditLogs(@Query() q: AuditQueryDto) {
    const rows = await this.db.query<{ id: string; actor_user_id: string | null; actor_type: string; action: string; target_type: string | null; target_id: string | null; metadata: unknown; created_at: Date }>(
      `SELECT id, actor_user_id, actor_type, action, target_type, target_id, metadata, created_at FROM audit_logs
        WHERE ($1::text IS NULL OR action = $1) AND ($2::text IS NULL OR target_type = $2) AND ($3::text IS NULL OR target_id = $3)
          AND ($4::bigint IS NULL OR id < $4) ORDER BY id DESC LIMIT $5`,
      [q.action ?? null, q.targetType ?? null, q.targetId ?? null, q.beforeId ?? null, q.limit ?? 50],
    );
    return rows.map((r) => ({ id: Number(r.id), actorUserId: r.actor_user_id, actorType: r.actor_type, action: r.action, targetType: r.target_type, targetId: r.target_id, metadata: r.metadata, createdAt: r.created_at.toISOString() }));
  }

  @Get('feature-flags') @RequireStaff('admin.flags.manage')
  async flags() {
    return this.db.query(`SELECT key, description, enabled, rules, updated_at AS "updatedAt" FROM feature_flags ORDER BY key`);
  }

  @Put('feature-flags/:key') @RequireStaff('admin.flags.manage')
  async setFlag(@Auth() a: AuthContext, @Param('key') key: string, @Body() dto: FlagUpdateDto, @Req() req: AppRequest) {
    const m = clientMeta(req);
    return this.db.tx(async (c) => {
      const r = await this.db.one(
        `UPDATE feature_flags SET enabled = $2, rules = COALESCE($3, rules), updated_by = $4 WHERE key = $1
         RETURNING key, description, enabled, rules, updated_at AS "updatedAt"`,
        [key, dto.enabled, dto.rules ?? null, a.userId],
        c,
      );
      if (!r) throw AppError.notFound();
      await this.audit.record({ actorUserId: a.userId, actorType: 'staff', action: 'admin.flag_updated', targetType: 'feature_flag', targetId: key, metadata: { enabled: dto.enabled, rules: dto.rules }, ip: m.ip, requestId: m.requestId }, c);
      return r;
    });
  }

  @Get('countries') @RequireStaff('admin.countries.manage')
  async countries() {
    return this.db.query(`SELECT code, default_currency AS "defaultCurrency", default_locale AS "defaultLocale", default_time_zone AS "defaultTimeZone",
      launch_status AS "launchStatus", payments_enabled AS "paymentsEnabled", payment_provider AS "paymentProvider" FROM countries ORDER BY code`);
  }

  @Patch('countries/:code') @RequireStaff('admin.countries.manage')
  @ApiOperation({ summary: 'Change launch status / payment availability. Payments require a contracted provider.' })
  async updateCountry(@Auth() a: AuthContext, @Param('code') code: string, @Body() dto: CountryUpdateDto, @Req() req: AppRequest) {
    const m = clientMeta(req);
    return this.db.tx(async (c) => {
      const r = await this.db.one(
        `UPDATE countries SET launch_status = COALESCE($2, launch_status), payments_enabled = COALESCE($3, payments_enabled),
                payment_provider = CASE WHEN $5 THEN $4 ELSE payment_provider END
          WHERE code = $1 RETURNING code, launch_status AS "launchStatus", payments_enabled AS "paymentsEnabled", payment_provider AS "paymentProvider"`,
        [code.toUpperCase(), dto.launchStatus ?? null, dto.paymentsEnabled ?? null, dto.paymentProvider ?? null, dto.paymentProvider !== undefined],
        c,
      );
      if (!r) throw AppError.notFound();
      await this.audit.record({ actorUserId: a.userId, actorType: 'staff', action: 'admin.country_updated', targetType: 'country', targetId: code.toUpperCase(), metadata: { ...dto }, ip: m.ip, requestId: m.requestId }, c);
      return r;
    });
  }

  @Get('staff') @RequireStaff('admin.staff.manage')
  async staff() {
    return this.db.query(`SELECT s.user_id AS "userId", u.email, u.display_name AS "displayName", s.role, s.created_at AS "createdAt"
      FROM staff_members s JOIN users u ON u.id = s.user_id WHERE s.revoked_at IS NULL ORDER BY s.created_at`);
  }

  @Post('staff') @HttpCode(204) @RequireStaff('admin.staff.manage')
  async grant(@Auth() a: AuthContext, @Body() dto: GrantStaffDto, @Req() req: AppRequest) {
    const m = clientMeta(req);
    await this.db.tx(async (c) => {
      await this.db.query(
        `INSERT INTO staff_members (user_id, role, granted_by) VALUES ($1,$2,$3)
         ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, granted_by = EXCLUDED.granted_by, revoked_at = NULL, created_at = now()`,
        [dto.userId, dto.role, a.userId],
        c,
      );
      await this.audit.record({ actorUserId: a.userId, actorType: 'staff', action: 'admin.staff_granted', targetType: 'user', targetId: dto.userId, metadata: { role: dto.role }, ip: m.ip, requestId: m.requestId }, c);
    });
  }

  @Delete('staff/:userId') @HttpCode(204) @RequireStaff('admin.staff.manage')
  async revoke(@Auth() a: AuthContext, @Param('userId', ParseUUIDPipe) userId: string, @Req() req: AppRequest) {
    if (userId === a.userId) throw AppError.forbidden({ reason: 'cannot_revoke_self' });
    const m = clientMeta(req);
    await this.db.tx(async (c) => {
      const r = await this.db.one(`UPDATE staff_members SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL RETURNING 1`, [userId], c);
      if (!r) throw AppError.notFound();
      await this.audit.record({ actorUserId: a.userId, actorType: 'staff', action: 'admin.staff_revoked', targetType: 'user', targetId: userId, ip: m.ip, requestId: m.requestId }, c);
    });
  }
}
