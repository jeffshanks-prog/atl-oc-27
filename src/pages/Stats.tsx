import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/store';
import { fmtAvg, groupStats, pct, rank, totals, withResults, type PlayStat } from '@/analytics/stats';
import { familiesOf, formationLabel, isRun, playLabel } from '@/engine/classify';
import { distanceBucket } from '@/engine/situation';
import { FavoriteHeart } from '@/components/FavoriteHeart';
import { Badge, Card, Chip, Empty, Meter, PageHeader, SectionTitle } from '@/components/ui';
import type { PlayCall, PlayResult } from '@/lib/types';

type Done = PlayCall & { result: PlayResult };
const MAN = ['C0', 'C1', 'Man'];
const ZONE = ['C2', 'C3', 'C4', 'C6'];
const pressured = (c: Done) => c.result.defenseSeen === 'Blitz' || c.result.observations.includes('Heavy pressure') || c.result.observations.includes('Edge rush');

function PlayRank({ title, rows }: { title: string; rows: [string, PlayStat][] }) {
  const playsById = useApp((s) => s.playsById);
  const nav = useNavigate();
  return (
    <Card className="p-4">
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? <p className="text-sm text-mute">Needs at least 2 recorded calls of a play.</p> : (
        <div className="space-y-2">
          {rows.map(([pid, s]) => {
            const p = playsById.get(pid);
            return (
              <div key={pid} className="flex items-center gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => p && nav(`/play/${pid}`)}>
                  <div className="truncate text-sm font-semibold">{p ? playLabel(p) : 'Removed play'}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1"><Meter value={s.successRate} /></div>
                    <span className="w-36 shrink-0 text-right text-xs text-mute">{s.calls} calls · {fmtAvg(s.avg)} avg · {pct(s.successRate)}</span>
                  </div>
                </button>
                {p && <FavoriteHeart playId={pid} size="sm" />}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function KeyRank({ title, rows }: { title: string; rows: [string, PlayStat][] }) {
  return (
    <Card className="p-4">
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? <p className="text-sm text-mute">Not enough data yet.</p> : (
        <div className="space-y-2">
          {rows.map(([k, s]) => (
            <div key={k}>
              <div className="flex justify-between text-sm"><span className="font-semibold">{k}</span><span className="text-xs text-mute">{s.calls} calls · {fmtAvg(s.avg)} avg · {pct(s.successRate)}</span></div>
              <Meter value={s.successRate} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-mute">{label}</div>
      <div className="font-display text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-mute">{sub}</div>}
    </Card>
  );
}

const DIMENSIONS = ['Coverage', 'Down', 'Distance', 'Formation', 'Scheme', 'Opponent', 'Field Position'] as const;

export default function Stats() {
  const nav = useNavigate();
  const calls = useApp((s) => s.calls);
  const playsById = useApp((s) => s.playsById);
  const favorites = useApp((s) => s.favorites);
  const games = useApp((s) => s.games);
  const schemes = useApp((s) => s.schemes);
  const [tab, setTab] = useState<'dash' | 'history'>('dash');
  const [dim, setDim] = useState<(typeof DIMENSIONS)[number]>('Coverage');

  const gamesById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const schemeName = (id: string | null) => schemes.find((s) => s.id === id)?.name ?? 'No scheme';
  const done = useMemo(() => withResults(calls), [calls]);
  const t = useMemo(() => totals(calls), [calls]);

  const d = useMemo(() => {
    const play = (c: Done) => playsById.get(c.playId);
    const byPlay = (pred: (c: Done) => boolean) => rank(groupStats(calls.filter((c) => c.result && pred(c as Done)), (c) => c.playId));
    const third = done.filter((c) => c.down === 3);
    const rz = done.filter((c) => ['Red zone', 'Inside 10', 'Goal line'].includes(c.fieldZone));
    return {
      top: byPlay(() => true),
      favs: byPlay((c) => Boolean(favorites[c.playId])),
      screens: byPlay((c) => { const p = play(c); return p ? familiesOf(p).has('screen') : false; }),
      runs: byPlay((c) => { const p = play(c); return p ? isRun(p) : false; }),
      passes: byPlay((c) => { const p = play(c); return p ? !isRun(p) && !familiesOf(p).has('screen') : false; }),
      vsMan: byPlay((c) => MAN.includes(c.result.defenseSeen)),
      vsZone: byPlay((c) => ZONE.includes(c.result.defenseSeen)),
      vsBlitz: byPlay((c) => pressured(c)),
      formations: rank(groupStats(calls, (c) => { const p = play(c); return p ? formationLabel(p) : null; })),
      schemes: rank(groupStats(calls, (c) => schemeName(gamesById.get(c.gameId)?.schemeId ?? null)), 'successRate', 2),
      third: { n: third.length, conv: third.filter((c) => c.result.touchdown || c.result.yards >= c.distance).length },
      rz: { n: rz.length, succ: rz.filter((c) => c.result.success).length, td: rz.filter((c) => c.result.touchdown).length },
      explosive: done.filter((c) => (c.result.isPass ? c.result.yards >= 20 : c.result.yards >= 15)),
      turnovers: done.filter((c) => c.result.turnover),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls, done, playsById, favorites, gamesById, schemes]);

  const breakdown = useMemo(() => {
    const key = (c: Done): string | null => {
      const p = playsById.get(c.playId);
      switch (dim) {
        case 'Coverage': return c.result.defenseSeen;
        case 'Down': return `${c.down}${['', 'st', 'nd', 'rd', 'th'][c.down]} down`;
        case 'Distance': return distanceBucket(c.distance);
        case 'Formation': return p ? formationLabel(p) : null;
        case 'Scheme': return schemeName(gamesById.get(c.gameId)?.schemeId ?? null);
        case 'Opponent': return gamesById.get(c.gameId)?.opponent ?? 'Unknown';
        case 'Field Position': return c.fieldZone;
      }
    };
    return [...groupStats(calls, key).entries()].sort((a, b) => b[1].calls - a[1].calls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls, dim, playsById, gamesById, schemes]);

  return (
    <div>
      <PageHeader title="Stats" sub="Every number here comes from results you recorded — nothing is estimated." />
      <div className="mb-4 flex gap-2">
        <Chip active={tab === 'dash'} onClick={() => setTab('dash')}>Dashboard</Chip>
        <Chip active={tab === 'history'} onClick={() => setTab('history')}>Game history</Chip>
      </div>

      {tab === 'dash' && (done.length === 0 ? <Empty>No recorded results yet. Call plays on the Game Caller and log each result to build your stats.</Empty> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <Kpi label="Plays recorded" value={t.calls} />
            <Kpi label="Avg yards" value={fmtAvg(t.avg)} />
            <Kpi label="Success rate" value={pct(t.successRate)} />
            <Kpi label="3rd down" value={d.third.n ? pct(d.third.conv / d.third.n) : '—'} sub={`${d.third.conv}/${d.third.n} converted`} />
            <Kpi label="Red zone" value={d.rz.n ? pct(d.rz.succ / d.rz.n) : '—'} sub={`${d.rz.td} TDs on ${d.rz.n} snaps`} />
            <Kpi label="Explosive / TO" value={`${d.explosive.length} / ${d.turnovers.length}`} sub={`${t.tds} TDs total`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PlayRank title="Top plays" rows={d.top} />
            <PlayRank title="❤️ Top favorites" rows={d.favs} />
            <KeyRank title="Best formations" rows={d.formations} />
            <KeyRank title="Best schemes" rows={d.schemes} />
            <PlayRank title="🔥 Best screens" rows={d.screens} />
            <PlayRank title="Best runs" rows={d.runs} />
            <PlayRank title="Best passes" rows={d.passes} />
            <PlayRank title="Best vs man" rows={d.vsMan} />
            <PlayRank title="Best vs zone" rows={d.vsZone} />
            <PlayRank title="Best vs blitz / pressure" rows={d.vsBlitz} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <SectionTitle>Explosive plays ({d.explosive.length})</SectionTitle>
              {d.explosive.length === 0 ? <p className="text-sm text-mute">20+ yard passes and 15+ yard runs show here.</p> : (
                <div className="space-y-1">{d.explosive.slice(-10).reverse().map((c) => {
                  const p = playsById.get(c.playId);
                  return <div key={c.id} className="flex items-center gap-2 text-sm"><Badge tone="green">+{c.result.yards}</Badge><span className="truncate">{p ? playLabel(p) : '—'}</span><span className="ml-auto text-xs text-mute">vs {gamesById.get(c.gameId)?.opponent}</span></div>;
                })}</div>
              )}
            </Card>
            <Card className="p-4">
              <SectionTitle>Turnovers ({d.turnovers.length})</SectionTitle>
              {d.turnovers.length === 0 ? <p className="text-sm text-mute">No turnovers recorded. 🔒</p> : (
                <div className="space-y-1">{d.turnovers.slice(-10).reverse().map((c) => {
                  const p = playsById.get(c.playId);
                  return <div key={c.id} className="flex items-center gap-2 text-sm"><Badge tone="red">{c.result.outcome}</Badge><span className="truncate">{p ? playLabel(p) : '—'}</span><span className="ml-auto text-xs text-mute">{c.result.defenseSeen}</span></div>;
                })}</div>
              )}
            </Card>
          </div>

          <Card className="p-4">
            <SectionTitle>Break down by</SectionTitle>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {DIMENSIONS.map((x) => <Chip key={x} size="sm" active={dim === x} onClick={() => setDim(x)}>{x}</Chip>)}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-mute">
                  <tr><th className="py-2">{dim}</th><th>Calls</th><th>Att</th><th>Comp</th><th>Yds</th><th>Avg</th><th>TD</th><th>TO</th><th>Sacks</th><th className="text-right">Success</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {breakdown.map(([k, s]) => (
                    <tr key={k}><td className="py-2 font-semibold capitalize">{k}</td><td>{s.calls}</td><td>{s.attempts}</td><td>{s.completions}</td><td>{s.yards}</td><td>{fmtAvg(s.avg)}</td><td>{s.tds}</td><td>{s.turnovers}</td><td>{s.sacks}</td><td className="text-right">{pct(s.successRate)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ))}

      {tab === 'history' && (
        <div className="space-y-2">
          {games.length === 0 && <Empty>No games yet.</Empty>}
          {games.map((g) => {
            const gc = done.filter((c) => c.gameId === g.id);
            const st = totals(gc);
            const passes = gc.filter((c) => c.result.isPass).length;
            const screens = gc.filter((c) => { const p = playsById.get(c.playId); return p ? familiesOf(p).has('screen') : false; }).length;
            return (
              <button key={g.id} onClick={() => nav(`/games/${g.id}`)} className="block w-full rounded-2xl border border-line bg-coal p-4 text-left hover:border-mute/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-lg font-bold uppercase">vs {g.opponent} {g.status === 'active' && <Badge tone="red">Live</Badge>}</div>
                    <div className="text-xs text-mute">{new Date(g.startedAt).toLocaleDateString()} · {schemeName(g.schemeId)}</div>
                  </div>
                  <div className="font-display text-2xl font-bold">{g.myScore}–{g.oppScore}</div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-mute sm:grid-cols-6">
                  <span>{gc.length} plays</span>
                  <span>Pass/Run {passes}/{gc.length - passes}</span>
                  <span>{screens} screens</span>
                  <span>{fmtAvg(st.avg)} avg yds</span>
                  <span>{st.tds} TDs</span>
                  <span>{st.turnovers} turnovers</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
