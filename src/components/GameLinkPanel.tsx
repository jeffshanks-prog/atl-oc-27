import { useEffect, useState } from 'react';
import { canLinkScreen, useGameLink } from '@/vision/linkStore';
import { defenseFromCall } from '@/vision/defenseCall';
import { Badge, Button, Card, cx } from './ui';

const ord = (n: number) => ['', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`;

/** Desktop-only bar: share the Madden window and the Game Caller follows the game by itself. */
export function GameLinkPanel() {
  const s = useGameLink();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (s.status !== 'live') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s.status]);

  if (!canLinkScreen()) return null;

  if (s.status !== 'live') {
    return (
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="font-display text-base font-semibold uppercase tracking-wide">🎮 Link Madden screen</div>
          <div className="text-xs text-mute">
            Share your Madden window and the app reads the scoreboard: down, distance, ball spot, clock and score.
            It also reads the defense from the Previous Play box and logs each result. Nothing leaves this browser.
          </div>
          {s.status === 'error' && s.error && <div className="mt-1 text-xs text-amber-300">{s.error}</div>}
        </div>
        <Button tone="red" onClick={() => void s.start()} disabled={s.status === 'starting'}>
          {s.status === 'starting' ? 'Choose the window…' : 'Link game screen'}
        </Button>
      </Card>
    );
  }

  const r = s.read;
  const stale = !r || now - s.readAt > 4000;
  const mine = r && r.possession === s.mySide;
  const lastDef = s.prev ? defenseFromCall(s.prev.defense) : null;
  const myScore = r ? (s.mySide === 'left' ? r.leftScore : r.rightScore) : 0;
  const oppScore = r ? (s.mySide === 'left' ? r.rightScore : r.leftScore) : 0;

  return (
    <Card className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx('h-2.5 w-2.5 rounded-full', stale ? 'bg-amber-400' : 'bg-emerald-400')} aria-hidden />
        <span className="font-display text-sm font-semibold uppercase tracking-wide">Game linked</span>
        {stale ? (
          <span className="text-sm text-mute">Waiting for the play-call screen…</span>
        ) : r && (
          <span className="text-sm">
            <b>{ord(r.down)} &amp; {r.distanceKind === 'goal' ? 'Goal' : r.distanceKind === 'inches' ? 'Inches' : r.distance}</b>
            <span className="text-mute"> · {r.spotSide === 'mid' ? 'Midfield' : `${r.spotSide === 'own' ? 'Own' : 'Opp'} ${r.spot}`}
              {' '}· Q{r.quarter === 5 ? 'OT' : r.quarter} {r.clock} · {myScore}–{oppScore}</span>
            {' '}<Badge tone={mine ? 'green' : 'dark'}>{mine ? 'Your ball' : 'Their ball'}</Badge>
          </span>
        )}
        <Button size="sm" tone="ghost" className="ml-auto" onClick={s.stop}>Unlink</Button>
      </div>

      {s.aspectWarning && (
        <div className="text-xs text-amber-300">This window isn't 16:9. Run Madden full screen or borderless, and share that window, so the scoreboard lines up.</div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
        {lastDef && (
          <span>Last defense: <b className="text-white">{lastDef.name}</b>{lastDef.seen !== 'Unknown' ? ` (${lastDef.seen}${lastDef.blitz ? ' + blitz' : ''})` : lastDef.blitz ? ' (blitz)' : ''}</span>
        )}
        {s.lastLogged && <span>{s.lastLogged}</span>}
        <span className="ml-auto flex items-center gap-2">
          My team on scoreboard:
          <button className={cx('rounded-lg border px-2 py-0.5', s.mySide === 'left' ? 'border-red text-white' : 'border-line')} onClick={() => s.setMySide('left')}>Left</button>
          <button className={cx('rounded-lg border px-2 py-0.5', s.mySide === 'right' ? 'border-red text-white' : 'border-line')} onClick={() => s.setMySide('right')}>Right</button>
        </span>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="h-4 w-4 accent-red" checked={s.autoLog} onChange={(e) => s.setAutoLog(e.target.checked)} />
          Auto-log results
        </label>
      </div>
    </Card>
  );
}
