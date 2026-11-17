'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@backupjam/api-client';
import type { MeDto } from '@backupjam/api-contract';
import { STAFF_ROLE_PERMISSIONS, StaffPermission, StaffRole } from '@backupjam/api-contract';
import { useAdminI18n } from '@/lib/i18n';
import { adminApi, adminTokens } from '@/lib/api';

type Section = 'overview' | 'users' | 'audit' | 'flags' | 'countries';
const SECTIONS: Array<{ id: Section; key: string; needs: StaffPermission }> = [
  { id: 'overview', key: 'admin.overview', needs: 'admin.users.read' },
  { id: 'users', key: 'admin.users', needs: 'admin.users.read' },
  { id: 'audit', key: 'admin.auditLog', needs: 'admin.audit.read' },
  { id: 'flags', key: 'admin.featureFlags', needs: 'admin.flags.manage' },
  { id: 'countries', key: 'admin.countries', needs: 'admin.countries.manage' },
];

export default function AdminApp() {
  const [me, setMe] = useState<MeDto | null>(null);
  const { t, locale, ready } = useAdminI18n(me?.preferences.locale);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('overview');
  const api = useMemo(() => adminApi(locale, () => setMe(null)), [locale]);

  useEffect(() => {
    if (adminTokens.get()) api.me.get().then(setMe).catch(() => adminTokens.set(null));
  }, [api]);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    try {
      const r = await api.auth.login({ email: String(f.get('email')), password: String(f.get('password')), deviceName: 'Admin console' });
      if (!r.user.staffRole) { await api.auth.logout(); setError(t('admin.notStaff')); return; }
      setMe(r.user);
    } catch (err) { setError(err instanceof ApiError ? err.message : t('states.errorBody')); }
  }

  if (!ready) return <p style={{ padding: 24 }} role="status">…</p>;
  if (!me) {
    return (
      <form className="login" method="post" onSubmit={login}>
        <h1>{t('admin.title')}</h1>
        {error ? <p className="notice error" role="alert">{error}</p> : null}
        <label>{t('auth.email')}<input className="input" style={{ width: '100%' }} name="email" type="email" autoComplete="username" required /></label>
        <label>{t('auth.password')}<input className="input" style={{ width: '100%' }} name="password" type="password" autoComplete="current-password" required /></label>
        <button className="btn primary" type="submit">{t('auth.signIn')}</button>
      </form>
    );
  }
  const role = me.staffRole as StaffRole | null;
  if (!role) return <p className="notice error" role="alert">{t('admin.notStaff')}</p>;
  const allowed = SECTIONS.filter((s) => STAFF_ROLE_PERMISSIONS[role].includes(s.needs));
  const can = (p: StaffPermission) => STAFF_ROLE_PERMISSIONS[role].includes(p);

  return (
    <div className="shell">
      <nav className="side" aria-label={t('admin.title')}>
        <div className="brand"><span className="mark">BUJ</span>{t('admin.title')}</div>
        {allowed.map((s) => (
          <button key={s.id} aria-current={section === s.id ? 'page' : undefined} onClick={() => setSection(s.id)}>{t(s.key)}</button>
        ))}
        <span style={{ flex: 1 }} />
        <code style={{ padding: '0 12px' }}>{me.email} · {role}</code>
        <button onClick={async () => { await api.auth.logout(); setMe(null); }}>{t('auth.signOut')}</button>
      </nav>
      <main className="main">
        {section === 'overview' && <Overview api={api} t={t} />}
        {section === 'users' && <Users api={api} t={t} canSuspend={can('admin.users.suspend')} />}
        {section === 'audit' && can('admin.audit.read') && <Audit api={api} t={t} />}
        {section === 'flags' && can('admin.flags.manage') && <Flags api={api} t={t} />}
        {section === 'countries' && can('admin.countries.manage') && <Countries api={api} t={t} />}
      </main>
    </div>
  );
}

type Api = ReturnType<typeof adminApi>;
type T = (k: string, v?: Record<string, string | number>) => string;

