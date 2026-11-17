'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from './i18n-provider';
import { sessionTokenStore } from '@/lib/api';

export function AuthButton() {
  const { locale, t } = useI18n();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const sync = () => setSignedIn(!!sessionTokenStore.get());
    sync();
    window.addEventListener('buj-session', sync);
    return () => window.removeEventListener('buj-session', sync);
  }, []);
  return signedIn ? (
    <Link className="btn btn-secondary" href={`/${locale}/dashboard`}>{t('nav.profile')}</Link>
  ) : (
    <Link className="btn btn-primary" href={`/${locale}/sign-in`}>{t('auth.signIn')}</Link>
  );
}
