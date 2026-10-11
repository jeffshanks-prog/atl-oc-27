import { useApp } from '@/state/store';
import { ALIGNMENTS, COVERAGES, PRESSURES } from '@/lib/constants';
import { Chip, SectionTitle } from './ui';

export function CoverageSelector() {
  const s = useApp((x) => x.situation);
  const setSituation = useApp((x) => x.setSituation);
  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Defensive coverage</SectionTitle>
        <div className="grid grid-cols-5 gap-1.5">
          {COVERAGES.map((c) => (
            <Chip key={c} size="sm" active={s.coverage === c} onClick={() => setSituation({ coverage: c })}>
              {c === 'Unknown' ? 'UNK' : c.replace('Cover ', 'C')}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>Pressure</SectionTitle>
        <div className="grid grid-cols-3 gap-1.5">
          {PRESSURES.map((p) => <Chip key={p} size="sm" active={s.pressure === p} onClick={() => setSituation({ pressure: p })}>{p}</Chip>)}
        </div>
      </div>
      <div>
        <SectionTitle right={s.alignment.length ? <button className="text-xs text-mute hover:text-white" onClick={() => setSituation({ alignment: [] })}>Clear</button> : null}>
          Alignment (optional)
        </SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {ALIGNMENTS.map((a) => {
            const on = s.alignment.includes(a);
            return (
              <Chip key={a} size="sm" active={on}
                onClick={() => {
                  let next = on ? s.alignment.filter((x) => x !== a) : [...s.alignment, a];
                  const boxes = ['Light box', 'Normal box', 'Loaded box'];
                  if (!on && boxes.includes(a)) next = next.filter((x) => x === a || !boxes.includes(x));
                  if (!on && (a === 'Press' || a === 'Off coverage')) next = next.filter((x) => x === a || (x !== 'Press' && x !== 'Off coverage'));
                  setSituation({ alignment: next });
                }}>
                {a}
              </Chip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
