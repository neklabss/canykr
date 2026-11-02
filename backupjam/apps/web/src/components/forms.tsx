'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@backupjam/api-client';
import type { MeDto } from '@backupjam/api-contract';
import { useI18n } from './i18n-provider';
import { apiFor, sessionTokenStore } from '@/lib/api';

function useApi() {
  const { locale } = useI18n();
  return apiFor(locale);
}

function ErrorNotice({ error }: { error: string | null }) {
  return error ? <p className="notice error" role="alert">{error}</p> : null;
}

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function SignInForm() {
  const { t, locale } = useI18n();
  const api = useApi();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try {
      await api.auth.login({ email: String(f.get('email')), password: String(f.get('password')), deviceName: 'Web' });
      router.push(`/${locale}/dashboard`);
    } catch (err) { setError(message(err, t('states.errorBody'))); } finally { setBusy(false); }
  }
  return (
    <form className="form" method="post" onSubmit={submit} noValidate>
      <h1>{t('auth.signIn')}</h1>
      <ErrorNotice error={error} />
      <div className="field"><label htmlFor="email">{t('auth.email')}</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">{t('auth.password')}</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <button className="btn btn-primary" disabled={busy} type="submit">{t('auth.signIn')}</button>
      <Link href={`/${locale}/forgot-password`}>{t('auth.forgotPassword')}</Link>
      <p className="divider">{t('auth.noAccount')}</p>
      <Link className="btn btn-secondary" href={`/${locale}/sign-up`}>{t('auth.signUp')}</Link>
    </form>
  );
}

export function SignUpForm() {
  const { t, locale } = useI18n();
  const api = useApi();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try {
      await api.auth.register({
        email: String(f.get('email')), password: String(f.get('password')), displayName: String(f.get('displayName')),
        acceptTerms: f.get('acceptTerms') === 'on', marketingEmails: false, deviceName: 'Web',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      router.push(`/${locale}/dashboard`);
    } catch (err) { setError(message(err, t('states.errorBody'))); } finally { setBusy(false); }
  }
  return (
    <form className="form" method="post" onSubmit={submit} noValidate>
      <h1>{t('auth.signUp')}</h1>
      <ErrorNotice error={error} />
      <div className="field"><label htmlFor="displayName">{t('auth.displayName')}</label><input className="input" id="displayName" name="displayName" autoComplete="nickname" maxLength={80} required /></div>
      <div className="field"><label htmlFor="email">{t('auth.email')}</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">{t('auth.password')}</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required aria-describedby="pw-hint" /><small id="pw-hint">{t('auth.passwordHint')}</small></div>
      <label className="checkbox"><input type="checkbox" name="acceptTerms" required /><span>{t('auth.acceptTerms')} <Link href={`/${locale}/legal/terms`}>{t('legal.terms')}</Link> · <Link href={`/${locale}/legal/privacy`}>{t('legal.privacy')}</Link></span></label>
      <button className="btn btn-primary" disabled={busy} type="submit">{t('auth.signUp')}</button>
      <p className="divider">{t('auth.haveAccount')}</p>
      <Link className="btn btn-secondary" href={`/${locale}/sign-in`}>{t('auth.signIn')}</Link>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const api = useApi();
  const [sent, setSent] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await api.auth.forgotPassword(String(new FormData(e.currentTarget).get('email'))).catch(() => undefined);
    setSent(true);
  }
  return (
    <form className="form" method="post" onSubmit={submit}>
      <h1>{t('auth.resetPassword')}</h1>
      {sent ? <p className="notice" role="status">{t('auth.resetLinkSent')}</p> : null}
      <div className="field"><label htmlFor="email">{t('auth.email')}</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
      <button className="btn btn-primary" type="submit">{t('auth.resetPassword')}</button>
    </form>
  );
}

export function ResetPasswordForm() {
  const { t, locale } = useI18n();
  const api = useApi();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<{ done?: boolean; error?: string }>({});
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await api.auth.resetPassword(token, String(new FormData(e.currentTarget).get('password')));
      setState({ done: true });
    } catch (err) { setState({ error: message(err, t('states.errorBody')) }); }
  }
  if (state.done) return <p className="notice" role="status">{t('auth.resetPasswordSuccess')} <Link href={`/${locale}/sign-in`}>{t('auth.signIn')}</Link></p>;
  return (
    <form className="form" method="post" onSubmit={submit}>
      <h1>{t('auth.resetPassword')}</h1>
      <ErrorNotice error={state.error ?? null} />
      <div className="field"><label htmlFor="password">{t('auth.newPassword')}</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /><small>{t('auth.passwordHint')}</small></div>
      <button className="btn btn-primary" type="submit">{t('auth.resetPassword')}</button>
    </form>
  );
}

