import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useActiveGame } from '@/state/store';
import { useEngineContext, useGameCalls } from '@/state/useEngine';
import { recommend, scorePlay, type Scored } from '@/engine/recommend';
import { screenAlert } from '@/engine/screenAlert';
import { situationLabel, yardLineLabel } from '@/engine/situation';
import { playLabel } from '@/engine/classify';
import { NEED_MODES, QUICK_CALLS, QUICK_MODE_LABEL } from '@/lib/constants';
import type { QuickMode } from '@/lib/types';
import { SituationSelector } from '@/components/SituationSelector';
import { CoverageSelector } from '@/components/CoverageSelector';
import { QuickCallButton } from '@/components/QuickCallButton';
import { AnswerCard, PlayRecommendation } from '@/components/PlayRecommendation';
import { ScreenAlert } from '@/components/ScreenAlert';
import { OpponentTendencyCard } from '@/components/OpponentTendencyCard';
import { PlayResultModal } from '@/components/PlayResultModal';
import { FavoriteHeart } from '@/components/FavoriteHeart';
import { Badge, Button, Card, Empty, SectionTitle, cx, inputCls } from '@/components/ui';

export default function GameCaller() {
  const nav = useNavigate();
  const plays = useApp((s) => s.plays);
  const playsById = useApp((s) => s.playsById);
  const situation = useApp((s) => s.situation);
  const pendingCallId = useApp((s) => s.pendingCallId);
  const calls = useApp((s) => s.calls);
  const gamePlans = useApp((s) => s.gamePlans);
  const callPlay = useApp((s) => s.callPlay);
  const startGame = useApp((s) => s.startGame);
  const endGame = useApp((s) => s.endGame);
  const updateGame = useApp((s) => s.updateGame);
  const game = useActiveGame();
  const gameCalls = useGameCalls();

  const [mode, setMode] = useState<QuickMode | null>(null);
  const [asked, setAsked] = useState(false);
  const [rankIdx, setRankIdx] = useState(0);
  const [showSit, setShowSit] = useState(false);
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [dismissedAlertAt, setDismissedAlertAt] = useState(-1);
  const [opp, setOpp] = useState('');
  const [planId, setPlanId] = useState('');

  const ctx = useEngineContext(mode);
  const baseCtx = useEngineContext(null);
  const rec = useMemo(() => (asked ? recommend(ctx) : null), [asked, ctx]);
  const alertRanked = useMemo(() => recommend(baseCtx).ranked, [baseCtx]);
  const alert = useMemo(
    () => (game || situation.pressure !== 'Unknown' ? screenAlert(gameCalls, playsById, situation, alertRanked) : null),
    [game, gameCalls, playsById, situation, alertRanked],
  );
  const alertVisible = alert && dismissedAlertAt !== gameCalls.length;

  useEffect(() => { setRankIdx(0); }, [situation, mode]);

  // Opening script
  const plan = game?.gamePlanId ? gamePlans.find((p) => p.id === game.gamePlanId) : null;
  const scriptItems = plan ? plan.items.filter((i) => i.package === 'Opening Script').sort((a, b) => a.position - b.position).slice(0, plan.scriptLength) : [];
  const nextScript = scriptItems.find((i) => !i.completed);
  const scriptPlay = nextScript ? playsById.get(nextScript.playId) : undefined;
  const scriptScored: Scored | null = scriptPlay ? scorePlay(scriptPlay, ctx) : null;
  const scriptNum = nextScript ? scriptItems.indexOf(nextScript) + 1 : 0;
  const followScript = Boolean(scriptScored && game && !game.adaptive && !mode);

  const ranked = rec?.ranked ?? [];
  const primary: Scored | null = followScript ? scriptScored : ranked[Math.min(rankIdx, ranked.length - 1)] ?? null;

  const recRef = useRef<HTMLDivElement>(null);
  const ask = (m: QuickMode | null) => {
    setMode(m); setAsked(true); setRankIdx(0);
    setTimeout(() => recRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const doCall = (s: Scored) => { const c = callPlay(s.play.id, s.score); setResultFor(c.id); };
  const resultCall = calls.find((c) => c.id === (resultFor ?? '')) ?? null;
  const pendingCall = calls.find((c) => c.id === pendingCallId && !c.result) ?? null;

  if (plays.length === 0) {
    return (
      <Empty>
        No plays loaded yet. An admin can seed or import the Atlanta playbook in <button className="text-red underline" onClick={() => nav('/admin')}>Admin</button>.
      </Empty>
    );
  }

  const situationPanel = (
    <div className="space-y-5">
      <SituationSelector />
      <CoverageSelector />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* GAME BAR */}
      <Card className="flex flex-wrap items-center gap-2 p-2.5">
        {game ? (
          <>
            <Badge tone="red">Live</Badge>
            <span className="font-display text-base font-semibold uppercase">vs {game.opponent}</span>
            <span className="text-sm text-mute">· {gameCalls.length} plays</span>
            {plan && (
              <label className="ml-auto flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-red" checked={game.adaptive} onChange={(e) => updateGame({ adaptive: e.target.checked })} />
                Adaptive mode
              </label>
            )}
            <Button size="sm" tone="ghost" className={plan ? '' : 'ml-auto'} onClick={() => { if (confirm('End this game and save it to history?')) endGame(); }}>End game</Button>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-mute">New game:</span>
            <input className={cx(inputCls, 'h-10 w-40 flex-1 py-1 text-sm sm:flex-none')} placeholder="Opponent" value={opp} onChange={(e) => setOpp(e.target.value)} />
            {gamePlans.length > 0 && (
              <select className={cx(inputCls, 'h-10 w-44 flex-1 py-1 text-sm sm:flex-none')} value={planId} onChange={(e) => setPlanId(e.target.value)} aria-label="Game plan">
                <option value="">No game plan</option>
                {gamePlans.map((p) => <option key={p.id} value={p.id}>{p.opponent || 'Untitled'}</option>)}
              </select>
            )}
            <Button size="sm" tone="red" onClick={() => { startGame(opp, planId || null); setOpp(''); }}>Start game</Button>
            <span className="hidden text-xs text-mute sm:inline">(or just hit CALL IT — a game starts automatically)</span>
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)_320px]">
        {/* LEFT — SITUATION (desktop) */}
        <aside className="hidden lg:block">
          <Card className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4">{situationPanel}</Card>
        </aside>

        {/* CENTER — CALL SHEET */}
        <section className="min-w-0 space-y-4">
          {/* Mobile down & distance strip */}
          <button className="flex w-full items-center justify-between rounded-2xl border border-line bg-coal px-4 py-3 lg:hidden" onClick={() => setShowSit(!showSit)} aria-expanded={showSit}>
            <div className="text-left">
              <div className="font-display text-3xl font-bold uppercase leading-none">{situationLabel(situation)}</div>
              <div className="mt-1 text-xs text-mute">
                {yardLineLabel(situation.yardLine)} · Q{situation.quarter === 5 ? 'OT' : situation.quarter} {situation.clock} · {situation.myScore}–{situation.oppScore} · {situation.coverage}
              </div>
            </div>
            <span className="text-sm font-semibold text-red">{showSit ? 'Done ▲' : 'Edit ▼'}</span>
          </button>
          {showSit && <Card className="p-4 lg:hidden">{situationPanel}</Card>}

          <button
            onClick={() => ask(null)}
            className="flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl bg-red font-display text-2xl font-bold uppercase tracking-wide shadow-[0_8px_30px_rgba(225,29,46,0.35)] transition active:scale-[0.99] sm:text-3xl"
          >
            🧠 What should I call?
          </button>

          {alertVisible && alert && (
            <ScreenAlert alert={alert} onDismiss={() => setDismissedAlertAt(gameCalls.length)} onCall={() => alert.play && doCall(alert.play)} />
          )}

          {rec && (
            <div className="scroll-mt-20 space-y-3" ref={recRef}>
              {mode && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge tone="red">{QUICK_MODE_LABEL[mode]}</Badge>
                  <button className="text-mute hover:text-white" onClick={() => setMode(null)}>clear mode</button>
                </div>
              )}
              {rec.modeNote && <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-200">{rec.modeNote}</div>}
              {primary && (
                <PlayRecommendation
                  scored={primary}
                  situation={situation}
                  onCall={() => doCall(primary)}
                  onNext={() => setRankIdx((i) => (i + 1) % Math.max(1, ranked.length))}
                  rank={followScript ? 0 : rankIdx}
                  total={followScript ? 1 : ranked.length}
                  scriptNote={followScript ? `Script #${scriptNum}` : null}
                />
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <AnswerCard label="Counter" scored={rec.counter} onCall={doCall} />
                <AnswerCard label="🔥 Screen" scored={rec.screen} onCall={doCall} />
                <AnswerCard label="Run answer" scored={rec.run} onCall={doCall} />
                <AnswerCard label="Shot answer" scored={rec.shot} onCall={doCall} />
              </div>
            </div>
          )}

          {nextScript && scriptPlay && (
            <Card className="flex items-center gap-3 border-amber-700/60 p-3">
              <Badge tone="amber">Script #{scriptNum}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm">{playLabel(scriptPlay)}</span>
              {game?.adaptive && <span className="hidden text-xs text-mute sm:inline">Adaptive: engine may deviate</span>}
              <FavoriteHeart playId={scriptPlay.id} size="sm" />
              <Button size="sm" tone="outline" onClick={() => scriptScored && doCall(scriptScored)}>Call</Button>
            </Card>
          )}

          <div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {QUICK_CALLS.map((q) => (
                <QuickCallButton key={q.mode} label={q.label} tone={q.tone} active={asked && mode === q.mode}
                  onClick={() => ask(asked && mode === q.mode ? null : q.mode)} />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {NEED_MODES.map((q) => (
                <QuickCallButton key={q.mode} label={q.label} active={asked && mode === q.mode} onClick={() => ask(asked && mode === q.mode ? null : q.mode)} />
              ))}
            </div>
          </div>

          {!rec && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button onClick={() => nav('/favorites')}>❤️ Favorites</Button>
              <Button onClick={() => nav('/screens')}>🔥 Screen Center</Button>
              <Button onClick={() => nav('/game-plan')}>📋 Game plan</Button>
              <Button onClick={() => nav('/stats')}>📊 Stats</Button>
            </div>
          )}
        </section>

        {/* RIGHT — TENDENCIES */}
        <aside className="space-y-4">
          <OpponentTendencyCard t={ctx.tendencies} opponent={game?.opponent} />
        </aside>
      </div>

      {/* BOTTOM — RECENT PLAYS */}
      <Card className="p-4">
        <SectionTitle>Recent plays{game ? ` · vs ${game.opponent}` : ''}</SectionTitle>
        {gameCalls.length === 0 ? (
          <p className="text-sm text-mute">Calls you make this game show up here with their results.</p>
        ) : (
          <div className="divide-y divide-line">
            {[...gameCalls].reverse().slice(0, 12).map((c) => {
              const p = playsById.get(c.playId);
              return (
                <div key={c.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="w-6 text-center font-display text-mute">{c.sequence}</span>
                  <span className="w-20 shrink-0 text-xs text-mute">{situationLabel(c)}</span>
                  <span className="min-w-0 flex-1 truncate">{p ? playLabel(p) : 'Removed play'}</span>
                  {c.result ? (
                    <button onClick={() => setResultFor(c.id)}>
                      <Badge tone={c.result.turnover ? 'red' : c.result.success ? 'green' : 'dark'}>
                        {c.result.outcome}{['TD', 'Incomplete', 'INT'].includes(c.result.outcome) ? '' : ` ${c.result.yards > 0 ? '+' : ''}${c.result.yards}`}
                        {c.result.defenseSeen !== 'Unknown' ? ` · ${c.result.defenseSeen}` : ''}
                      </Badge>
                    </button>
                  ) : (
                    <Button size="sm" tone="outline" onClick={() => setResultFor(c.id)}>Result</Button>
                  )}
                  {p && <FavoriteHeart playId={p.id} size="sm" />}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Mobile one-thumb result bar */}
      {pendingCall && !resultFor && (
        <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 p-3 lg:bottom-4 lg:left-auto lg:right-6 lg:w-96">
          <button onClick={() => setResultFor(pendingCall.id)}
            className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-white font-display text-xl font-bold uppercase text-black shadow-2xl">
            Record result · {playsById.get(pendingCall.playId)?.playName ?? ''}
          </button>
        </div>
      )}

      <PlayResultModal call={resultCall} open={Boolean(resultCall)} onClose={() => setResultFor(null)} />
    </div>
  );
}
