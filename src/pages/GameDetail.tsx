import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/state/store';
import { computeTendencies } from '@/engine/tendencies';
import { situationLabel, yardLineLabel } from '@/engine/situation';
import { playLabel } from '@/engine/classify';
import { OpponentTendencyCard } from '@/components/OpponentTendencyCard';
import { PlayResultModal } from '@/components/PlayResultModal';
import { FavoriteHeart } from '@/components/FavoriteHeart';
import { Badge, Card, Empty, PageHeader } from '@/components/ui';

export default function GameDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const game = useApp((s) => s.games.find((g) => g.id === id));
  const calls = useApp((s) => s.calls);
  const playsById = useApp((s) => s.playsById);
  const [edit, setEdit] = useState<string | null>(null);
  const gc = useMemo(() => calls.filter((c) => c.gameId === id).sort((a, b) => a.sequence - b.sequence), [calls, id]);
  const t = useMemo(() => computeTendencies(gc), [gc]);
  if (!game) return <Empty>Game not found.</Empty>;
  const editing = gc.find((c) => c.id === edit) ?? null;
  return (
    <div className="space-y-4">
      <button className="text-sm text-mute hover:text-white" onClick={() => nav(-1)}>← Back</button>
      <PageHeader title={`vs ${game.opponent}`} sub={`${new Date(game.startedAt).toLocaleString()} · Final ${game.myScore}–${game.oppScore}`} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="divide-y divide-line">
          {gc.length === 0 && <div className="p-4 text-sm text-mute">No plays recorded.</div>}
          {gc.map((c) => {
            const p = playsById.get(c.playId);
            return (
              <div key={c.id} className="flex items-center gap-2 p-3 text-sm">
                <span className="w-6 font-display text-mute">{c.sequence}</span>
                <div className="w-28 shrink-0 text-xs text-mute">
                  <div className="font-semibold text-white">{situationLabel(c)}</div>
                  {yardLineLabel(c.yardLine)} · Q{c.quarter === 5 ? 'OT' : c.quarter} {c.clock}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{p ? playLabel(p) : 'Removed play'}</div>
                  <div className="text-xs text-mute">Pre-snap: {c.coverage}{c.pressure !== 'Unknown' ? ` · ${c.pressure}` : ''}{c.matchScore !== null ? ` · ${c.matchScore}% match` : ''}</div>
                  {c.result?.observations.length ? <div className="text-xs text-mute">{c.result.observations.join(', ')}</div> : null}
                </div>
                <button onClick={() => setEdit(c.id)}>
                  {c.result
                    ? <Badge tone={c.result.turnover ? 'red' : c.result.success ? 'green' : 'dark'}>{c.result.outcome} {c.result.yards !== 0 ? `${c.result.yards > 0 ? '+' : ''}${c.result.yards}` : ''} · {c.result.defenseSeen}</Badge>
                    : <Badge tone="amber">No result</Badge>}
                </button>
                {p && <FavoriteHeart playId={p.id} size="sm" />}
              </div>
            );
          })}
        </Card>
        <OpponentTendencyCard t={t} opponent={game.opponent} />
      </div>
      <PlayResultModal call={editing} open={Boolean(editing)} onClose={() => setEdit(null)} />
    </div>
  );
}
