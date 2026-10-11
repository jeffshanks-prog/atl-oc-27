import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/store';
import { usePlayStats } from '@/state/useEngine';
import { PlaySearch, matchesQuery } from '@/components/PlaySearch';
import { PlayFilters, applyFilters, EMPTY_FILTERS, type Filters } from '@/components/PlayFilters';
import { PlayCard } from '@/components/PlayCard';
import { Button, Chip, Empty, PageHeader, SectionTitle, cx } from '@/components/ui';
import { FORMATION_FAMILY_ORDER, SCHEME_BROWSE } from '@/lib/constants';
import { familiesOf } from '@/engine/classify';
import type { Play } from '@/lib/types';

type View = 'formation' | 'scheme';

export default function Playbook() {
  const nav = useNavigate();
  const plays = useApp((s) => s.plays);
  const favorites = useApp((s) => s.favorites);
  const stats = usePlayStats();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<View>('formation');
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  const [openFormation, setOpenFormation] = useState<string | null>(null);
  const [scheme, setScheme] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const searching = q.trim() !== '' || Object.values(filters).some(Boolean);
  const results = useMemo(() => plays.filter((p) => matchesQuery(p, q) && applyFilters(p, filters, favorites[p.id])), [plays, q, filters, favorites]);

  // family -> formation -> plays (only what's in the database; nothing invented)
  const tree = useMemo(() => {
    const m = new Map<string, Map<string, Play[]>>();
    for (const p of plays) {
      const fam = p.formationFamily || 'Other';
      if (!m.has(fam)) m.set(fam, new Map());
      const fm = m.get(fam)!;
      const key = p.set ? `${p.formation} ${p.set}` : p.formation;
      if (!fm.has(key)) fm.set(key, []);
      fm.get(key)!.push(p);
    }
    const order = (f: string) => { const i = FORMATION_FAMILY_ORDER.indexOf(f); return i < 0 ? 99 : i; };
    return [...m.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]));
  }, [plays]);

  const schemeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of SCHEME_BROWSE) c[s.family] = plays.filter((p) => familiesOf(p).has(s.family as never)).length;
    return c;
  }, [plays]);

  const list = (ps: Play[]) => (
    <div className="space-y-2">
      {ps.map((p) => <PlayCard key={p.id} play={p} stat={stats.get(p.id)} roles={favorites[p.id]} />)}
    </div>
  );

  return (
    <div>
      <PageHeader title="Atlanta Playbook" sub={`${plays.length} plays in the master database`}
        right={<Button size="sm" tone="outline" onClick={() => nav('/screens')}>🔥 Screen Center</Button>} />

      <div className="sticky top-[60px] z-20 -mx-3 space-y-2 bg-ink/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex gap-2">
          <div className="flex-1"><PlaySearch value={q} onChange={setQ} /></div>
          <Button onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>Filters</Button>
        </div>
        {showFilters && (
          <div className="space-y-2">
            <PlayFilters plays={plays} value={filters} onChange={setFilters} />
            {searching && <button className="text-xs text-mute hover:text-white" onClick={() => { setFilters(EMPTY_FILTERS); setQ(''); }}>Clear search & filters</button>}
          </div>
        )}
        {!searching && (
          <div className="flex gap-2">
            <Chip active={view === 'formation'} onClick={() => setView('formation')}>By formation</Chip>
            <Chip active={view === 'scheme'} onClick={() => setView('scheme')}>By scheme / concept</Chip>
          </div>
        )}
      </div>

      <div className="mt-3">
        {plays.length === 0 && <Empty>No plays yet. Import the Atlanta playbook from Admin → Import.</Empty>}

        {searching && (
          <>
            <SectionTitle>{results.length} results</SectionTitle>
            {results.length ? list(results) : <Empty>No plays match.</Empty>}
          </>
        )}

        {!searching && view === 'formation' && (
          <div className="space-y-2">
            {tree.map(([family, forms]) => {
              const count = [...forms.values()].reduce((a, b) => a + b.length, 0);
              const open = openFamily === family;
              return (
                <div key={family} className="rounded-2xl border border-line bg-coal">
                  <button className="flex w-full items-center justify-between px-4 py-4" onClick={() => setOpenFamily(open ? null : family)} aria-expanded={open}>
                    <span className="font-display text-xl font-bold uppercase tracking-wide">{family}</span>
                    <span className="text-sm text-mute">{forms.size} formation{forms.size === 1 ? '' : 's'} · {count} plays {open ? '▲' : '▼'}</span>
                  </button>
                  {open && (
                    <div className="space-y-2 border-t border-line p-3">
                      {[...forms.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([form, ps]) => {
                        const key = `${family}|${form}`;
                        const fo = openFormation === key;
                        return (
                          <div key={key}>
                            <button className={cx('flex w-full items-center justify-between rounded-xl px-3 py-3 text-left', fo ? 'bg-slate2' : 'hover:bg-slate2')}
                              onClick={() => setOpenFormation(fo ? null : key)} aria-expanded={fo}>
                              <span className="font-semibold">→ {form}</span>
                              <span className="text-xs text-mute">{ps.length} plays</span>
                            </button>
                            {fo && <div className="mt-2">{list(ps)}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!searching && view === 'scheme' && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {SCHEME_BROWSE.map((s) => (
                <button key={s.family} onClick={() => setScheme(scheme === s.family ? null : s.family)}
                  disabled={!schemeCounts[s.family]}
                  className={cx('rounded-xl border p-3 text-left transition disabled:opacity-30',
                    scheme === s.family ? 'border-red bg-red-soft' : 'border-line bg-coal hover:border-mute/50')}>
                  <div className="font-display text-base font-semibold uppercase">{s.label}</div>
                  <div className="text-xs text-mute">{schemeCounts[s.family]} plays</div>
                </button>
              ))}
            </div>
            {scheme && (
              <div className="mt-4">
                <SectionTitle>{SCHEME_BROWSE.find((s) => s.family === scheme)?.label} — every formation</SectionTitle>
                {list(plays.filter((p) => familiesOf(p).has(scheme as never)))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
