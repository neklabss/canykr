import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import type { Response } from 'express';
import { getMessages, isRtl, LOCALES, negotiateLocale, parseAcceptLanguage, resolveLocale } from '@backupjam/i18n';
import type { CountryDto, LocaleDto } from '@backupjam/api-contract';
import { Db } from '../../database/db';
import { Public, Req } from '../../common/decorators';
import { AppError } from '../../common/app-error';
import { AppRequest, requestLocale } from '../../common/request-context';

@ApiTags('i18n')
@Controller('v1/i18n')
export class I18nController {
  @Public() @Get('locales') @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'UI locales with completeness status (machine_draft = awaiting native review)' })
  locales(): LocaleDto[] {
    return LOCALES.map(({ tag, name, nativeName, dir, status }) => ({ tag, name, nativeName, dir, status }));
  }

  @Public() @Get('negotiate')
  @ApiQuery({ name: 'preferred', required: false, description: 'Comma-separated BCP-47 tags; defaults to Accept-Language' })
  negotiate(@Req() req: AppRequest, @Query('preferred') preferred?: string) {
    const list = preferred ? preferred.split(',') : parseAcceptLanguage(req.headers['accept-language']);
    const locale = negotiateLocale({ preferred: list });
    return { locale, dir: isRtl(locale) ? 'rtl' : 'ltr' };
  }

  @Public() @Get('messages/:locale')
  @ApiOperation({ summary: 'Merged message catalog (locale over English fallback) with ETag' })
  messages(@Param('locale') locale: string, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const resolved = resolveLocale(locale);
    const body = { locale: resolved, dir: isRtl(resolved) ? 'rtl' : 'ltr', messages: getMessages(resolved) };
    const etag = `"${createHash('sha1').update(JSON.stringify(body)).digest('base64url')}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (req.headers['if-none-match'] === etag) {
      res.status(304);
      return undefined;
    }
    return body;
  }
}

@ApiTags('reference')
@Controller('v1/reference')
export class ReferenceController {
  constructor(private readonly db: Db) {}

  @Public() @Get('countries')
  @ApiOperation({ summary: 'Countries with localized names (Intl.DisplayNames) and launch status' })
  async countries(@Req() req: AppRequest): Promise<CountryDto[]> {
    const locale = requestLocale(req);
    const names = new Intl.DisplayNames([locale, 'en'], { type: 'region' });
    const rows = await this.db.query<{ code: string; default_currency: string; default_locale: string; launch_status: CountryDto['launchStatus']; payments_enabled: boolean }>(
      `SELECT code, default_currency, default_locale, launch_status, payments_enabled FROM countries`,
    );
    const collator = new Intl.Collator(locale);
    return rows
      .map((r) => ({ code: r.code, name: names.of(r.code) ?? r.code, defaultCurrency: r.default_currency, defaultLocale: r.default_locale, launchStatus: r.launch_status, paymentsEnabled: r.payments_enabled }))
      .sort((a, b) => collator.compare(a.name, b.name));
  }

  @Public() @Get('currencies')
  async currencies(@Req() req: AppRequest) {
    const names = new Intl.DisplayNames([requestLocale(req), 'en'], { type: 'currency' });
    const rows = await this.db.query<{ code: string; exponent: number }>(`SELECT code, exponent FROM currencies WHERE active ORDER BY code`);
    return rows.map((r) => ({ code: r.code, exponent: r.exponent, name: names.of(r.code) ?? r.code }));
  }

  @Public() @Get('languages')
  @ApiOperation({ summary: 'Spoken-language names localized for profile "languages I speak" pickers' })
  languages(@Req() req: AppRequest, @Query('tags') tags?: string) {
    const names = new Intl.DisplayNames([requestLocale(req), 'en'], { type: 'language' });
    const list = (tags ?? 'en,tr,es,pt,fr,de,it,ar,ru,uk,hi,id,ja,ko,zh,nl,pl,sv,el,he,fa,ur,bn,sw,vi,th,ms,ro,cs,hu').split(',').slice(0, 100);
    return list.map((t) => {
      try { return { tag: t, name: names.of(t) ?? t }; } catch { throw AppError.validation([{ field: 'tags', value: t }]); }
    });
  }

  @Public() @Get('instruments') @Header('Cache-Control', 'public, max-age=3600')
  async instruments() {
    const rows = await this.db.query<{ slug: string; category: string; name_key: string; default_name: string }>(`SELECT slug, category, name_key, default_name FROM instruments ORDER BY sort_order, slug`);
    return rows.map((r) => ({ slug: r.slug, category: r.category, nameKey: r.name_key, defaultName: r.default_name }));
  }

  @Public() @Get('genres') @Header('Cache-Control', 'public, max-age=3600')
  async genres() {
    const rows = await this.db.query<{ slug: string; name_key: string; default_name: string }>(`SELECT slug, name_key, default_name FROM genres ORDER BY sort_order, slug`);
    return rows.map((r) => ({ slug: r.slug, nameKey: r.name_key, defaultName: r.default_name }));
  }

  @Public() @Get('feature-flags')
  @ApiOperation({ summary: 'Public feature flags evaluated for a country' })
  async flags(@Query('country') country?: string) {
    const rows = await this.db.query<{ key: string; enabled: boolean; rules: { countries?: string[] } }>(`SELECT key, enabled, rules FROM feature_flags ORDER BY key`);
    const cc = country?.toUpperCase();
    return Object.fromEntries(rows.map((r) => [r.key, r.enabled && (!r.rules.countries?.length || (cc !== undefined && r.rules.countries.includes(cc)))]));
  }
}
