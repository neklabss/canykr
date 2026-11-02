import type {
  ApiErrorBody, AuthResponse, AuthTokens, CountryDto, LocaleDto, MeDto, MembershipDto, OnboardingDto, OrganizationDto,
  PreferencesDto, SessionDto, UserCapability, OrganizationType, OrgRole,
} from '@backupjam/api-contract';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown, public readonly requestId?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Where tokens live is the host app's decision (memory + httpOnly cookie on web, secure storage on mobile). */
export interface TokenStore {
  get(): AuthTokens | null;
  set(tokens: AuthTokens | null): void;
}

export interface ApiClientOptions {
  baseUrl: string;
  tokens: TokenStore;
  /** Current UI locale; sent as X-BUJ-Locale so errors and emails match the UI. */
  locale?: () => string | undefined;
  fetch?: typeof fetch;
  onSessionExpired?: () => void;
}

type Json = Record<string, unknown> | unknown[] | undefined;

export function createApiClient(opts: ApiClientOptions) {
  const f = opts.fetch ?? globalThis.fetch.bind(globalThis);
  let refreshing: Promise<boolean> | null = null;

  async function raw<T>(method: string, path: string, body?: Json, auth = true): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const locale = opts.locale?.();
    if (locale) headers['X-BUJ-Locale'] = locale;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const tokens = opts.tokens.get();
    if (auth && tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    const res = await f(`${opts.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 204 || res.status === 304) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as unknown;
    if (!res.ok) {
      const err = (data as ApiErrorBody).error ?? { code: 'internal', message: res.statusText };
      throw new ApiError(res.status, err.code, err.message, err.details, (data as ApiErrorBody).requestId);
    }
    return data as T;
  }

  /** Single-flight refresh: concurrent 401s share one rotation (refresh tokens are single-use). */
  async function refresh(): Promise<boolean> {
    const current = opts.tokens.get();
    if (!current) return false;
    refreshing ??= raw<AuthTokens>('POST', '/v1/auth/refresh', { refreshToken: current.refreshToken }, false)
      .then((t) => { opts.tokens.set(t); return true; })
      .catch(() => { opts.tokens.set(null); opts.onSessionExpired?.(); return false; })
      .finally(() => { refreshing = null; });
    return refreshing;
  }

  async function call<T>(method: string, path: string, body?: Json): Promise<T> {
    try {
      return await raw<T>(method, path, body);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && opts.tokens.get() && (await refresh())) return raw<T>(method, path, body);
      throw e;
    }
  }

  const authed = async (p: Promise<AuthResponse>) => { const r = await p; opts.tokens.set(r.tokens); return r; };

  return {
    raw: call,
    auth: {
      register: (b: { email: string; password: string; displayName: string; acceptTerms: boolean; locale?: string; countryCode?: string; timeZone?: string; capabilities?: UserCapability[]; marketingEmails?: boolean; deviceName?: string }) =>
        authed(raw<AuthResponse>('POST', '/v1/auth/register', b, false)),
      login: (b: { email: string; password: string; deviceName?: string }) => authed(raw<AuthResponse>('POST', '/v1/auth/login', b, false)),
      social: (provider: 'google' | 'apple', b: { idToken: string; nonce?: string; displayName?: string; acceptTerms?: boolean; locale?: string }) =>
        authed(raw<AuthResponse & { isNewUser: boolean }>('POST', `/v1/auth/oauth/${provider}`, b, false)),
      logout: async () => { try { await call<void>('POST', '/v1/auth/logout'); } finally { opts.tokens.set(null); } },
      verifyEmail: (token: string) => raw<void>('POST', '/v1/auth/verify-email', { token }, false),
      resendVerification: () => call<{ accepted: boolean }>('POST', '/v1/auth/verify-email/resend'),
      forgotPassword: (email: string) => raw<{ accepted: boolean }>('POST', '/v1/auth/password/forgot', { email }, false),
      resetPassword: (token: string, newPassword: string) => raw<void>('POST', '/v1/auth/password/reset', { token, newPassword }, false),
      sessions: () => call<SessionDto[]>('GET', '/v1/auth/sessions'),
      revokeSession: (id: string) => call<void>('DELETE', `/v1/auth/sessions/${encodeURIComponent(id)}`),
    },
    me: {
      get: () => call<MeDto>('GET', '/v1/me'),
      update: (b: { displayName?: string; username?: string }) => call<MeDto>('PATCH', '/v1/me', b),
      preferences: (b: Partial<Omit<PreferencesDto, 'effectiveLocale'>>) => call<MeDto>('PUT', '/v1/me/preferences', b),
      capabilities: (capabilities: UserCapability[]) => call<MeDto>('PUT', '/v1/me/capabilities', { capabilities }),
      onboarding: () => call<OnboardingDto>('GET', '/v1/me/onboarding'),
      saveOnboarding: (b: Partial<OnboardingDto> & { complete?: boolean }) => call<OnboardingDto>('PUT', '/v1/me/onboarding', b as Json),
      requestDeletion: (password?: string) => call<{ status: string; purgeAfter: string }>('DELETE', '/v1/me', { password }),
    },
    organizations: {
      create: (b: { type: OrganizationType; name: string; slug: string; countryCode?: string; city?: string }) => call<OrganizationDto>('POST', '/v1/organizations', b),
      mine: () => call<OrganizationDto[]>('GET', '/v1/organizations/mine'),
      invitations: () => call<OrganizationDto[]>('GET', '/v1/organizations/invitations'),
      bySlug: (slug: string) => raw<OrganizationDto>('GET', `/v1/organizations/by-slug/${encodeURIComponent(slug)}`, undefined, false),
      members: (id: string) => call<MembershipDto[]>('GET', `/v1/organizations/${id}/members`),
      invite: (id: string, b: { email: string; role: OrgRole; title?: string }) => call<MembershipDto[]>('POST', `/v1/organizations/${id}/members`, b),
      accept: (id: string) => call<void>('POST', `/v1/organizations/${id}/invitation/accept`),
      decline: (id: string) => call<void>('POST', `/v1/organizations/${id}/invitation/decline`),
    },
    reference: {
      locales: () => raw<LocaleDto[]>('GET', '/v1/i18n/locales', undefined, false),
      countries: () => raw<CountryDto[]>('GET', '/v1/reference/countries', undefined, false),
      currencies: () => raw<Array<{ code: string; exponent: number; name: string }>>('GET', '/v1/reference/currencies', undefined, false),
      flags: (country?: string) => raw<Record<string, boolean>>('GET', `/v1/reference/feature-flags${country ? `?country=${encodeURIComponent(country)}` : ''}`, undefined, false),
    },
    admin: {
      overview: () => call<Record<string, number>>('GET', '/v1/admin/overview'),
      users: (q: { q?: string; status?: string; cursor?: string; limit?: number } = {}) => {
        const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
        return call<{ items: Array<{ id: string; email: string | null; displayName: string; status: string; emailVerified: boolean; countryCode: string | null; locale: string | null; staffRole: string | null; createdAt: string }>; nextCursor: string | null }>('GET', `/v1/admin/users?${qs}`);
      },
      suspend: (id: string, reason: string) => call<void>('POST', `/v1/admin/users/${id}/suspend`, { reason }),
      unsuspend: (id: string) => call<void>('POST', `/v1/admin/users/${id}/unsuspend`),
      auditLogs: (q: { action?: string; beforeId?: number; limit?: number } = {}) => {
        const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
        return call<Array<{ id: number; actorUserId: string | null; actorType: string; action: string; targetType: string | null; targetId: string | null; metadata: unknown; createdAt: string }>>('GET', `/v1/admin/audit-logs?${qs}`);
      },
      flags: () => call<Array<{ key: string; description: string; enabled: boolean; rules: Record<string, unknown>; updatedAt: string }>>('GET', '/v1/admin/feature-flags'),
      setFlag: (key: string, enabled: boolean, rules?: Record<string, unknown>) => call('PUT', `/v1/admin/feature-flags/${encodeURIComponent(key)}`, { enabled, rules }),
      countries: () => call<Array<{ code: string; defaultCurrency: string; defaultLocale: string; launchStatus: string; paymentsEnabled: boolean; paymentProvider: string | null }>>('GET', '/v1/admin/countries'),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function memoryTokenStore(initial: AuthTokens | null = null): TokenStore {
  let t = initial;
  return { get: () => t, set: (v) => { t = v; } };
}
