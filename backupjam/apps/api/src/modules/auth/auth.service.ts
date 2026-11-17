import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { AuthResponse, AuthTokens, UserCapability } from '@backupjam/api-contract';
import { matchLocale, negotiateLocale } from '@backupjam/i18n';
import { ENV, Env } from '../../config/env';
import { Db } from '../../database/db';
import { AppError } from '../../common/app-error';
import { AuditService } from '../audit/audit.service';
import { MailComposer } from '../mail/mailer';
import { MeQuery } from '../users/me.query';
import { PasswordHasher, passwordProblems } from './password';
import { SessionService } from './session.service';
import { hashToken, newOpaqueToken } from './tokens';
import { OidcVerifier, SocialProvider, VerifiedIdentity } from './oidc';
import type { LoginDto, RegisterDto, SocialLoginDto } from './auth.dto';

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  /** Ordered device/browser locale preferences for this request. */
  preferredLocales: string[];
}

interface UserAuthRow { id: string; email: string | null; password_hash: string | null; status: string; email_verified_at: Date | null }

const VERIFY_TTL_MS = 24 * 3_600_000;
const RESET_TTL_MS = 3_600_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');
  private readonly hasher: PasswordHasher;
  /** Pre-computed hash so unknown-email logins cost the same as real ones (no user enumeration by timing). */
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly db: Db,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailComposer,
    private readonly me: MeQuery,
    private readonly oidc: OidcVerifier,
  ) {
    this.hasher = new PasswordHasher(env.PASSWORD_SCRYPT_LOG_N);
  }

  // ───────────────────────────── Registration ─────────────────────────────
  async register(dto: RegisterDto, meta: ClientMeta): Promise<AuthResponse> {
    if (!dto.acceptTerms) throw AppError.validation([{ field: 'acceptTerms', problem: 'must_accept' }]);
    const email = dto.email.trim().toLowerCase();
    const problems = passwordProblems(dto.password, email);
    if (problems.length) throw new AppError('auth.weak_password', HttpStatus.BAD_REQUEST, { problems });
    const explicitLocale = dto.locale ? matchLocale(dto.locale) ?? null : null;
    const passwordHash = await this.hasher.hash(dto.password);

    const { userId, tokens } = await this.db.tx(async (c) => {
      const exists = await this.db.one(`SELECT 1 FROM users WHERE email = $1`, [email], c);
      if (exists) throw AppError.conflict('auth.email_taken');
      const u = await this.db.one<{ id: string }>(
        `INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id`,
        [email, passwordHash, dto.displayName.trim()],
        c,
      );
      const userId = u!.id;
      await this.db.query(`INSERT INTO user_identities (user_id, provider, provider_subject, email) VALUES ($1,'email',$2,$3)`, [userId, email, email], c);
      await this.createDefaults(c, userId, explicitLocale, dto.countryCode ?? null, dto.timeZone ?? null, dto.capabilities ?? []);
      await this.recordSignupConsents(c, userId, negotiateLocale({ userPreference: explicitLocale, preferred: meta.preferredLocales }), meta, dto.marketingEmails ?? false);
      await this.audit.record({ actorUserId: userId, actorType: 'user', action: 'user.registered', targetType: 'user', targetId: userId, metadata: { method: 'email' }, ip: meta.ip, requestId: meta.requestId }, c);
      const tokens = await this.sessions.open(c, userId, { deviceName: dto.deviceName, userAgent: meta.userAgent, ip: meta.ip });
      return { userId, tokens };
    });

    await this.sendVerification(userId, email, negotiateLocale({ userPreference: explicitLocale, preferred: meta.preferredLocales }));
    return { user: (await this.me.get(userId, meta.preferredLocales))!, tokens };
  }

  private async createDefaults(c: PoolClient, userId: string, locale: string | null, countryCode: string | null, timeZone: string | null, capabilities: UserCapability[]) {
    const country = countryCode ? await this.db.one<{ code: string; default_currency: string }>(`SELECT code, default_currency FROM countries WHERE code = $1`, [countryCode.toUpperCase()], c) : undefined;
    await this.db.query(
      `INSERT INTO user_preferences (user_id, locale, country_code, currency_code, time_zone) VALUES ($1,$2,$3,$4,$5)`,
      [userId, locale, country?.code ?? null, country?.default_currency ?? null, timeZone && isValidTimeZone(timeZone) ? timeZone : null],
      c,
    );
    await this.db.query(`INSERT INTO onboarding_profiles (user_id) VALUES ($1)`, [userId], c);
    for (const cap of new Set(capabilities)) {
      await this.db.query(`INSERT INTO user_capabilities (user_id, capability) VALUES ($1,$2)`, [userId, cap], c);
    }
  }

  private async recordSignupConsents(c: PoolClient, userId: string, locale: string, meta: ClientMeta, marketing: boolean) {
    const rows: Array<[string, string, boolean]> = [
      ['terms', this.env.TERMS_VERSION, true],
      ['privacy', this.env.PRIVACY_VERSION, true],
      ['marketing_email', this.env.PRIVACY_VERSION, marketing],
    ];
    for (const [type, version, granted] of rows) {
      await this.db.query(
        `INSERT INTO consent_records (user_id, consent_type, version, granted, locale, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userId, type, version, granted, locale, meta.ip, meta.userAgent?.slice(0, 512) ?? null],
        c,
      );
    }
  }

  // ───────────────────────────── Login / refresh / logout ─────────────────────────────
  async login(dto: LoginDto, meta: ClientMeta): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.db.one<UserAuthRow>(`SELECT id, email, password_hash, status, email_verified_at FROM users WHERE email = $1`, [email]);
    const ok = user?.password_hash
      ? await this.hasher.verify(dto.password, user.password_hash)
      : (await this.hasher.verify(dto.password, await this.getDummyHash()), false);

    if (!user || !ok) {
      if (user) await this.audit.record({ actorUserId: user.id, actorType: 'user', action: 'auth.login_failed', targetType: 'user', targetId: user.id, ip: meta.ip, requestId: meta.requestId });
      throw AppError.unauthorized('auth.invalid_credentials');
    }
    if (user.status === 'suspended' || user.status === 'deleted') throw new AppError('auth.account_suspended', HttpStatus.FORBIDDEN);

    const tokens = await this.db.tx(async (c) => {
      if (user.status === 'pending_deletion') {
        // Signing in during the grace period cancels the deletion request.
        await this.db.query(`UPDATE users SET status = 'active', deletion_requested_at = NULL WHERE id = $1`, [user.id], c);
        await this.audit.record({ actorUserId: user.id, actorType: 'user', action: 'user.deletion_cancelled', targetType: 'user', targetId: user.id, ip: meta.ip, requestId: meta.requestId }, c);
      }
      if (this.hasher.needsRehash(user.password_hash!)) {
        await this.db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [user.id, await this.hasher.hash(dto.password)], c);
      }
      await this.db.query(`UPDATE user_identities SET last_used_at = now() WHERE user_id = $1 AND provider = 'email'`, [user.id], c);
      await this.audit.record({ actorUserId: user.id, actorType: 'user', action: 'auth.login', targetType: 'user', targetId: user.id, metadata: { method: 'password' }, ip: meta.ip, requestId: meta.requestId }, c);
      return this.sessions.open(c, user.id, { deviceName: dto.deviceName, userAgent: meta.userAgent, ip: meta.ip });
    });
    return { user: (await this.me.get(user.id, meta.preferredLocales))!, tokens };
  }

  /**
   * Refresh-token rotation with reuse detection: each token is single-use. Presenting an
   * already-used token means it leaked — the whole session is revoked.
   */
  async refresh(refreshToken: string, meta: ClientMeta): Promise<AuthTokens> {
    const outcome = await this.db.tx(async (c) => {
      const row = await this.db.one<{ id: string; session_id: string; used_at: Date | null; expires_at: Date; user_id: string; revoked_at: Date | null; status: string }>(
        `SELECT rt.id, rt.session_id, rt.used_at, rt.expires_at, s.user_id, s.revoked_at, u.status
           FROM refresh_tokens rt JOIN sessions s ON s.id = rt.session_id JOIN users u ON u.id = s.user_id
          WHERE rt.token_hash = $1 FOR UPDATE OF rt, s`,
        [hashToken(refreshToken)],
        c,
      );
      if (!row) return { error: 'auth.token_invalid' as const };
      if (row.used_at) {
        await this.sessions.revoke(row.session_id, 'refresh_reuse', c);
        await this.audit.record({ actorUserId: row.user_id, actorType: 'system', action: 'auth.refresh_reuse_detected', targetType: 'session', targetId: row.session_id, ip: meta.ip, requestId: meta.requestId }, c);
        return { error: 'auth.refresh_reused' as const };
      }
      if (row.revoked_at || row.expires_at.getTime() <= Date.now() || row.status !== 'active') return { error: 'auth.token_invalid' as const };
      await this.db.query(`UPDATE refresh_tokens SET used_at = now() WHERE id = $1`, [row.id], c);
      await this.db.query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [row.session_id], c);
      return { tokens: await this.sessions.issue(c, row.user_id, row.session_id, row.id) };
    });
    // Revocation must commit even though the request fails, so errors are raised after the transaction.
    if ('error' in outcome) throw AppError.unauthorized(outcome.error);
    return outcome.tokens;
  }

  async logout(userId: string, sessionId: string, meta: ClientMeta): Promise<void> {
    await this.sessions.revoke(sessionId, 'logout');
    await this.audit.record({ actorUserId: userId, actorType: 'user', action: 'auth.logout', targetType: 'session', targetId: sessionId, ip: meta.ip, requestId: meta.requestId });
  }

  // ───────────────────────────── Email verification ─────────────────────────────
  async sendVerification(userId: string, email: string, locale: string): Promise<void> {
    const token = newOpaqueToken('bujv');
    await this.db.query(`UPDATE email_tokens SET consumed_at = now() WHERE user_id = $1 AND purpose = 'verify_email' AND consumed_at IS NULL`, [userId]);
    await this.db.query(`INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1,'verify_email',$2,$3)`, [userId, hashToken(token), new Date(Date.now() + VERIFY_TTL_MS)]);
    await this.mail.verifyEmail(email, locale, token);
  }

  async resendVerification(userId: string, meta: ClientMeta): Promise<void> {
    const me = await this.me.get(userId, meta.preferredLocales);
    if (!me?.email || me.emailVerified) return;
    await this.sendVerification(userId, me.email, me.preferences.effectiveLocale);
  }

  async verifyEmail(token: string, meta: ClientMeta): Promise<void> {
    await this.db.tx(async (c) => {
      const row = await this.consumeEmailToken(c, token, 'verify_email');
      await this.db.query(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1`, [row.user_id], c);
      await this.db.query(`UPDATE user_identities SET email_verified = true WHERE user_id = $1 AND provider = 'email'`, [row.user_id], c);
      await this.audit.record({ actorUserId: row.user_id, actorType: 'user', action: 'user.email_verified', targetType: 'user', targetId: row.user_id, ip: meta.ip, requestId: meta.requestId }, c);
    });
  }

  private async consumeEmailToken(c: PoolClient, token: string, purpose: 'verify_email' | 'reset_password') {
    const row = await this.db.one<{ id: string; user_id: string }>(
      `UPDATE email_tokens SET consumed_at = now()
        WHERE token_hash = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > now()
        RETURNING id, user_id`,
      [hashToken(token), purpose],
      c,
    );
    if (!row) throw AppError.validation([{ field: 'token', problem: 'invalid_or_expired' }]);
    return row;
  }

  // ───────────────────────────── Password reset ─────────────────────────────
  /** Always succeeds from the caller's perspective (no account enumeration). */
  async forgotPassword(email: string, meta: ClientMeta): Promise<void> {
    const user = await this.db.one<{ id: string; email: string; status: string; locale: string | null }>(
      `SELECT u.id, u.email, u.status, p.locale FROM users u LEFT JOIN user_preferences p ON p.user_id = u.id WHERE u.email = $1`,
      [email.trim().toLowerCase()],
    );
    if (!user || user.status === 'deleted' || user.status === 'suspended') return;
    const token = newOpaqueToken('bujp');
    await this.db.query(`UPDATE email_tokens SET consumed_at = now() WHERE user_id = $1 AND purpose = 'reset_password' AND consumed_at IS NULL`, [user.id]);
    await this.db.query(`INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1,'reset_password',$2,$3)`, [user.id, hashToken(token), new Date(Date.now() + RESET_TTL_MS)]);
    await this.audit.record({ actorUserId: user.id, actorType: 'user', action: 'auth.password_reset_requested', targetType: 'user', targetId: user.id, ip: meta.ip, requestId: meta.requestId });
    await this.mail.resetPassword(user.email, negotiateLocale({ userPreference: user.locale, preferred: meta.preferredLocales }), token);
  }

  async resetPassword(token: string, newPassword: string, meta: ClientMeta): Promise<void> {
    await this.db.tx(async (c) => {
      const row = await this.consumeEmailToken(c, token, 'reset_password');
      const u = await this.db.one<{ email: string | null }>(`SELECT email FROM users WHERE id = $1`, [row.user_id], c);
      const problems = passwordProblems(newPassword, u?.email);
      if (problems.length) throw new AppError('auth.weak_password', HttpStatus.BAD_REQUEST, { problems });
      // Completing a reset proves mailbox control, so the email also counts as verified.
      await this.db.query(`UPDATE users SET password_hash = $2, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1`, [row.user_id, await this.hasher.hash(newPassword)], c);
      if (u?.email) {
        await this.db.query(
          `INSERT INTO user_identities (user_id, provider, provider_subject, email, email_verified) VALUES ($1,'email',$2,$3,true)
           ON CONFLICT (user_id, provider) DO UPDATE SET email_verified = true`,
          [row.user_id, u.email, u.email],
          c,
        );
      }
      await this.sessions.revokeAllForUser(row.user_id, 'password_reset', c);
      await this.audit.record({ actorUserId: row.user_id, actorType: 'user', action: 'auth.password_reset', targetType: 'user', targetId: row.user_id, ip: meta.ip, requestId: meta.requestId }, c);
    });
  }

  // ───────────────────────────── Social login (Google / Apple) ─────────────────────────────
  async socialLogin(provider: SocialProvider, dto: SocialLoginDto, meta: ClientMeta): Promise<AuthResponse & { isNewUser: boolean }> {
    const identity = await this.oidc.verify(provider, dto.idToken, dto.nonce);
    const { userId, tokens, isNewUser } = await this.db.tx(async (c) => {
      const linked = await this.db.one<{ user_id: string; status: string }>(
        `SELECT i.user_id, u.status FROM user_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = $1 AND i.provider_subject = $2`,
        [provider, identity.subject],
        c,
      );
      let userId: string;
      let isNewUser = false;
      if (linked) {
        if (linked.status === 'suspended' || linked.status === 'deleted') throw new AppError('auth.account_suspended', HttpStatus.FORBIDDEN);
        userId = linked.user_id;
        await this.db.query(`UPDATE user_identities SET last_used_at = now() WHERE provider = $1 AND provider_subject = $2`, [provider, identity.subject], c);
        if (linked.status === 'pending_deletion') await this.db.query(`UPDATE users SET status='active', deletion_requested_at=NULL WHERE id=$1`, [userId], c);
      } else {
        userId = await this.linkOrCreate(c, identity, dto, meta);
        isNewUser = !(await this.db.one(`SELECT 1 FROM user_identities WHERE user_id = $1 AND provider <> $2`, [userId, provider], c));
      }
      await this.audit.record({ actorUserId: userId, actorType: 'user', action: 'auth.login', targetType: 'user', targetId: userId, metadata: { method: provider, isNewUser }, ip: meta.ip, requestId: meta.requestId }, c);
      return { userId, isNewUser, tokens: await this.sessions.open(c, userId, { deviceName: dto.deviceName, userAgent: meta.userAgent, ip: meta.ip }) };
    });
    return { user: (await this.me.get(userId, meta.preferredLocales))!, tokens, isNewUser };
  }

  /**
   * Linking policy (prevents account pre-hijacking): an existing account is linked only when BOTH the
   * provider asserts a verified email AND the local account's email is verified. Otherwise → 409.
   */
  private async linkOrCreate(c: PoolClient, id: VerifiedIdentity, dto: SocialLoginDto, meta: ClientMeta): Promise<string> {
    if (id.email) {
      const existing = await this.db.one<{ id: string; email_verified_at: Date | null; status: string }>(`SELECT id, email_verified_at, status FROM users WHERE email = $1`, [id.email], c);
      if (existing) {
        if (!id.emailVerified || !existing.email_verified_at) throw AppError.conflict('auth.identity_conflict');
        if (existing.status === 'suspended' || existing.status === 'deleted') throw new AppError('auth.account_suspended', HttpStatus.FORBIDDEN);
        await this.db.query(
          `INSERT INTO user_identities (user_id, provider, provider_subject, email, email_verified, last_used_at) VALUES ($1,$2,$3,$4,$5,now())`,
          [existing.id, id.provider, id.subject, id.email, id.emailVerified],
          c,
        );
        await this.audit.record({ actorUserId: existing.id, actorType: 'user', action: 'auth.identity_linked', targetType: 'user', targetId: existing.id, metadata: { provider: id.provider }, ip: meta.ip, requestId: meta.requestId }, c);
        return existing.id;
      }
    }
    if (dto.acceptTerms !== true) throw AppError.validation([{ field: 'acceptTerms', problem: 'must_accept' }]);
    const displayName = (dto.displayName ?? id.email?.split('@')[0] ?? 'BackUpJam member').slice(0, 80);
    const u = await this.db.one<{ id: string }>(
      `INSERT INTO users (email, email_verified_at, display_name) VALUES ($1, $2, $3) RETURNING id`,
      [id.email, id.email && id.emailVerified ? new Date() : null, displayName],
      c,
    );
    await this.db.query(
      `INSERT INTO user_identities (user_id, provider, provider_subject, email, email_verified, last_used_at) VALUES ($1,$2,$3,$4,$5,now())`,
      [u!.id, id.provider, id.subject, id.email, id.emailVerified],
      c,
    );
    const explicit = dto.locale ? matchLocale(dto.locale) ?? null : null;
    await this.createDefaults(c, u!.id, explicit, null, null, []);
    await this.recordSignupConsents(c, u!.id, negotiateLocale({ userPreference: explicit, preferred: meta.preferredLocales }), meta, false);
    await this.audit.record({ actorUserId: u!.id, actorType: 'user', action: 'user.registered', targetType: 'user', targetId: u!.id, metadata: { method: id.provider }, ip: meta.ip, requestId: meta.requestId }, c);
    return u!.id;
  }

  // ───────────────────────────── Helpers ─────────────────────────────
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const u = await this.db.one<{ password_hash: string | null }>(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    return !!u?.password_hash && this.hasher.verify(password, u.password_hash);
  }

  async hasPassword(userId: string): Promise<boolean> {
    return !!(await this.db.one(`SELECT 1 FROM users WHERE id = $1 AND password_hash IS NOT NULL`, [userId]));
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('dummy-password-for-timing-equalisation');
    return this.dummyHash;
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
