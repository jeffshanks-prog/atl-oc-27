import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp, useActiveScheme } from '@/state/store';
import { onQueueChange, queueSize } from '@/offline/queue';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Game Caller', short: 'Call', icon: '🧠' },
  { to: '/playbook', label: 'Playbook', short: 'Playbook', icon: '🏈' },
  { to: '/favorites', label: 'Favorites', short: 'Favs', icon: '❤️' },
  { to: '/schemes', label: 'Schemes', short: 'Schemes', icon: '🧩' },
  { to: '/game-plan', label: 'Game Plan', short: 'Plan', icon: '📋' },
  { to: '/stats', label: 'Stats', short: 'Stats', icon: '📊' },
];

/** Original mark: a laces-and-chevron football glyph (no team or league artwork). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#e11d2e" />
      <ellipse cx="24" cy="24" rx="15" ry="9.5" transform="rotate(-35 24 24)" fill="#0b0b0c" />
      <path d="M17.5 27.5l13-9" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 21.6l2 2.8M23.6 19.8l2 2.8M26.2 18l2 2.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true); const b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

export function Layout({ children }: { children: ReactNode }) {
  const scheme = useActiveScheme();
  const isAdmin = useApp((s) => s.profile?.isAdmin);
  const toasts = useApp((s) => s.toasts);
  const online = useOnline();
  const nav = useNavigate();
  const [pending, setPending] = useState(0);
  useEffect(() => { void queueSize().then(setPending); return onQueueChange(setPending); }, []);

  return (
    <div className="min-h-screen bg-ink text-white">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-3 py-2 sm:px-5">
          <button onClick={() => nav('/')} className="flex items-center gap-2" aria-label="Home">
            <Logo className="h-9 w-9" />
            <div className="text-left leading-none">
              <div className="font-display text-lg font-bold tracking-wider">ATL OC 27</div>
              <div className="max-w-[46vw] truncate text-[10px] font-semibold uppercase tracking-wider text-mute sm:max-w-none">
                Active scheme: <span className="text-white">{scheme?.name ?? '—'}</span>
              </div>
            </div>
          </button>
          <nav className="ml-6 hidden gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-wide', isActive ? 'bg-red text-white' : 'text-mute hover:bg-slate2 hover:text-white')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {(!online || pending > 0) && (
              <span className={cx('rounded-full px-2 py-1 text-[10px] font-bold uppercase', online ? 'bg-amber-950 text-amber-300' : 'bg-red-soft text-red')}>
                {online ? `Syncing ${pending}` : `Offline${pending ? ` · ${pending} queued` : ''}`}
              </span>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={({ isActive }) => cx('hidden rounded-lg px-3 py-2 text-xs font-bold uppercase sm:block', isActive ? 'bg-slate2' : 'text-mute hover:text-white')}>Admin</NavLink>
            )}
            <NavLink to="/account" className="grid h-9 w-9 place-items-center rounded-full border border-line text-sm text-mute hover:text-white" aria-label="Account">👤</NavLink>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-3 pb-28 pt-4 sm:px-5 lg:pb-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Primary">
        <div className="grid grid-cols-6">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => cx('flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide', isActive ? 'text-red' : 'text-mute')}>
              <span className="text-xl leading-none">{n.icon}</span>
              {n.short}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 lg:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} className={cx('rounded-full px-4 py-2 text-sm font-semibold shadow-lg', t.tone === 'warn' ? 'bg-amber-500 text-black' : 'bg-white text-black')}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}