function useLoad<R>(fn: () => Promise<R>) {
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => { fn().then(setData).catch((e) => setError(e instanceof ApiError ? e.message : String(e))); }, [fn]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

function Overview({ api, t }: { api: Api; t: T }) {
  const fn = useCallback(() => api.admin.overview(), [api]);
  const { data, error } = useLoad(fn);
  const nf = new Intl.NumberFormat();
  return (
    <section>
      <h1>{t('admin.overview')}</h1>
      {error ? <p className="notice error">{error}</p> : null}
      <div className="kpis">
        {Object.entries(data ?? {}).map(([k, v]) => <div className="kpi" key={k}><b>{nf.format(v)}</b><span>{t(`admin.metric.${k}`)}</span></div>)}
      </div>
    </section>
  );
}

function Users({ api, t, canSuspend }: { api: Api; t: T; canSuspend: boolean }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<Awaited<ReturnType<Api['admin']['users']>>['items']>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (append = false, c?: string | null) => {
    try {
      const r = await api.admin.users({ q, status, cursor: c ?? undefined, limit: 25 });
      setRows((prev) => (append ? [...prev, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
  }, [api, q, status]);
  useEffect(() => { void load(); }, [load]);
  async function toggle(id: string, suspended: boolean) {
    if (suspended) await api.admin.unsuspend(id);
    else {
      const reason = window.prompt(t('admin.reason'));
      if (!reason) return;
      await api.admin.suspend(id, reason);
    }
    void load();
  }
  const df = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
  return (
    <section>
      <h1>{t('admin.users')}</h1>
      {error ? <p className="notice error">{error}</p> : null}
      <div className="toolbar">
        <input className="input" placeholder={t('admin.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('admin.search')} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('admin.status')}>
          <option value="">{t('admin.status')}</option>
          {['active', 'suspended', 'pending_deletion'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <table>
        <thead><tr><th>{t('auth.displayName')}</th><th>{t('auth.email')}</th><th>{t('admin.status')}</th><th>{t('settings.country')}</th><th>{t('settings.language')}</th><th /></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>{u.displayName}{u.staffRole ? <> <span className="pill">{u.staffRole}</span></> : null}<br /><code>{df.format(new Date(u.createdAt))}</code></td>
              <td>{u.email}{u.emailVerified ? ' ✓' : ''}</td>
              <td><span className={`pill ${u.status}`}>{u.status}</span></td>
              <td>{u.countryCode ?? '—'}</td>
              <td>{u.locale ?? 'auto'}</td>
              <td>{canSuspend && u.status !== 'deleted' ? <button className={`btn ${u.status === 'suspended' ? '' : 'danger'}`} onClick={() => toggle(u.id, u.status === 'suspended')}>{u.status === 'suspended' ? t('admin.unsuspend') : t('admin.suspend')}</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cursor ? <p><button className="btn" onClick={() => load(true, cursor)}>{t('admin.loadMore')}</button></p> : null}
    </section>
  );
}

function Audit({ api, t }: { api: Api; t: T }) {
  const fn = useCallback(() => api.admin.auditLogs({ limit: 100 }), [api]);
  const { data, error } = useLoad(fn);
  const df = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' });
  return (
    <section>
      <h1>{t('admin.auditLog')}</h1>
      {error ? <p className="notice error">{error}</p> : null}
      <table>
        <thead><tr><th>#</th><th>{t('admin.col.action')}</th><th>{t('admin.col.actor')}</th><th>{t('admin.col.target')}</th><th>{t('admin.col.metadata')}</th></tr></thead>
        <tbody>{(data ?? []).map((a) => (
          <tr key={a.id}><td><code>{a.id}</code><br /><code>{df.format(new Date(a.createdAt))}</code></td><td><code>{a.action}</code></td><td><code>{a.actorType}</code><br /><code>{a.actorUserId?.slice(0, 8)}</code></td><td><code>{a.targetType}:{a.targetId?.slice(0, 12)}</code></td><td><code>{JSON.stringify(a.metadata)}</code></td></tr>
        ))}</tbody>
      </table>
    </section>
  );
}

function Flags({ api, t }: { api: Api; t: T }) {
  const fn = useCallback(() => api.admin.flags(), [api]);
  const { data, error, reload } = useLoad(fn);
  return (
    <section>
      <h1>{t('admin.featureFlags')}</h1>
      {error ? <p className="notice error">{error}</p> : null}
      <table>
        <thead><tr><th>{t('admin.col.key')}</th><th>{t('admin.col.description')}</th><th>{t('admin.col.rules')}</th><th>{t('admin.status')}</th></tr></thead>
        <tbody>{(data ?? []).map((f) => (
          <tr key={f.key}><td><code>{f.key}</code></td><td>{f.description}</td><td><code>{JSON.stringify(f.rules)}</code></td>
            <td><label><input type="checkbox" checked={f.enabled} onChange={async (e) => { await api.admin.setFlag(f.key, e.target.checked); reload(); }} /> {f.enabled ? '●' : '○'}</label></td></tr>
        ))}</tbody>
      </table>
    </section>
  );
}

function Countries({ api, t }: { api: Api; t: T }) {
  const fn = useCallback(() => api.admin.countries(), [api]);
  const { data, error } = useLoad(fn);
  const names = new Intl.DisplayNames(undefined, { type: 'region' });
  return (
    <section>
      <h1>{t('admin.countries')}</h1>
      {error ? <p className="notice error">{error}</p> : null}
      <table>
        <thead><tr><th>{t('settings.country')}</th><th>{t('settings.currency')}</th><th>{t('settings.language')}</th><th>{t('admin.col.launch')}</th><th>{t('admin.col.payments')}</th></tr></thead>
        <tbody>{(data ?? []).map((c) => (
          <tr key={c.code}><td>{names.of(c.code)} <code>{c.code}</code></td><td>{c.defaultCurrency}</td><td>{c.defaultLocale}</td><td><span className="pill">{c.launchStatus}</span></td><td>{c.paymentsEnabled ? c.paymentProvider : '—'}</td></tr>
        ))}</tbody>
      </table>
    </section>
  );
}
