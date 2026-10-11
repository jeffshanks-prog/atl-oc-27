import { useMemo } from 'react';
import { useApp, useActiveScheme } from './store';
import { statsByPlay, statsByPlayAndDefense } from '@/analytics/stats';
import { computeTendencies } from '@/engine/tendencies';
import type { EngineContext } from '@/engine/recommend';
import type { QuickMode } from '@/lib/types';

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

  return useMemo(
    () => ({ plays, scheme, favorites, stats, statsByDefense, tendencies, recentCalls: gameCalls, situation, quickMode, playsById }),
    [plays, scheme, favorites, stats, statsByDefense, tendencies, gameCalls, situation, quickMode, playsById],
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
