import { useDefensePrediction } from '@/state/useEngine';
import { COV_NAME, PREDICT_AFTER } from '@/engine/predict';
import { useApp } from '@/state/store';
import { Badge, Card, Meter, SectionTitle } from './ui';

/** "What's the defense about to do?" — appears once 15 snaps are logged. */
export function DefensePredictionCard() {
  const p = useDefensePrediction();
  const coverage = useApp((s) => s.situation.coverage);
  if (p.snaps === 0) return null;

  if (!p.ready) {
    return (
      <Card className="p-4">
        <SectionTitle>Defense prediction</SectionTitle>
        <p className="text-sm text-mute">Learning this opponent: {p.snaps} of {PREDICT_AFTER} snaps logged. Predictions start after {PREDICT_AFTER}.</p>
        <div className="mt-2"><Meter value={p.snaps / PREDICT_AFTER} tone="white" /></div>
      </Card>
    );
  }

  const label = p.strength === 'strong' ? 'Expect' : p.strength === 'lean' ? 'Leaning' : 'Mixed';
  return (
    <Card className="border-red/50 p-4">
      <SectionTitle right={<Badge tone={p.strength === 'strong' ? 'red' : p.strength === 'lean' ? 'amber' : 'dark'}>{label}</Badge>}>
        Defense prediction
      </SectionTitle>
      <div className="flex items-end justify-between">
        <div className="font-display text-3xl font-bold uppercase leading-none">{p.coverage ? COV_NAME[p.coverage] : '—'}</div>
        <div className="text-right text-sm"><b className="text-lg">{Math.round(p.prob * 100)}%</b><div className="text-xs text-mute">this snap</div></div>
      </div>
      <div className="mt-2 grid grid-cols-[96px_1fr_40px] items-center gap-2 text-xs">
        <span className="text-mute">Blitz chance</span>
        <Meter value={p.blitzProb} tone="red" />
        <span className="text-right font-semibold tabular-nums">{Math.round(p.blitzProb * 100)}%</span>
      </div>
      <div className="mt-2 space-y-1">
        {p.dist.slice(1, 3).map((d) => (
          <div key={d.cov} className="grid grid-cols-[96px_1fr_40px] items-center gap-2 text-xs">
            <span className="text-mute">{COV_NAME[d.cov]}</span>
            <Meter value={d.p} tone="white" />
            <span className="text-right tabular-nums">{Math.round(d.p * 100)}%</span>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        {p.reasons.map((r) => <li key={r}>• {r}</li>)}
      </ul>
      <p className="mt-2 text-xs text-mute">
        {coverage === 'Unknown' && p.strength !== 'mixed'
          ? 'The call above is built for this prediction. Tap a coverage on the left to override it.'
          : coverage !== 'Unknown' ? `Using your pick (${coverage}) instead of the prediction.` : 'Too close to call, so the play isn’t tuned to one coverage.'}
      </p>
    </Card>
  );
}
