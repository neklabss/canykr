import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTVerifyGetKey } from 'jose';
import { ENV, Env } from '../../config/env';
import { AppError } from '../../common/app-error';

export type SocialProvider = 'google' | 'apple';

export interface VerifiedIdentity {
  provider: SocialProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
}

/** JWKS resolvers per provider. Overridable in tests with a local key set (no network). */
export const OIDC_KEYS = Symbol('OIDC_KEYS');
export type OidcKeyResolvers = Record<SocialProvider, JWTVerifyGetKey>;

export function remoteOidcKeys(): OidcKeyResolvers {
  return {
    google: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),
    apple: createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),
  };
}

const ISSUERS: Record<SocialProvider, string[]> = {
  google: ['https://accounts.google.com', 'accounts.google.com'],
  apple: ['https://appleid.apple.com'],
};

/**
 * Verifies ID tokens issued to our own OAuth clients (signature via provider JWKS, issuer, audience,
 * expiry, optional nonce). The client performs the OAuth/PKCE dance; the API never sees passwords.
 */
@Injectable()
export class OidcVerifier {
  constructor(@Inject(ENV) private readonly env: Env, @Inject(OIDC_KEYS) private readonly keys: OidcKeyResolvers) {}

  async verify(provider: SocialProvider, idToken: string, rawNonce?: string): Promise<VerifiedIdentity> {
    const audience = provider === 'google' ? this.env.GOOGLE_CLIENT_IDS : this.env.APPLE_CLIENT_IDS;
    if (audience.length === 0) throw new AppError('auth.provider_not_configured', 404);
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(idToken, this.keys[provider], { issuer: ISSUERS[provider], audience, algorithms: ['RS256', 'ES256'] }));
    } catch {
      throw AppError.unauthorized('auth.token_invalid');
    }
    if (rawNonce !== undefined) {
      const hashed = createHash('sha256').update(rawNonce).digest('hex');
      if (payload.nonce !== rawNonce && payload.nonce !== hashed) throw AppError.unauthorized('auth.token_invalid');
    }
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (typeof payload.sub !== 'string') throw AppError.unauthorized('auth.token_invalid');
    return { provider, subject: payload.sub, email, emailVerified };
  }
}
