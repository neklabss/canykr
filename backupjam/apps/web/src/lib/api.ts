'use client';
import { createApiClient, TokenStore } from '@backupjam/api-client';
import type { AuthTokens } from '@backupjam/api-contract';
import { API_URL } from './site';

const KEY = 'buj_session';

/**
 * Phase 1 token store: sessionStorage (cleared when the tab closes).
 * Hardening backlog: move refresh tokens to an httpOnly, SameSite=strict cookie behind a
 * Next.js BFF route so page scripts can never read them (see docs/16-threat-model.md).
 */
export const sessionTokenStore: TokenStore = {
  get() {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null') as AuthTokens | null; } catch { return null; }
  },
  set(tokens) {
    if (typeof window === 'undefined') return;
    if (tokens) window.sessionStorage.setItem(KEY, JSON.stringify(tokens));
    else window.sessionStorage.removeItem(KEY);
    window.dispatchEvent(new Event('buj-session'));
  },
};

export function apiFor(locale: string) {
  return createApiClient({ baseUrl: API_URL, tokens: sessionTokenStore, locale: () => locale });
}
