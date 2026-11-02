import type { Request } from 'express';
import { negotiateLocale, parseAcceptLanguage } from '@backupjam/i18n';

export interface AuthContext {
  userId: string;
  sessionId: string;
  /** Explicit locale preference stored on the account (null = automatic). */
  localePreference: string | null;
}

export interface AppRequest extends Request {
  auth?: AuthContext;
}

/** Effective UI locale for this request: account preference → X-BUJ-Locale → Accept-Language → en. */
export function requestLocale(req: AppRequest): string {
  const header = req.headers['x-buj-locale'];
  const explicit = typeof header === 'string' ? header : undefined;
  return negotiateLocale({
    userPreference: req.auth?.localePreference ?? explicit,
    preferred: parseAcceptLanguage(req.headers['accept-language']),
  });
}

export function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

export function requestId(req: AppRequest): string | null {
  return req.id !== undefined ? String(req.id) : null;
}
