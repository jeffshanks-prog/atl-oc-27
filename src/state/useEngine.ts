import { useMemo } from 'react';
import { useApp, useActiveScheme } from './store';
import { statsByPlay, statsByPlayAndDefense } from '@/analytics/stats';
import { computeTendencies } from '@/engine/tendencies';
import type { EngineContext } from '@/engine/recommend';
import type { QuickMode, Situation } from '@/lib/types';
import { predictDefense, type DefensePrediction } from '@/engine/predict';
import { defenseSeenToCoverage } from '@/engine/classify';

/** When you haven't picked a coverage, use the predicted one (only once the prediction has a real lean). */
export function withPrediction(s: Situation, p: DefensePrediction): Situation {
  if (!p.ready || p.strength === 'mixed') return s;
  const out = { ...s };
  if (s.coverage === 'Unknown' && p.coverage) out.coverage = defenseSeenToCoverage(p.coverage) ?? s.coverage;
  if (s.pressure === 'Unknown' && p.blitzProb >= 0.5) out.pressure = 'Blitz';
  return out;
}

/** Assembles everything the recommendation engine needs from app state. */
export function useEngineContext(quickMode: QuickMode | null): EngineContext {
  const plays = useApp((s) => s.plays);
  const playsById = useApp((s) => s.playsById);
  const favorites = useApp((s) => s.favorites);
  const calls = useApp((s) => s.calls);
  const activeGameId = useApp((s) => s.activeGameId);
  const situation = useApp((s) => s.situation);
  const scheme = useActiveScheme();

  const stats = useMemo(() => statsByPlay(calls), [calls]);
  const statsByDefense = useMemo(() => statsByPlayAndDefense(calls), [calls]);
  const gameCalls = useMemo(() => calls.filter((c) => c.gameId === activeGameId), [calls, activeGameId]);
  const tendencies = useMemo(() => computeTendencies(gameCalls), [gameCalls]);
  const prediction = useMemo(() => predictDefense(gameCalls, situation), [gameCalls, situation]);
  const effective = useMemo(() => withPrediction(situation, prediction), [situation, prediction]);

  return useMemo(
    () => ({ plays, scheme, favorites, stats, statsByDefense, tendencies, recentCalls: gameCalls, situation: effective, quickMode, playsById }),
    [plays, scheme, favorites, stats, statsByDefense, tendencies, gameCalls, effective, quickMode, playsById],
  );
}

export function useGameCalls() {
  const calls = useApp((s) => s.calls);
  const activeGameId = useApp((s) => s.activeGameId);
  return useMemo(() => calls.filter((c) => c.gameId === activeGameId).sort((a, b) => a.sequence - b.sequence), [calls, activeGameId]);
}

export function usePlayStats() {
  const calls = useApp((s) => s.calls);
  return useMemo(() => statsByPlay(calls), [calls]);
}

/** The defense prediction for the snap on screen. */
export function useDefensePrediction(): DefensePrediction {
  const calls = useApp((s) => s.calls);
  const activeGameId = useApp((s) => s.activeGameId);
  const situation = useApp((s) => s.situation);
  return useMemo(() => predictDefense(calls.filter((c) => c.gameId === activeGameId), situation), [calls, activeGameId, situation]);
}
