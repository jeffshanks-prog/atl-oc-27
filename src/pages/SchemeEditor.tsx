import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/state/store';
import { CONCEPT_KEYS, SCHEME_TEMPLATES } from '@/lib/constants';
import type { ConceptKey, Scheme, Weights } from '@/lib/types';
import { uuid } from '@/lib/supabase';
import { formationLabel } from '@/engine/classify';
import { PlayCard } from '@/components/PlayCard';
import { PlayPicker } from '@/components/PlayPicker';
import { Button, Card, Chip, Field, PageHeader, SectionTitle, cx, inputCls } from '@/components/ui';

const blank = (): Scheme => ({
  id: uuid(), name: '', description: '', primaryConcept: 'Spacing', secondaryConcepts: [], runPhilosophy: '',
  screenPhilosophy: '', preferredFormations: [], preferredPersonnel: [], weights: { spacing: 40, screen: 20, run: 40 },
  isDefault: false, isActive: false, playIds: [],
});

const PERSONNEL = ['10', '11', '12', '13', '20', '21', '22', '23'];

export function balanceTo100(w: Weights): Weights {
  const entries = CONCEPT_KEYS.map((c) => [c.key, w[c.key] ?? 0] as [ConceptKey, number]);
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  if (sum === 0) return { spacing: 100 };
  const scaled = entries.map(([k, v]) => [k, Math.floor((v / sum) * 100)] as [ConceptKey, number]);
  let rem = 100 - scaled.reduce((a, [, v]) => a + v, 0);
  scaled.sort((a, b) => b[1] - a[1]);
  const targets = scaled.filter(([, v]) => v > 0);
  const pool = targets.length ? targets : scaled.slice(0, 1);
  for (let i = 0; rem > 0; i++, rem--) pool[i % pool.length][1] += 1;
  return Object.fromEntries(scaled.filter(([, v]) => v > 0));
}

export default function SchemeEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const existing = useApp((s) => s.schemes.find((x) => x.id === id));
  const plays = useApp((s) => s.plays);
  const playsById = useApp((s) => s.playsById);
  const save = useApp((s) => s.saveScheme);
  const toast = useApp((s) => s.toast);
  const [s, setS] = useState<Scheme>(() => existing ?? blank());
  const [picker, setPicker] = useState(false);
  const formations = useMemo(() => [...new Set(plays.map(formationLabel))].sort(), [plays]);
  const total = CONCEPT_KEYS.reduce((a, c) => a + (s.weights[c.key] ?? 0), 0);
  const set = <K extends keyof Scheme>(k: K, v: Scheme[K]) => setS({ ...s, [k]: v });
  const toggle = (k: 'preferredFormations' | 'preferredPersonnel' | 'secondaryConcepts', v: string) =>
    set(k, s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v]);

  const onSave = () => {
    if (!s.name.trim()) { toast('Give the scheme a name', 'warn'); return; }
    if (total !== 100) { toast('Concept weights must total 100%', 'warn'); return; }
    save({ ...s, name: s.name.trim() });
    toast('Scheme saved');
    nav('/schemes');
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={existing ? 'Edit scheme' : 'Create scheme'} right={<Button tone="red" onClick={onSave}>Save scheme</Button>} />
      <div className="space-y-4">
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Scheme name"><input className={inputCls} value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Screen Heavy" /></Field>
          <Field label="Primary concept">
            <select className={inputCls} value={s.primaryConcept ?? ''} onChange={(e) => set('primaryConcept', e.target.value)}>
              {SCHEME_TEMPLATES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="Description"><textarea className={inputCls} rows={2} value={s.description} onChange={(e) => set('description', e.target.value)} /></Field></div>
          <Field label="Run philosophy"><textarea className={inputCls} rows={2} value={s.runPhilosophy} onChange={(e) => set('runPhilosophy', e.target.value)} /></Field>
          <Field label="Screen philosophy"><textarea className={inputCls} rows={2} value={s.screenPhilosophy} onChange={(e) => set('screenPhilosophy', e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-mute">Secondary concepts</div>
            <div className="flex flex-wrap gap-1.5">
              {SCHEME_TEMPLATES.filter((t) => t !== s.primaryConcept).map((t) => <Chip key={t} size="sm" active={s.secondaryConcepts.includes(t)} onClick={() => toggle('secondaryConcepts', t)}>{t}</Chip>)}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle right={<span className={cx('font-display text-lg font-bold', total === 100 ? 'text-emerald-400' : 'text-red')}>{total}%</span>}>
            Concept weighting (must total 100%)
          </SectionTitle>
          <div className="space-y-3">
            {CONCEPT_KEYS.map((c) => {
              const v = s.weights[c.key] ?? 0;
              return (
                <div key={c.key} className="grid grid-cols-[130px_1fr_48px] items-center gap-3">
                  <span className="text-sm">{c.label}</span>
                  <input type="range" min={0} max={100} step={1} value={v} className="w-full accent-red"
                    onChange={(e) => set('weights', { ...s.weights, [c.key]: Number(e.target.value) })} aria-label={`${c.label} weight`} />
                  <span className="text-right font-display font-semibold tabular-nums">{v}%</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => set('weights', balanceTo100(s.weights))} disabled={total === 100}>Balance to 100%</Button>
            <span className="self-center text-xs text-mute">These are recommendation preferences, not mandatory play-call percentages.</span>
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle>Preferred formations</SectionTitle>
          {formations.length === 0 ? <p className="text-sm text-mute">No formations in the database yet.</p> : (
            <div className="flex flex-wrap gap-1.5">
              {formations.map((f) => <Chip key={f} size="sm" active={s.preferredFormations.includes(f)} onClick={() => toggle('preferredFormations', f)}>{f}</Chip>)}
            </div>
          )}
          <div className="mt-4"><SectionTitle>Preferred personnel</SectionTitle></div>
          <div className="flex flex-wrap gap-1.5">
            {PERSONNEL.map((p) => <Chip key={p} size="sm" active={s.preferredPersonnel.includes(p)} onClick={() => toggle('preferredPersonnel', p)}>{p}</Chip>)}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle right={<Button size="sm" tone="outline" onClick={() => setPicker(true)}>+ Add play</Button>}>Preferred plays</SectionTitle>
          {s.playIds.length === 0 ? <p className="text-sm text-mute">Optional. Preferred plays get a scheme-match boost.</p> : (
            <div className="space-y-2">
              {s.playIds.map((pid) => playsById.get(pid)).filter(Boolean).map((p) => (
                <PlayCard key={p!.id} play={p!} compact actions={<Button size="sm" tone="ghost" onClick={() => set('playIds', s.playIds.filter((x) => x !== p!.id))}>Remove</Button>} />
              ))}
            </div>
          )}
        </Card>
        <Button tone="red" size="lg" className="w-full" onClick={onSave}>Save scheme</Button>
      </div>
      <PlayPicker open={picker} onClose={() => setPicker(false)} excludeIds={s.playIds}
        onPick={(pid) => { set('playIds', [...s.playIds, pid]); }} title="Add preferred play" />
    </div>
  );
}
