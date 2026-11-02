import type { MetadataRoute } from 'next';
import { LOCALE_TAGS, SITE_URL } from '@/lib/site';

const PRIVATE = ['dashboard', 'settings', 'verify-email', 'reset-password', 'sign-in', 'sign-up', 'forgot-password'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: LOCALE_TAGS.flatMap((l) => PRIVATE.map((p) => `/${l}/${p}`)) }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
