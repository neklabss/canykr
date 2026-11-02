import { Inject, Injectable } from '@nestjs/common';
import type { MeDto, OnboardingDto as OnboardingView, UserCapability } from '@backupjam/api-contract';
import { matchLocale } from '@backupjam/i18n';
import { ENV, Env } from '../../config/env';
import { Db } from '../../database/db';
import { AppError } from '../../common/app-error';
import { AuditService } from '../audit/audit.service';
import { AuthService, ClientMeta, isValidTimeZone } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { MeQuery } from './me.query';
import type { ConsentDto, OnboardingDto, UpdatePreferencesDto, UpdateProfileDto } from './users.dto';

export const DELETION_GRACE_DAYS = 30;

@Injectable()
export class UsersService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly db: Db,
    private readonly me: MeQuery,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
  ) {}

  async getMe(userId: string, meta: ClientMeta): Promise<MeDto> {
    const me = await this.me.get(userId, meta.preferredLocales);
    if (!me) throw AppError.notFound();
    return me;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, meta: ClientMeta): Promise<MeDto> {
    await this.db.query(
      `UPDATE users SET display_name = COALESCE($2, display_name), username = COALESCE($3, username) WHERE id = $1`,
      [userId, dto.displayName?.trim() ?? null, dto.username ?? null],
    );
    return this.getMe(userId, meta);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto, meta: ClientMeta): Promise<MeDto> {
    const sets: string[] = [];
    const params: unknown[] = [userId];
    const set = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };

    if (dto.locale !== undefined) {
      const resolved = dto.locale === null ? null : matchLocale(dto.locale);
      if (dto.locale !== null && !resolved) throw AppError.validation([{ field: 'locale', problem: 'unsupported' }]);
      set('locale', resolved);
    }
    if (dto.countryCode !== undefined) set('country_code', dto.countryCode);
    if (dto.currencyCode !== undefined) set('currency_code', dto.currencyCode);
    if (dto.timeZone !== undefined) {
      if (dto.timeZone !== null && !isValidTimeZone(dto.timeZone)) throw AppError.validation([{ field: 'timeZone', problem: 'invalid' }]);
      set('time_zone', dto.timeZone);
    }
    if (dto.theme !== undefined) set('theme', dto.theme);
    if (dto.quietHoursStart !== undefined || dto.quietHoursEnd !== undefined) {
      if ((dto.quietHoursStart ?? null) === null !== ((dto.quietHoursEnd ?? null) === null)) {
        throw AppError.validation([{ field: 'quietHours', problem: 'start_and_end_required' }]);
      }
      set('quiet_hours_start', dto.quietHoursStart ?? null);
      set('quiet_hours_end', dto.quietHoursEnd ?? null);
    }
    if (sets.length) {
      await this.db.query(`UPDATE user_preferences SET ${sets.join(', ')} WHERE user_id = $1`, params);
      await this.audit.record({ actorUserId: userId, actorType: 'user', action: 'user.preferences_updated', targetType: 'user', targetId: userId, metadata: { fields: Object.keys(dto) }, ip: meta.ip, requestId: meta.requestId });
    }
    return this.getMe(userId, meta);
  }

  async setCapabilities(userId: string, capabilities: UserCapability[], meta: ClientMeta): Promise<MeDto> {
    await this.db.tx(async (c) => {
      await this.db.query(`DELETE FROM user_capabilities WHERE user_id = $1`, [userId], c);
      for (const cap of new Set(capabilities)) await this.db.query(`INSERT INTO user_capabilities (user_id, capability) VALUES ($1,$2)`, [userId, cap], c);
    });
    return this.getMe(userId, meta);
  }

  async getOnboarding(userId: string): Promise<OnboardingView> {
    const r = await this.db.one<{
      home_country_code: string | null; home_city: string | null; lat: number | null; lng: number | null; available_for_bookings: boolean | null;
      discover_goals: OnboardingView['discoverGoals']; travel_country_codes: string[]; travel_radius_km: number | null; skipped_steps: string[]; completed_at: Date | null;
      capabilities: UserCapability[] | null; instruments: string[] | null; genres: string[] | null; languages: string[] | null;
    }>(
      `SELECT o.home_country_code, o.home_city, ST_Y(o.location::geometry) AS lat, ST_X(o.location::geometry) AS lng,
              o.available_for_bookings, o.discover_goals, o.travel_country_codes, o.travel_radius_km, o.skipped_steps, o.completed_at,
              (SELECT array_agg(capability ORDER BY capability) FROM user_capabilities WHERE user_id = o.user_id) AS capabilities,
              (SELECT array_agg(instrument ORDER BY instrument) FROM user_instruments WHERE user_id = o.user_id) AS instruments,
              (SELECT array_agg(genre ORDER BY genre) FROM user_genres WHERE user_id = o.user_id) AS genres,
              (SELECT array_agg(language_tag ORDER BY language_tag) FROM user_languages WHERE user_id = o.user_id) AS languages
         FROM onboarding_profiles o WHERE o.user_id = $1`,
      [userId],
    );
    if (!r) throw AppError.notFound();
    return {
      capabilities: r.capabilities ?? [], instruments: r.instruments ?? [], genres: r.genres ?? [], languages: r.languages ?? [],
      homeCountryCode: r.home_country_code, homeCity: r.home_city,
      location: r.lat !== null && r.lng !== null ? { lat: r.lat, lng: r.lng } : null,
      availableForBookings: r.available_for_bookings, discoverGoals: r.discover_goals,
      travelCountryCodes: r.travel_country_codes.map((x) => x.trim()), travelRadiusKm: r.travel_radius_km,
      skippedSteps: r.skipped_steps, completedAt: r.completed_at?.toISOString() ?? null,
    };
  }

  async saveOnboarding(userId: string, dto: OnboardingDto): Promise<OnboardingView> {
    await this.db.tx(async (c) => {
      const sets: string[] = [];
      const params: unknown[] = [userId];
      const set = (sql: string, v: unknown) => { params.push(v); sets.push(sql.replace('?', `$${params.length}`)); };
      if (dto.homeCountryCode !== undefined) set('home_country_code = ?', dto.homeCountryCode);
      if (dto.homeCity !== undefined) set('home_city = ?', dto.homeCity);
      if (dto.location !== undefined) {
        if (dto.location === null) sets.push('location = NULL');
        else {
          params.push(dto.location.lng, dto.location.lat);
          sets.push(`location = ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length}), 4326)::geography`);
        }
      }
      if (dto.availableForBookings !== undefined) set('available_for_bookings = ?', dto.availableForBookings);
      if (dto.discoverGoals !== undefined) set('discover_goals = ?', dto.discoverGoals);
      if (dto.travelCountryCodes !== undefined) set('travel_country_codes = ?', dto.travelCountryCodes);
      if (dto.travelRadiusKm !== undefined) set('travel_radius_km = ?', dto.travelRadiusKm);
      if (dto.skippedSteps !== undefined) set('skipped_steps = ?', dto.skippedSteps);
      if (dto.complete) sets.push('completed_at = COALESCE(completed_at, now())');
      if (sets.length) await this.db.query(`UPDATE onboarding_profiles SET ${sets.join(', ')} WHERE user_id = $1`, params, c);

      const replace = async (table: string, col: string, values: string[] | undefined) => {
        if (values === undefined) return;
        await this.db.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId], c);
        if (values.length) await this.db.query(`INSERT INTO ${table} (user_id, ${col}) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, [userId, [...new Set(values)]], c);
      };
      await replace('user_capabilities', 'capability', dto.capabilities);
      await replace('user_instruments', 'instrument', dto.instruments);
      await replace('user_genres', 'genre', dto.genres);
      await replace('user_languages', 'language_tag', dto.languages);
    });
    return this.getOnboarding(userId);
  }

  async listConsents(userId: string) {
    const rows = await this.db.query<{ consent_type: string; version: string; granted: boolean; created_at: Date }>(
      `SELECT DISTINCT ON (consent_type) consent_type, version, granted, created_at FROM consent_records
        WHERE user_id = $1 ORDER BY consent_type, created_at DESC, id DESC`,
      [userId],
    );
    return rows.map((r) => ({ consentType: r.consent_type, version: r.version, granted: r.granted, recordedAt: r.created_at.toISOString() }));
  }

  async recordConsent(userId: string, dto: ConsentDto, meta: ClientMeta) {
    await this.db.query(
      `INSERT INTO consent_records (user_id, consent_type, version, granted, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, dto.consentType, this.env.PRIVACY_VERSION, dto.granted, meta.ip, meta.userAgent?.slice(0, 512) ?? null],
    );
    return this.listConsents(userId);
  }

  /**
   * Requests deletion: account is deactivated immediately (all sessions revoked) and personal data
   * is purged after a grace period by a scheduled job (Phase 2, BullMQ). Signing in again cancels.
   */
  async requestDeletion(userId: string, password: string | undefined, meta: ClientMeta) {
    if (await this.auth.hasPassword(userId)) {
      if (!password || !(await this.auth.verifyPassword(userId, password))) throw AppError.unauthorized('auth.invalid_credentials');
    }
    await this.db.tx(async (c) => {
      await this.db.query(`UPDATE users SET status = 'pending_deletion', deletion_requested_at = now() WHERE id = $1`, [userId], c);
      await this.sessions.revokeAllForUser(userId, 'account_deleted', c);
      await this.audit.record({ actorUserId: userId, actorType: 'user', action: 'user.deletion_requested', targetType: 'user', targetId: userId, metadata: { graceDays: DELETION_GRACE_DAYS }, ip: meta.ip, requestId: meta.requestId }, c);
    });
    return { status: 'pending_deletion' as const, purgeAfter: new Date(Date.now() + DELETION_GRACE_DAYS * 86_400_000).toISOString() };
  }
}
