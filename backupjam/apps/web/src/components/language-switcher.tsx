'use client';
import { usePathname, useRouter } from 'next/navigation';
import { LOCALES } from '@backupjam/i18n/negotiation';
import { useI18n } from './i18n-provider';
import { apiFor, sessionTokenStore } from '@/lib/api';
import { LOCALE_COOKIE } from '@/lib/site';

/** Manual override: persisted in a cookie (anonymous) and on the account (signed in → all devices). */
export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  async function change(next: string) {
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;
    if (sessionTokenStore.get()) await apiFor(next).me.preferences({ locale: next }).catch(() => undefined);
    const rest = pathname.split('/').slice(2).join('/');
    router.push(`/${next}${rest ? `/${rest}` : ''}`);
  }

  return (
    <label>
      <span className="visually-hidden">{t('settings.language')}</span>
      <select className="input" style={{ minHeight: 40, width: 'auto' }} value={locale} onChange={(e) => change(e.target.value)} aria-label={t('settings.language')}>
        {LOCALES.map((l) => (
          <option key={l.tag} value={l.tag} lang={l.tag}>{l.nativeName}</option>
        ))}
      </select>
    </label>
  );
}
