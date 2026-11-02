import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { StaffPermission } from '@backupjam/api-contract';
import type { AppRequest, AuthContext } from './request-context';

export const IS_PUBLIC = 'buj:isPublic';
/** Marks a route as not requiring authentication. Every other route requires a valid access token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const STAFF_PERMISSION = 'buj:staffPermission';
/** Requires an active platform staff role granting this permission (see STAFF_ROLE_PERMISSIONS). */
export const RequireStaff = (permission: StaffPermission) => SetMetadata(STAFF_PERMISSION, permission);

export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.auth) throw new Error('Auth context missing — route must not be @Public()');
  return req.auth;
});

export const Req = createParamDecorator((_: unknown, ctx: ExecutionContext): AppRequest => ctx.switchToHttp().getRequest());
