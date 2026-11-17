import type { MetadataRoute } from 'next';
import { LOCALE_TAGS, PUBLIC_PATHS, SITE_URL, alternates } from '@/lib/site';

/** Public pages × locales, each with hreflang alternates. Profile/job/event URLs are added in Phase 2. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.flatMap((path) =>
    LOCALE_TAGS.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      changeFrequency: path === '' ? ('daily' as const) : ('weekly' as const),
      priority: path === '' ? 1 : 0.6,
      alternates: { languages: alternates(path, locale).languages },
    })),
  );
}
