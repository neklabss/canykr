import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { AuthTokens } from '@backupjam/api-contract';
import { Db, Queryable } from '../../database/db';
import { TokenService, hashToken, newOpaqueToken } from './tokens';

export type RevokeReason = 'logout' | 'user_revoked' | 'password_reset' | 'refresh_reuse' | 'account_suspended' | 'account_deleted' | 'staff';

@Injectable()
export class SessionService {
  constructor(private readonly db: Db, private readonly tokens: TokenService) {}

  /** Creates a session + first refresh token and signs an access token. */
  async open(client: PoolClient, userId: string, meta: { deviceName?: string | null; userAgent?: string | null; ip?: string | null }): Promise<AuthTokens> {
    const s = await this.db.one<{ id: string }>(
      `INSERT INTO sessions (user_id, device_name, user_agent, ip) VALUES ($1,$2,$3,$4) RETURNING id`,
      [userId, meta.deviceName ?? null, meta.userAgent?.slice(0, 512) ?? null, meta.ip ?? null],
      client,
    );
    return this.issue(client, userId, s!.id, null);
  }

  async issue(client: Queryable, userId: string, sessionId: string, parentId: string | null): Promise<AuthTokens> {
    const refreshToken = newOpaqueToken('bujr');
    const refreshExpiresAt = this.tokens.refreshExpiry();
    await this.db.query(
      `INSERT INTO refresh_tokens (session_id, token_hash, parent_id, expires_at) VALUES ($1,$2,$3,$4)`,
      [sessionId, hashToken(refreshToken), parentId, refreshExpiresAt],
      client,
    );
    const access = await this.tokens.signAccess({ sub: userId, sid: sessionId });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      sessionId,
    };
  }

  async revoke(sessionId: string, reason: RevokeReason, client?: Queryable): Promise<void> {
    await this.db.query(`UPDATE sessions SET revoked_at = now(), revoke_reason = $2 WHERE id = $1 AND revoked_at IS NULL`, [sessionId, reason], client);
  }

  async revokeAllForUser(userId: string, reason: RevokeReason, client?: Queryable, exceptSessionId?: string): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET revoked_at = now(), revoke_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL AND ($3::uuid IS NULL OR id <> $3)`,
      [userId, reason, exceptSessionId ?? null],
      client,
    );
  }
}
