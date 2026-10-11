import type { Play, PlayType } from '@/lib/types';
import { FAVORITE_ROLES, PLAY_TYPES, SCHEME_BROWSE } from '@/lib/constants';
import { familiesOf, formationLabel, listMatches } from '@/engine/classify';
import type { Coverage } from '@/lib/types';
import { inputCls } from './ui';

export interface Filters {
  formation: string;
  scheme: string; // family key
  concept: string;
  role: string;
  coverage: Coverage | '';
  playType: PlayType | '';
}
export const EMPTY_FILTERS: Filters = { formation: '', scheme: '', concept: '', role: '', coverage: '', playType: '' };

export function applyFilters(p: Play, f: Filters, roles?: string[]): boolean {
  if (f.formation && formationLabel(p) !== f.formation) return false;
  if (f.scheme && !familiesOf(p).has(f.scheme as never)) return false;
  if (f.concept && (p.concept ?? '') !== f.concept) return false;
  if (f.role && !(roles ?? []).includes(f.role)) return false;
  if (f.coverage && !listMatches(p.bestVs, f.coverage)) return false;
  if (f.playType && p.playType !== f.playType) return false;
  return true;
}

const COVS: Coverage[] = ['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4', 'Cover 6', 'Man'];

export function PlayFilters({ plays, value, onChange, showRole }: { plays: Play[]; value: Filters; onChange: (f: Filters) => void; showRole?: boolean }) {
  const formations = [...new Set(plays.map(formationLabel))].sort();
  const concepts = [...new Set(plays.map((p) => p.concept).filter((x): x is string => Boolean(x)))].sort();
  const set = (k: keyof Filters, v: string) => onChange({ ...value, [k]: v });
  const sel = `${inputCls} py-2 text-sm`;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <select className={sel} value={value.formation} onChange={(e) => set('formation', e.target.value)} aria-label="Formation">
        <option value="">All formations</option>
        {formations.map((f) => <option key={f}>{f}</option>)}
      </select>
      <select className={sel} value={value.scheme} onChange={(e) => set('scheme', e.target.value)} aria-label="Scheme">
        <option value="">All schemes</option>
        {SCHEME_BROWSE.map((s) => <option key={s.family} value={s.family}>{s.label}</option>)}
      </select>
      <select className={sel} value={value.concept} onChange={(e) => set('concept', e.target.value)} aria-label="Concept">
        <option value="">All concepts</option>
        {concepts.map((c) => <option key={c}>{c}</option>)}
      </select>
      {showRole && (
        <select className={sel} value={value.role} onChange={(e) => set('role', e.target.value)} aria-label="Situation role">
          <option value="">All situations</option>
          {FAVORITE_ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
      )}
      <select className={sel} value={value.coverage} onChange={(e) => set('coverage', e.target.value)} aria-label="Best vs coverage">
        <option value="">Any coverage</option>
        {COVS.map((c) => <option key={c} value={c}>Best vs {c}</option>)}
      </select>
      <select className={sel} value={value.playType} onChange={(e) => set('playType', e.target.value)} aria-label="Play type">
        <option value="">All play types</option>
        {PLAY_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
    </div>
  );
}
