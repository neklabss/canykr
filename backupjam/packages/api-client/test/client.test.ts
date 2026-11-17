import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, memoryTokenStore } from '../src';

const tokens = (n: number) => ({ accessToken: `a${n}`, refreshToken: `r${n}`, accessTokenExpiresAt: '', refreshTokenExpiresAt: '', sessionId: 's' });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('api client', () => {
  it('sends locale + bearer headers and maps error envelopes', async () => {
    const fetch = vi.fn(async () => json(403, { error: { code: 'forbidden', message: 'Bu işlem için iznin yok.' }, requestId: 'rq' }));
    const c = createApiClient({ baseUrl: 'http://api', tokens: memoryTokenStore(tokens(1)), locale: () => 'tr', fetch: fetch as unknown as typeof globalThis.fetch });
    const err = await c.me.get().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'forbidden', message: 'Bu işlem için iznin yok.', requestId: 'rq' });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer a1', 'X-BUJ-Locale': 'tr' });
  });

  it('refreshes once for concurrent 401s and retries', async () => {
    let refreshCalls = 0;
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/v1/auth/refresh')) { refreshCalls++; return json(200, tokens(2)); }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer a2' ? json(200, { id: 'u' }) : json(401, { error: { code: 'auth.token_invalid', message: 'x' } });
    });
    const store = memoryTokenStore(tokens(1));
    const c = createApiClient({ baseUrl: 'http://api', tokens: store, fetch: fetch as unknown as typeof globalThis.fetch });
    const results = await Promise.all([c.me.get(), c.me.get(), c.me.get()]);
    expect(results).toEqual([{ id: 'u' }, { id: 'u' }, { id: 'u' }]);
    expect(refreshCalls).toBe(1);
    expect(store.get()?.accessToken).toBe('a2');
  });

  it('clears tokens and notifies when refresh fails', async () => {
    const onSessionExpired = vi.fn();
    const fetch = vi.fn(async () => json(401, { error: { code: 'auth.refresh_reused', message: 'x' } }));
    const store = memoryTokenStore(tokens(1));
    const c = createApiClient({ baseUrl: 'http://api', tokens: store, fetch: fetch as unknown as typeof globalThis.fetch, onSessionExpired });
    await expect(c.me.get()).rejects.toMatchObject({ status: 401 });
    expect(store.get()).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });
});
