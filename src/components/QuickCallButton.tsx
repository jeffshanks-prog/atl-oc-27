import { cx } from './ui';

export function QuickCallButton({ label, active, tone, onClick }: { label: string; active?: boolean; tone?: 'hot' | 'fav'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'min-h-[52px] rounded-xl border px-2 py-3 font-display text-sm font-semibold uppercase tracking-wide transition active:scale-[0.97]',
        active ? 'border-red bg-red text-white' :
          tone === 'hot' ? 'border-red/70 bg-red-soft text-white hover:bg-red/30' :
          tone === 'fav' ? 'border-line bg-coal text-white hover:border-red/60' :
          'border-line bg-coal text-white hover:border-mute/50',
      )}
    >
      {label}
    </button>
  );
}
