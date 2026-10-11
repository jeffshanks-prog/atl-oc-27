import { useState } from 'react';
import { useApp } from '@/state/store';
import { DISTANCES, DOWNS, FIELD_ZONES, QUARTERS } from '@/lib/constants';
import { normalizeClock, scoreState, yardLineLabel, zoneFromYardLine } from '@/engine/situation';
import { Chip, SectionTitle, cx, inputCls } from './ui';

/** Visual field: tap anywhere to set the line of scrimmage. Offense drives left → right. */
export function FieldSelector({ yardLine, onChange }: { yardLine: number; onChange: (y: number) => void }) {
  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const field = (clientX - r.left) / r.width; // includes 8% end zones each side
    const y = Math.round(((field - 0.08) / 0.84) * 100);
    onChange(Math.max(1, Math.min(99, y)));
  };
  const left = 8 + (yardLine / 100) * 84;
  return (
    <div>
      <div
        className="relative h-16 w-full cursor-pointer touch-none select-none overflow-hidden rounded-xl border border-line"
        style={{ background: 'linear-gradient(90deg,#2a0b0f 0 8%,#123018 8% 92%,#2a0b0f 92%)' }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); pick(e.clientX, e.currentTarget); }}
        onPointerMove={(e) => { if (e.buttons) pick(e.clientX, e.currentTarget); }}
        role="slider"
        aria-label="Field position"
        aria-valuemin={1}
        aria-valuemax={99}
        aria-valuenow={yardLine}
        aria-valuetext={yardLineLabel(yardLine)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onChange(Math.min(99, yardLine + 1));
          if (e.key === 'ArrowLeft') onChange(Math.max(1, yardLine - 1));
        }}
      >
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((y) => (
          <div key={y} className="absolute top-0 h-full w-px bg-white/15" style={{ left: `${8 + y * 0.84}%` }}>
            <span className="absolute bottom-0.5 -translate-x-1/2 text-[9px] font-semibold text-white/40">{y <= 50 ? y : 100 - y}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-0 grid w-[8%] place-items-center text-[9px] font-bold text-white/40">OWN</div>
        <div className="absolute inset-y-0 right-0 grid w-[8%] place-items-center text-[9px] font-bold text-white/40">OPP</div>
        <div className="absolute top-0 h-full w-1 -translate-x-1/2 bg-red shadow-[0_0_12px_#e11d2e]" style={{ left: `${left}%` }} />
        <div className="absolute top-1 -translate-x-1/2 rounded bg-red px-1.5 text-[10px] font-bold" style={{ left: `${left}%` }}>
          {yardLineLabel(yardLine)}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FIELD_ZONES.map((z) => (
          <Chip key={z.zone} size="sm" active={zoneFromYardLine(yardLine) === z.zone} onClick={() => onChange(z.yardLine)}>{z.zone}</Chip>
        ))}
      </div>
    </div>
  );
}

export function SituationSelector() {
  const s = useApp((x) => x.situation);
  const setSituation = useApp((x) => x.setSituation);
  const updateGame = useApp((x) => x.updateGame);
  const [manual, setManual] = useState('');
  const isPreset = DISTANCES.some((d) => d.value === s.distance);
  const state = scoreState(s);

  const setScore = (k: 'myScore' | 'oppScore', v: number) => {
    const val = Math.max(0, Math.min(199, Number.isFinite(v) ? v : 0));
    setSituation({ [k]: val });
    updateGame(k === 'myScore' ? { myScore: val } : { oppScore: val });
  };

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Down</SectionTitle>
        <div className="grid grid-cols-4 gap-1.5">
          {DOWNS.map((d) => <Chip key={d.value} active={s.down === d.value} onClick={() => setSituation({ down: d.value })}>{d.label}</Chip>)}
        </div>
      </div>

      <div>
        <SectionTitle>Distance</SectionTitle>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 lg:grid-cols-5">
          {DISTANCES.map((d) => (
            <Chip key={d.label} size="sm" active={s.distance === d.value} onClick={() => setSituation({ distance: d.value })}>{d.label}</Chip>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            inputMode="decimal"
            className={cx(inputCls, 'py-2 text-sm', !isPreset && 'border-red')}
            placeholder={isPreset ? 'Exact yards (e.g. 23)' : `Custom: ${s.distance}`}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onBlur={() => {
              const v = parseFloat(manual);
              if (v > 0 && v < 100) setSituation({ distance: v });
              setManual('');
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            aria-label="Manual distance"
          />
        </div>
      </div>

      <div>
        <SectionTitle>Field position</SectionTitle>
        <FieldSelector yardLine={s.yardLine} onChange={(y) => setSituation({ yardLine: y })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <SectionTitle>Quarter</SectionTitle>
          <div className="grid grid-cols-5 gap-1">
            {QUARTERS.map((q) => <Chip key={q.value} size="sm" active={s.quarter === q.value} onClick={() => setSituation({ quarter: q.value })}>{q.label}</Chip>)}
          </div>
        </div>
        <div>
          <SectionTitle>Clock</SectionTitle>
          <input
            className={cx(inputCls, 'py-2 text-center font-display text-lg tracking-widest')}
            defaultValue={s.clock}
            key={s.clock}
            inputMode="numeric"
            onBlur={(e) => setSituation({ clock: normalizeClock(e.target.value) })}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            aria-label="Game clock"
          />
        </div>
      </div>

      <div>
        <SectionTitle right={<span className={cx('text-xs font-bold uppercase', state === 'Winning' ? 'text-emerald-400' : state === 'Losing' ? 'text-red' : 'text-mute')}>{state}</span>}>Score</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {(['myScore', 'oppScore'] as const).map((k) => (
            <div key={k} className="flex items-center gap-1 rounded-xl border border-line bg-ink p-1">
              <button className="h-10 w-10 rounded-lg bg-slate2 text-lg" onClick={() => setScore(k, s[k] - 1)} aria-label="minus">−</button>
              <div className="flex-1 text-center">
                <div className="text-[10px] font-semibold uppercase text-mute">{k === 'myScore' ? 'My score' : 'Opponent'}</div>
                <input
                  className="w-full bg-transparent text-center font-display text-xl font-bold outline-none"
                  inputMode="numeric"
                  value={s[k]}
                  onChange={(e) => setScore(k, parseInt(e.target.value || '0', 10))}
                  aria-label={k === 'myScore' ? 'My score' : 'Opponent score'}
                />
              </div>
              <button className="h-10 w-10 rounded-lg bg-slate2 text-lg" onClick={() => setScore(k, s[k] + 1)} aria-label="plus">+</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
