import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Scored } from '@/engine/recommend';
import type { Situation } from '@/lib/types';
import { formationLabel } from '@/engine/classify';
import { situationLabel } from '@/engine/situation';
import { FavoriteHeart } from './FavoriteHeart';
import { RecommendationExplanation } from './RecommendationExplanation';
import { AddToGamePlanModal } from './AddToGamePlanModal';
import { Badge, Button, cx } from './ui';

export function PlayRecommendation({
  scored, situation, onCall, onNext, rank, total, scriptNote,
}: {
  scored: Scored;
  situation: Situation;
  onCall: () => void;
  onNext: () => void;
  rank: number;
  total: number;
  scriptNote?: string | null;
}) {
  const nav = useNavigate();
  const [why, setWhy] = useState(false);
  const [plan, setPlan] = useState(false);
  const p = scored.play;
  const reads = [p.primaryRead, p.secondRead, p.thirdRead, p.checkdown];
  const hasReads = reads.some(Boolean);
  return (
    <div className="overflow-hidden rounded-2xl border border-red/50 bg-gradient-to-b from-red-soft/60 to-coal">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-red">Primary call</span>
              {scored.isFavorite && <Badge tone="red">♥ Your favorite</Badge>}
              {scriptNote && <Badge tone="amber">{scriptNote}</Badge>}
            </div>
            {/* Madden menu path: formation › set › play, big enough to read across the room */}
            <div className="mt-1 flex flex-wrap items-center gap-1 font-display text-base font-semibold uppercase tracking-wide text-white/80 sm:text-lg" aria-label="Madden menu path">
              <span className="rounded-md bg-ink/70 px-2 py-0.5">{p.formationFamily}</span>
              <span className="text-red">›</span>
              <span className="rounded-md bg-ink/70 px-2 py-0.5">{[p.formation, p.set].filter(Boolean).join(' ')}</span>
              <span className="text-red">›</span>
            </div>
            <h2 className="font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">{p.playName}</h2>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl font-bold leading-none text-white">{scored.score}<span className="text-xl text-mute">%</span></div>
            <button onClick={() => setWhy(true)} className="mt-1 text-xs font-semibold text-red underline-offset-2 hover:underline">Why this play?</button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span><span className="text-mute">Situation:</span> {situationLabel(situation)}</span>
          <span><span className="text-mute">Defense:</span> {situation.coverage}{situation.pressure !== 'Unknown' ? ` · ${situation.pressure}` : ''}</span>
        </div>

        <div className="mt-3 rounded-xl bg-ink/60 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-mute">Why call it</div>
          <p className="mt-0.5 text-sm">{scored.why}</p>
        </div>

        <div className="mt-3 rounded-xl bg-ink/60 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-mute">Read progression</div>
          {hasReads ? (
            <ol className="mt-1 space-y-0.5 text-sm">
              {reads.map((r, i) => r && (
                <li key={i}><span className="mr-2 font-display text-red">{i === 3 ? 'CK' : i + 1}</span>{r}</li>
              ))}
            </ol>
          ) : (
            <p className="mt-0.5 text-sm text-mute">Not entered yet — add reads on the play page so they show here.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-line bg-coal p-3 sm:grid-cols-5">
        <Button tone="red" size="lg" className="col-span-2 sm:col-span-1" onClick={onCall}>CALL IT</Button>
        <div className="flex items-center justify-center rounded-xl border border-line bg-slate2">
          <FavoriteHeart playId={p.id} />
          <span className="pr-3 text-sm font-semibold">Favorite</span>
        </div>
        <Button onClick={() => setPlan(true)}>+ Game plan</Button>
        <Button onClick={onNext} disabled={total <= 1}>Next ({Math.min(rank + 1, total)}/{total})</Button>
        <Button onClick={() => nav(`/play/${p.id}`)} className={cx('col-span-2 sm:col-span-1')}>View play</Button>
      </div>
      <RecommendationExplanation scored={scored} open={why} onClose={() => setWhy(false)} />
      <AddToGamePlanModal playId={p.id} open={plan} onClose={() => setPlan(false)} />
    </div>
  );
}

/** Small option card: Counter / Screen / Run / Shot answers. */
export function AnswerCard({ label, scored, onCall }: { label: string; scored: Scored | null; onCall: (s: Scored) => void }) {
  const nav = useNavigate();
  if (!scored) {
    return (
      <div className="rounded-xl border border-dashed border-line p-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-mute">{label}</div>
        <div className="mt-1 text-sm text-mute">No matching play in your playbook yet.</div>
      </div>
    );
  }
  const p = scored.play;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-coal p-2 pl-3">
      <button className="min-w-0 flex-1 text-left" onClick={() => nav(`/play/${p.id}`)}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-red">{label} · {scored.score}%</div>
        <div className="truncate text-[11px] uppercase text-mute">{formationLabel(p)}</div>
        <div className="truncate font-display text-base font-semibold uppercase">{p.playName}</div>
      </button>
      <FavoriteHeart playId={p.id} size="sm" />
      <Button size="sm" tone="outline" onClick={() => onCall(scored)} className="min-h-[44px]">Call</Button>
    </div>
  );
}
