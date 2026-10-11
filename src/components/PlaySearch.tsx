import type { Play } from '@/lib/types';
import { FAMILY_LABEL, familiesOf, formationLabel } from '@/engine/classify';
import { inputCls } from './ui';

export function matchesQuery(p: Play, q: string): boolean {
  if (!q.trim()) return true;
  const hay = [
    p.playName, formationLabel(p), p.formationFamily, p.concept, p.primaryScheme, p.passConcept, p.runConcept,
    p.screenType, p.rpoType, p.playType, ...p.secondarySchemes, ...p.tags, ...[...familiesOf(p)].map((f) => FAMILY_LABEL[f]),
  ].filter(Boolean).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function PlaySearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute">⌕</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search play, formation, concept or scheme...'}
        className={`${inputCls} pl-9`}
        aria-label="Search plays"
      />
    </div>
  );
}
