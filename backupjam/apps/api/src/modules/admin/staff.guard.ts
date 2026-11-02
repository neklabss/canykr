import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffPermission, StaffRole, staffRoleHas } from '@backupjam/api-contract';
import { Db } from '../../database/db';
import { AppError } from '../../common/app-error';
import { STAFF_PERMISSION } from '../../common/decorators';
import type { AppRequest } from '../../common/request-context';

export interface StaffRequest extends AppRequest { staffRole?: StaffRole }

/** Requires an active staff role that grants the route's @RequireStaff permission. Deny by default. */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly db: Db) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<StaffPermission | undefined>(STAFF_PERMISSION, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<StaffRequest>();
    if (!req.auth) throw AppError.unauthorized();
    if (!permission) throw AppError.forbidden({ reason: 'route_missing_staff_permission' });
    const staff = await this.db.one<{ role: StaffRole }>(`SELECT role FROM staff_members WHERE user_id = $1 AND revoked_at IS NULL`, [req.auth.userId]);
    // Non-staff see 404 so the admin surface is not discoverable.
    if (!staff) throw AppError.notFound();
    if (!staffRoleHas(staff.role, permission)) throw AppError.forbidden({ required: permission });
    req.staffRole = staff.role;
    return true;
  }
}
