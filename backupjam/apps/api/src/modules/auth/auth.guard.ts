import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Db } from '../../database/db';
import { AppError } from '../../common/app-error';
import { IS_PUBLIC } from '../../common/decorators';
import type { AppRequest } from '../../common/request-context';
import { TokenService } from './tokens';

/**
 * Global authentication guard. Every route requires a valid Bearer access token unless marked @Public().
 * The session row is checked on each request so revocation (logout, reuse detection, suspension)
 * takes effect immediately rather than at access-token expiry.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tokens: TokenService, private readonly db: Db) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;

    if (!bearer) {
      if (isPublic) return true;
      throw AppError.unauthorized();
    }
    let claims;
    try {
      claims = await this.tokens.verifyAccess(bearer);
    } catch {
      if (isPublic) return true; // public routes ignore bad tokens instead of failing
      throw AppError.unauthorized('auth.token_invalid');
    }
    const row = await this.db.one<{ status: string; locale: string | null; last_seen_at: Date }>(
      `SELECT u.status, p.locale, s.last_seen_at
         FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN user_preferences p ON p.user_id = u.id
        WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL`,
      [claims.sid, claims.sub],
    );
    if (!row || row.status !== 'active') {
      if (isPublic) return true;
      throw AppError.unauthorized('auth.token_invalid');
    }
    req.auth = { userId: claims.sub, sessionId: claims.sid, localePreference: row.locale };
    if (Date.now() - row.last_seen_at.getTime() > 5 * 60_000) {
      void this.db.query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [claims.sid]).catch(() => undefined);
    }
    return true;
  }
}
