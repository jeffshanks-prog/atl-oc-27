import type { ScreenAlertResult } from '@/engine/screenAlert';
import { formationLabel } from '@/engine/classify';
import { FavoriteHeart } from './FavoriteHeart';
import { Button } from './ui';

export function ScreenAlert({ alert, onCall, onDismiss }: { alert: ScreenAlertResult; onCall: () => void; onDismiss: () => void }) {
  const p = alert.play?.play;
  return (
    <div className="rounded-2xl border-2 border-red bg-red-soft p-4 shadow-[0_0_30px_rgba(225,29,46,0.25)]">
      <div className="flex items-center justify-between">
        <div className="font-display text-lg font-bold uppercase tracking-wide">🚨 Screen opportunity</div>
        <button onClick={onDismiss} className="text-sm text-mute hover:text-white" aria-label="Dismiss screen alert">Dismiss</button>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {alert.reasons.map((r) => <li key={r}>• {r}</li>)}
      </ul>
      {p ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-ink/70 p-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-red">Recommended</div>
            <div className="line-clamp-2 font-display text-lg font-semibold uppercase leading-tight">{formationLabel(p)} — {p.playName}</div>
            <div className="text-xs text-mute">Why: use their aggressive pressure against them. If they adjust: {alert.counters}.</div>
          </div>
          <FavoriteHeart playId={p.id} />
          <Button tone="red" onClick={onCall}>Call it</Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-mute">No screens in your playbook yet — import or tag screen plays in Admin.</p>
      )}
      <p className="mt-2 text-[11px] text-mute">A strategic read from your recorded snaps — not a certainty.</p>
    </div>
  );
}