export function VerifyEmail() {
  const { t, locale } = useI18n();
  const api = useApi();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending');
  const [err, setErr] = useState('');
  useEffect(() => {
    api.auth.verifyEmail(token).then(() => setState('ok')).catch((e) => { setErr(message(e, t('states.errorBody'))); setState('error'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  if (state === 'pending') return <p role="status">{t('states.loading')}</p>;
  if (state === 'error') return <p className="notice error" role="alert">{err}</p>;
  return <p className="notice" role="status">{t('auth.verifyEmailSuccess')} <Link href={`/${locale}/dashboard`}>{t('nav.profile')}</Link></p>;
}

function useMe() {
  const api = useApi();
  const { locale } = useI18n();
  const router = useRouter();
  const [me, setMe] = useState<MeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!sessionTokenStore.get()) { router.replace(`/${locale}/sign-in`); return; }
    api.me.get().then(setMe).catch((e) => setError(message(e, '')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { me, setMe, error, api };
}

export function Dashboard() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { me, error, api } = useMe();
  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (!me) return <p role="status">{t('states.loading')}</p>;
  return (
    <section>
      <h1>{t('dashboard.welcome', { name: me.displayName })}</h1>
      {!me.emailVerified ? (
        <p className="notice" role="status">{t('dashboard.verifyEmailBanner')} <button className="btn btn-secondary" onClick={() => api.auth.resendVerification()}>{t('auth.resendVerification')}</button></p>
      ) : null}
      <div className="grid" style={{ marginBottom: 24 }}>
        {(['create.job', 'create.service', 'create.band', 'create.event', 'create.venue', 'create.challenge'] as const).map((k) => (
          <div className="card" key={k}><h3>{t(k)}</h3><p>{t('common.comingSoon')}</p></div>
        ))}
      </div>
      <div className="hero-actions">
        <Link className="btn btn-secondary" href={`/${locale}/settings`}>{t('nav.settings')}</Link>
        <button className="btn btn-secondary" onClick={async () => { await api.auth.logout(); router.push(`/${locale}`); }}>{t('auth.signOut')}</button>
      </div>
    </section>
  );
}

/** Language, country (market) and display currency are separate settings. */
export function SettingsForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { me, setMe, error, api } = useMe();
  const [countries, setCountries] = useState<Array<{ code: string; name: string; defaultCurrency: string }>>([]);
  const [currencies, setCurrencies] = useState<Array<{ code: string; name: string }>>([]);
  const [locales, setLocales] = useState<Array<{ tag: string; nativeName: string }>>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api.reference.countries().then(setCountries).catch(() => undefined);
    api.reference.currencies().then(setCurrencies).catch(() => undefined);
    api.reference.locales().then(setLocales).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (!me) return <p role="status">{t('states.loading')}</p>;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nextLocale = String(f.get('locale')) || null;
    const updated = await api.me.preferences({
      locale: nextLocale, countryCode: String(f.get('country')) || null, currencyCode: String(f.get('currency')) || null,
      theme: String(f.get('theme')) as MeDto['preferences']['theme'],
    });
    setMe(updated);
    setSaved(true);
    document.documentElement.dataset.theme = updated.preferences.theme === 'system' ? '' : updated.preferences.theme;
    if (updated.preferences.effectiveLocale !== locale) router.push(`/${updated.preferences.effectiveLocale}/settings`);
  }
  const p = me.preferences;
  return (
    <form className="form" method="post" onSubmit={submit}>
      <h1>{t('nav.settings')}</h1>
      {saved ? <p className="notice" role="status">{t('common.saved')}</p> : null}
      <div className="field"><label htmlFor="locale">{t('settings.language')}</label>
        <select className="input" id="locale" name="locale" defaultValue={p.locale ?? ''}>
          <option value="">{t('settings.languageAuto')}</option>
          {locales.map((l) => <option key={l.tag} value={l.tag} lang={l.tag}>{l.nativeName}</option>)}
        </select></div>
      <div className="field"><label htmlFor="country">{t('settings.country')}</label>
        <select className="input" id="country" name="country" defaultValue={p.countryCode ?? ''}>
          <option value="">—</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor="currency">{t('settings.currency')}</label>
        <select className="input" id="currency" name="currency" defaultValue={p.currencyCode ?? ''}>
          <option value="">—</option>
          {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
        </select>
        <small>{t('price.convertedNotice', { currency: p.currencyCode ?? '—' })}</small></div>
      <div className="field"><label htmlFor="theme">{t('settings.theme')}</label>
        <select className="input" id="theme" name="theme" defaultValue={p.theme}>
          <option value="system">{t('settings.themeSystem')}</option>
          <option value="light">{t('settings.themeLight')}</option>
          <option value="dark">{t('settings.themeDark')}</option>
        </select></div>
      <button className="btn btn-primary" type="submit">{t('common.save')}</button>
    </form>
  );
}
