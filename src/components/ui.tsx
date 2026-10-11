import { useEffect, type ReactNode, type ButtonHTMLAttributes } from 'react';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'red' | 'dark' | 'ghost' | 'outline'; size?: 'sm' | 'md' | 'lg' };
export function Button({ tone = 'dark', size = 'md', className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none',
        size === 'sm' && 'px-3 py-1.5 text-sm min-h-[36px]',
        size === 'md' && 'px-4 py-2.5 text-sm min-h-[44px]',
        size === 'lg' && 'px-5 py-4 text-base min-h-[56px]',
        tone === 'red' && 'bg-red text-white hover:bg-red-dark shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]',
        tone === 'dark' && 'bg-slate2 text-white hover:bg-line border border-line',
        tone === 'ghost' && 'text-mute hover:text-white hover:bg-slate2',
        tone === 'outline' && 'border border-red/60 text-white hover:bg-red-soft',
        className,
      )}
    />
  );
}

export function Chip({ active, onClick, children, className, size = 'md' }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-lg border font-semibold transition select-none',
        size === 'md' ? 'px-3 py-2 text-sm min-h-[40px]' : 'px-2 py-1 text-xs min-h-[30px]',
        active ? 'border-red bg-red text-white' : 'border-line bg-coal text-mute hover:text-white hover:border-mute/50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-coal', className)}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-mute">{children}</h3>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-mute">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Badge({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'red' | 'green' | 'amber' }) {
  return (
    <span className={cx(
      'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
      tone === 'dark' && 'bg-slate2 text-mute',
      tone === 'red' && 'bg-red-soft text-red',
      tone === 'green' && 'bg-emerald-950 text-emerald-400',
      tone === 'amber' && 'bg-amber-950 text-amber-400',
    )}>{children}</span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-coal p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-6', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-mute hover:bg-slate2 hover:text-white" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mute/80">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-white placeholder:text-mute/60 focus:border-red focus:outline-none';

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-mute">{children}</div>;
}

export function Meter({ value, max = 1, tone = 'red' }: { value: number; max?: number; tone?: 'red' | 'white' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate2">
      <div className={cx('h-full rounded-full', tone === 'red' ? 'bg-red' : 'bg-white/80')} style={{ width: `${pct}%` }} />
    </div>
  );
}
