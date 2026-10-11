import type { ReactNode } from 'react';
import { initials, ROLE_LABELS } from './labels';
import type { Me } from './types';

export type View = 'home' | 'inventory' | 'receive' | 'production' | 'labels' | 'analytics' | 'staff';

const TITLES: Record<View, string> = {
  home: 'Главная',
  inventory: 'Склад и партии',
  receive: 'Приёмка партии',
  production: 'Производство',
  labels: 'QR и этикетки',
  analytics: 'Аналитика',
  staff: 'Сотрудники',
};

const ICONS: Record<View, string> = {
  home: 'i-home',
  inventory: 'i-box',
  receive: 'i-box',
  production: 'i-work',
  labels: 'i-tag',
  analytics: 'i-chart',
  staff: 'i-users',
};

/** Разделы, которые уже работают, и заглушки следующих этапов. */
const NAV: { view: View; ready: boolean }[] = [
  { view: 'home', ready: true },
  { view: 'inventory', ready: true },
  { view: 'production', ready: false },
  { view: 'labels', ready: false },
  { view: 'analytics', ready: false },
  { view: 'staff', ready: true },
];

export function Sprite() {
  return (
    <svg aria-hidden="true" style={{ display: 'none' }}>
      <symbol id="i-home" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></symbol>
      <symbol id="i-box" viewBox="0 0 24 24"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5M12 12 3 7m9 5v10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></symbol>
      <symbol id="i-work" viewBox="0 0 24 24"><path d="M3 21V9l6 4V9l6 4V4h4v17H3Zm3-4h2m3 0h2m3 0h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></symbol>
      <symbol id="i-tag" viewBox="0 0 24 24"><path d="M3 4h10l8 8-9 9-9-9V4Zm5 5h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></symbol>
      <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20h16M6 16v-5m5 5V5m5 11V9m4 7v-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></symbol>
      <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3 20v-2a5 5 0 0 1 10 0v2H3Zm12-14a3 3 0 0 1 0 6m1 3a4 4 0 0 1 5 4v1h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></symbol>
    </svg>
  );
}

function Icon({ id }: { id: string }) {
  return (
    <svg>
      <use href={`#${id}`} />
    </svg>
  );
}

export function Shell(props: { me: Me; view: View; go: (v: View) => void; toast: string | null; children: ReactNode }) {
  const { me, view, go } = props;
  const isAdmin = me.permissions['staff.manage'];
  const nav = NAV.filter((n) => n.view !== 'staff' || isAdmin);
  const active = view === 'receive' ? 'inventory' : view;
  const mobile: { view: View; label: string; icon: string }[] = [
    { view: 'home', label: 'Главная', icon: 'i-home' },
    { view: 'inventory', label: 'Склад', icon: 'i-box' },
    ...(me.permissions['stock.write'] ? [{ view: 'receive' as View, label: 'Приёмка', icon: 'i-plus' }] : []),
    { view: 'production', label: 'Выпуск', icon: 'i-work' },
    ...(isAdmin ? [{ view: 'staff' as View, label: 'Команда', icon: 'i-users' }] : []),
  ];
  return (
    <div className="app">
      <Sprite />
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">◈</span>SuperPack</div>
        <div className="sidebar-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav className="nav" aria-label="Разделы приложения">
          {nav.map((n) => (
            <button key={n.view} className={active === n.view ? 'active' : ''} onClick={() => go(n.view)}>
              <Icon id={ICONS[n.view]} />
              {TITLES[n.view]}
              {!n.ready && <span className="stub-tag">СКОРО</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{initials(me.displayName)}</div>
          <div>
            {me.displayName}
            <small>{ROLE_LABELS[me.role]}</small>
          </div>
        </div>
      </aside>
      <div className="main">
        <div className="mobile-top">
          <div className="brand"><span className="brand-mark">◈</span>SuperPack</div>
          <div className="avatar">{initials(me.displayName)}</div>
        </div>
        <header className="topbar">
          <div className="crumb">Цех / <strong>{TITLES[view]}</strong></div>
          <div className="topright">
            <span className="pill"><span className="dot" /> {ROLE_LABELS[me.role]}</span>
            <div className="avatar">{initials(me.displayName)}</div>
          </div>
        </header>
        <main className="content">{props.children}</main>
        <nav className="bottom-nav" aria-label="Мобильная навигация">
          {mobile.map((n) => (
            <button key={n.view} className={view === n.view ? 'active' : ''} onClick={() => go(n.view)}>
              <Icon id={n.icon} />
              {n.label}
            </button>
          ))}
        </nav>
      </div>
      <div className={'toast' + (props.toast ? ' show' : '')} role="status">{props.toast}</div>
    </div>
  );
}
