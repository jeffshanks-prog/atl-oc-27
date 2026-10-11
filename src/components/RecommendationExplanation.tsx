import type { Scored } from '@/engine/recommend';
import { playLabel } from '@/engine/classify';
import { Modal, cx } from './ui';

export function RecommendationExplanation({ scored, open, onClose }: { scored: Scored | null; open: boolean; onClose: () => void }) {
  if (!scored) return null;
  const live = scored.factors.filter((f) => f.applicable);
  const liveMax = live.reduce((a, f) => a + f.max, 0);
  const liveRaw = live.reduce((a, f) => a + f.value, 0);
  return (
    <Modal open={open} onClose={onClose} title="Why this play?">
      <div className="mb-3 text-sm text-mute">{playLabel(scored.play)}</div>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="font-display text-4xl font-bold text-red">{scored.score}%</span>
        <span className="text-sm text-mute">match score = {Math.round(liveRaw * 10) / 10} of {liveMax} possible points</span>
      </div>
      <div className="space-y-2">
        {scored.factors.map((f) => {
          const neg = f.min < 0;
          const pct = neg ? (Math.abs(f.value) / Math.abs(f.min)) * 100 : (f.value / f.max) * 100;
          return (
            <div key={f.key} className={cx('rounded-xl border border-line bg-ink p-3', !f.applicable && 'opacity-55')}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{f.label}</span>
                <span className={cx('font-display font-bold', neg && f.value < 0 ? 'text-red' : 'text-white')}>
                  {f.value} <span className="text-mute">/ {neg ? f.min : f.max}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate2">
                <div className={cx('h-full', neg ? 'bg-red' : 'bg-white/80')} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
              </div>
              <div className="mt-1 text-xs text-mute">{f.note}{!f.applicable && ' — not counted until there is data'}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-mute">
        Recommendations are strategic suggestions based on your inputs, ratings, and recorded results — not guarantees.
      </p>
    </Modal>
  );
}
