import { Global, Injectable, Module } from '@nestjs/common';
import type { MeDto, PreferencesDto, StaffRole, UserCapability } from '@backupjam/api-contract';
import { negotiateLocale } from '@backupjam/i18n';
import { Db, Queryable } from '../../database/db';

interface Row {
  id: string; email: string | null; email_verified_at: Date | null; display_name: string; username: string | null;
  status: MeDto['status']; created_at: Date; locale: string | null; country_code: string | null; currency_code: string | null;
  time_zone: string | null; theme: PreferencesDto['theme'] | null; quiet_hours_start: string | null; quiet_hours_end: string | null;
  capabilities: UserCapability[] | null; staff_role: StaffRole | null;
}

/** Read model for the signed-in account (shared by auth + users modules). */
@Injectable()
export class MeQuery {
  constructor(private readonly db: Db) {}

  async get(userId: string, devicePreferred: readonly string[], client?: Queryable): Promise<MeDto | undefined> {
    const r = await this.db.one<Row>(
      `SELECT u.id, u.email, u.email_verified_at, u.display_name, u.username, u.status, u.created_at,
              p.locale, p.country_code, p.currency_code, p.time_zone, p.theme,
              to_char(p.quiet_hours_start,'HH24:MI') AS quiet_hours_start, to_char(p.quiet_hours_end,'HH24:MI') AS quiet_hours_end,
              (SELECT array_agg(capability ORDER BY capability) FROM user_capabilities c WHERE c.user_id = u.id) AS capabilities,
              (SELECT role FROM staff_members s WHERE s.user_id = u.id AND s.revoked_at IS NULL) AS staff_role
         FROM users u LEFT JOIN user_preferences p ON p.user_id = u.id
        WHERE u.id = $1`,
      [userId],
      client,
    );
    if (!r) return undefined;
    return {
      id: r.id,
      email: r.email,
      emailVerified: r.email_verified_at !== null,
      displayName: r.display_name,
      username: r.username,
      status: r.status,
      capabilities: r.capabilities ?? [],
      staffRole: r.staff_role,
      createdAt: r.created_at.toISOString(),
      preferences: {
        locale: r.locale,
        effectiveLocale: negotiateLocale({ userPreference: r.locale, preferred: devicePreferred }),
        countryCode: r.country_code,
        currencyCode: r.currency_code,
        timeZone: r.time_zone,
        theme: r.theme ?? 'system',
        quietHoursStart: r.quiet_hours_start,
        quietHoursEnd: r.quiet_hours_end,
      },
    };
  }
}

@Global()
@Module({ providers: [MeQuery], exports: [MeQuery] })
export class UsersCoreModule {}
