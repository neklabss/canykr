'use client';
import { createApiClient, TokenStore } from '@backupjam/api-client';
import type { AuthTokens } from '@backupjam/api-contract';

const KEY = 'buj_admin_session';
/** Staff sessions live only for the tab (sessionStorage). Production: SSO + MFA in front (docs/16). */
export const adminTokens: TokenStore = {
  get: () => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as AuthTokens | null; } catch { return null; } },
  set: (t) => (t ? sessionStorage.setItem(KEY, JSON.stringify(t)) : sessionStorage.removeItem(KEY)),
};

export const adminApi = (locale: string, onExpired: () => void) =>
  createApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000', tokens: adminTokens, locale: () => locale, onSessionExpired: onExpired });
