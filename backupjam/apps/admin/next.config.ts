import type { NextConfig } from 'next';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Internal staff tool: never indexed, never framed, strict CSP. Deploy behind SSO/VPN in production. */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Content-Security-Policy', value: `default-src 'self'; connect-src 'self' ${api}; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
      ],
    }];
  },
};
export default nextConfig;
