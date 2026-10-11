import { useMemo, useState } from 'react';
import { useApp } from '@/state/store';
import { usePlayStats } from '@/state/useEngine';
import { PlayCard } from '@/components/PlayCard';
import { PlayFilters, applyFilters, EMPTY_FILTERS, type Filters } from '@/components/PlayFilters';
import { PlaySearch, matchesQuery } from '@/components/PlaySearch';
import { FavoriteRolesEditor } from '@/components/FavoriteRolesEditor';
import { Button, Card, Empty, PageHeader, SectionTitle } from '@/components/ui';
import { fmtAvg, groupStats, pct } from '@/analytics/stats';
import { playLabel } from '@/engine/classify';
import { FavoriteHeart } from '@/components/FavoriteHeart';

const DEF_NAME: Record<string, string> = { C0: 'Cover 0', C1: 'Cover 1', C2: 'Cover 2', C3: 'Cover 3', C4: 'Cover 4', C6: 'Cover 6', Man: 'Man', Blitz: 'Blitz' };

export default function Favorites() {
  const plays = useApp((s) => s.plays);
  const favorites = useApp((s) => s.favorites);
  const calls = useApp((s) => s.calls);
  const stats = usePlayStats();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<string | null>(null);

  const favPlays = useMemo(() => plays.filter((p) => favorites[p.id]), [plays, favorites]);
  const shown = favPlays.filter((p) => matchesQuery(p, q) && applyFilters(p, filters, favorites[p.id]));

  // TOP FAVORITES — real stored results only
  const top = useMemo(() => {
    const favCalls = calls.filter((c) => favorites[c.playId]);
    return favPlays
      .map((p) => {
        const st = stats.get(p.id);
        if (!st || st.calls === 0) return null;
        const defs = groupStats(favCalls.filter((c) => c.playId === p.id), (c) => (c.result.defenseSeen === 'Unknown' ? null : c.result.defenseSeen));
        const best = [...defs.entries()].filter(([, s]) => s.calls >= 2).sort((a, b) => b[1].successRate - a[1].successRate)[0];
        return { p, st, best: best ? DEF_NAME[best[0]] ?? best[0] : null };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.st.successRate - a.st.successRate || b.st.calls - a.st.calls)
      .slice(0, 6);
  }, [favPlays, calls, favorites, stats]);

  return (
    <div>
      <PageHeader title="❤️ My Favorites" sub={`${favPlays.length} favorite plays`} />

      {top.length > 0 && (
        <section className="mb-6">
          <SectionTitle>❤️ Top favorites (your results)</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {top.map(({ p, st, best }) => (
              <Card key={p.id} className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg font-semibold uppercase">{p.playName}</div>
                  <div className="truncate text-xs text-mute">{playLabel(p)}</div>
                  <div className="mt-1 text-sm">Calls: {st.calls} · Avg {fmtAvg(st.avg)} yds · Success {pct(st.successRate)}</div>
                  {best && <div className="text-xs text-red">Best vs {best}</div>}
                </div>
                <FavoriteHeart playId={p.id} size="sm" />
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-2">
        <PlaySearch value={q} onChange={setQ} placeholder="Search favorites..." />
        <PlayFilters plays={favPlays} value={filters} onChange={setFilters} showRole />
      </div>

      <div className="mt-4 space-y-2">
        {favPlays.length === 0 && <Empty>No favorites yet. Tap ♡ on any play — in the Playbook, Game Caller, or anywhere — to add it here.</Empty>}
        {favPlays.length > 0 && shown.length === 0 && <Empty>No favorites match these filters.</Empty>}
        {shown.map((p) => (
          <div key={p.id}>
            <PlayCard play={p} stat={stats.get(p.id)} roles={favorites[p.id]}
              actions={<Button size="sm" tone="ghost" onClick={() => setEditing(editing === p.id ? null : p.id)}>{editing === p.id ? 'Done' : 'Roles'}</Button>} />
            {editing === p.id && <Card className="mt-1 p-3"><FavoriteRolesEditor playId={p.id} /></Card>}
          </div>
        ))}
      </div>
    </div>
  );
}
