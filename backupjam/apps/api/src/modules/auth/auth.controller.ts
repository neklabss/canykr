import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { parseAcceptLanguage } from '@backupjam/i18n';
import type { SessionDto } from '@backupjam/api-contract';
import { Auth, Public, Req } from '../../common/decorators';
import { AppError } from '../../common/app-error';
import { AppRequest, AuthContext, clientIp, requestId } from '../../common/request-context';
import { Db } from '../../database/db';
import { AUTH_THROTTLE } from '../../config/rate-limits';
import { AuthService, ClientMeta } from './auth.service';
import { SessionService } from './session.service';
import { EmailDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto, SocialLoginDto, TokenDto } from './auth.dto';

export function clientMeta(req: AppRequest): ClientMeta {
  const header = req.headers['x-buj-locale'];
  const preferred = parseAcceptLanguage(req.headers['accept-language']);
  return {
    ip: clientIp(req),
    userAgent: req.headers['user-agent'] ?? null,
    requestId: requestId(req),
    preferredLocales: typeof header === 'string' ? [header, ...preferred] : preferred,
  };
}

const AUTH_LIMIT = AUTH_THROTTLE; // stricter per-IP limit on credential endpoints (RATE_LIMIT_AUTH)

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly sessions: SessionService, private readonly db: Db) {}

  @Public() @Throttle(AUTH_LIMIT) @Post('register')
  @ApiOperation({ summary: 'Create an account with email + password (records Terms/Privacy consent)' })
  register(@Body() dto: RegisterDto, @Req() req: AppRequest) {
    return this.auth.register(dto, clientMeta(req));
  }

  @Public() @Throttle(AUTH_LIMIT) @Post('login') @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: AppRequest) {
    return this.auth.login(dto, clientMeta(req));
  }

  @Public() @Throttle(AUTH_LIMIT) @Post('oauth/google') @HttpCode(200)
  @ApiOperation({ summary: 'Sign in / sign up with a Google ID token' })
  google(@Body() dto: SocialLoginDto, @Req() req: AppRequest) {
    return this.auth.socialLogin('google', dto, clientMeta(req));
  }

  @Public() @Throttle(AUTH_LIMIT) @Post('oauth/apple') @HttpCode(200)
  @ApiOperation({ summary: 'Sign in / sign up with an Apple identity token' })
  apple(@Body() dto: SocialLoginDto, @Req() req: AppRequest) {
    return this.auth.socialLogin('apple', dto, clientMeta(req));
  }

  @Public() @Throttle(AUTH_LIMIT) @Post('refresh') @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token (single use; reuse revokes the session)' })
  refresh(@Body() dto: RefreshDto, @Req() req: AppRequest) {
    return this.auth.refresh(dto.refreshToken, clientMeta(req));
  }

  @ApiBearerAuth() @Post('logout') @HttpCode(204)
  async logout(@Auth() a: AuthContext, @Req() req: AppRequest) {
    await this.auth.logout(a.userId, a.sessionId, clientMeta(req));
  }

  @Public() @Throttle(AUTH_LIMIT) @Post('verify-email') @HttpCode(204)
  async verifyEmail(@Body() dto: TokenDto, @Req() req: AppRequest) {
    await this.auth.verifyEmail(dto.token, clientMeta(req));
  }

  @ApiBearerAuth() @Throttle(AUTH_LIMIT) @Post('verify-email/resend') @HttpCode(202)
  async resend(@Auth() a: AuthContext, @Req() req: AppRequest) {
    await this.auth.resendVerification(a.userId, clientMeta(req));
    return { accepted: true };
  }

  @Public() @Throttle(AUTH_LIMIT) @Post('password/forgot') @HttpCode(202)
  @ApiOperation({ summary: 'Request a reset link. Always 202 to prevent account enumeration.' })
  async forgot(@Body() dto: EmailDto, @Req() req: AppRequest) {
    await this.auth.forgotPassword(dto.email, clientMeta(req));
    return { accepted: true };
  }

  @Public() @Throttle(AUTH_LIMIT) @Post('password/reset') @HttpCode(204)
  @ApiOperation({ summary: 'Set a new password with a reset token; signs out all devices.' })
  async reset(@Body() dto: ResetPasswordDto, @Req() req: AppRequest) {
    await this.auth.resetPassword(dto.token, dto.newPassword, clientMeta(req));
  }

  @ApiBearerAuth() @Get('sessions')
  @ApiOperation({ summary: 'List active sessions / devices' })
  async listSessions(@Auth() a: AuthContext): Promise<SessionDto[]> {
    const rows = await this.db.query<{ id: string; device_name: string | null; user_agent: string | null; created_at: Date; last_seen_at: Date }>(
      `SELECT id, device_name, user_agent, created_at, last_seen_at FROM sessions WHERE user_id = $1 AND revoked_at IS NULL ORDER BY last_seen_at DESC`,
      [a.userId],
    );
    return rows.map((r) => ({ id: r.id, deviceName: r.device_name, userAgent: r.user_agent, createdAt: r.created_at.toISOString(), lastSeenAt: r.last_seen_at.toISOString(), current: r.id === a.sessionId }));
  }

  @ApiBearerAuth() @Delete('sessions/:id') @HttpCode(204)
  @ApiOperation({ summary: 'Sign out a specific device' })
  async revokeSession(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const owned = await this.db.one(`SELECT 1 FROM sessions WHERE id = $1 AND user_id = $2`, [id, a.userId]);
    if (!owned) throw AppError.notFound(); // object-level authorization: never reveal others' sessions
    await this.sessions.revoke(id, 'user_revoked');
  }
}
