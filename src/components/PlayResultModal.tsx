import { useEffect, useState } from 'react';
import { useApp } from '@/state/store';
import { DEFENSE_SEEN, OBSERVATIONS, OUTCOMES } from '@/lib/constants';
import type { DefenseSeen, Outcome, PlayCall, PlayResult } from '@/lib/types';
import { defaultYards, isSuccess, situationLabel } from '@/engine/situation';
import { coverageToDefenseSeen, isPassPlay, playLabel } from '@/engine/classify';
import { Button, Chip, Modal, cx, inputCls } from './ui';

const OUTCOME_TONE: Partial<Record<Outcome, string>> = {
  TD: 'border-emerald-500 text-emerald-300', INT: 'border-red text-red', Fumble: 'border-red text-red', Sack: 'border-amber-500 text-amber-300',
};

export function PlayResultModal({ call, open, onClose }: { call: PlayCall | null; open: boolean; onClose: () => void }) {
  const play = useApp((s) => (call ? s.playsById.get(call.playId) : undefined));
  const recordResult = useApp((s) => s.recordResult);
  const toast = useApp((s) => s.toast);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [yards, setYards] = useState<string>('');
  const [defense, setDefense] = useState<DefenseSeen>('Unknown');
  const [obs, setObs] = useState<string[]>([]);

  useEffect(() => {
    if (open && call) {
      setOutcome(call.result?.outcome ?? null);
      setYards(call.result ? String(call.result.yards) : '');
      setDefense(call.result?.defenseSeen ?? coverageToDefenseSeen(call.coverage) ?? 'Unknown');
      setObs(call.result?.observations ?? []);
    }
  }, [open, call]);

  if (!call) return null;
  const pass = play ? isPassPlay(play) : true;

  const save = () => {
    if (!outcome) return;
    const y = yards.trim() === '' ? defaultYards(outcome, call) : parseInt(yards, 10) || 0;
    const touchdown = outcome === 'TD';
    const turnover = outcome === 'INT' || outcome === 'Fumble';
    const sack = outcome === 'Sack';
    const incomplete = outcome === 'Incomplete';
    const result: PlayResult = {
      outcome, yards: incomplete || turnover ? (outcome === 'Fumble' ? y : 0) : y,
      success: isSuccess(call.down, call.distance, y, touchdown, turnover) && !incomplete && !sack,
      isPass: pass, completed: pass && !incomplete && !sack && outcome !== 'INT',
      touchdown, turnover, sack, defenseSeen: defense, observations: obs,
    };
    recordResult(call.id, result);
    toast(touchdown ? 'Touchdown logged 🏈' : 'Result saved');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Result">
      <div className="mb-3 text-sm text-mute">
        {play ? playLabel(play) : 'Play'} · {situationLabel(call)}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {OUTCOMES.map((o) => (
          <button
            key={o}
            onClick={() => { setOutcome(o); setYards(''); }}
            className={cx(
              'min-h-[52px] rounded-xl border bg-ink font-display text-lg font-bold transition active:scale-95',
              outcome === o ? 'border-red bg-red text-white' : OUTCOME_TONE[o] ?? 'border-line text-white',
            )}
          >
            {o}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          className={cx(inputCls, 'text-center')}
          inputMode="numeric"
          placeholder={outcome ? `Actual yards (default ${defaultYards(outcome, call)})` : 'Actual yards (optional)'}
          value={yards}
          onChange={(e) => setYards(e.target.value.replace(/[^\d-]/g, ''))}
          aria-label="Actual yards"
        />
      </div>

      <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-mute">What defense did you see?</div>
      <div className="mt-1 grid grid-cols-5 gap-1.5">
        {DEFENSE_SEEN.map((d) => <Chip key={d} size="sm" active={defense === d} onClick={() => setDefense(d)}>{d}</Chip>)}
      </div>

      <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-mute">Observations</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {OBSERVATIONS.map((o) => (
          <Chip key={o} size="sm" active={obs.includes(o)} onClick={() => setObs(obs.includes(o) ? obs.filter((x) => x !== o) : [...obs, o])}>{o}</Chip>
        ))}
      </div>

      <Button tone="red" size="lg" className="mt-5 w-full" disabled={!outcome} onClick={save}>Save result</Button>
    </Modal>
  );
}
