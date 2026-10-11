// Statistics are computed ONLY from stored user results. Nothing is estimated.
import type { DefenseSeen, PlayCall, PlayResult } from '../lib/types.ts';

export interface PlayStat {
  calls: number;
  attempts: number;
  completions: number;
  yards: number;
  avg: number;
  tds: number;
  turnovers: number;
  sacks: number;
  successes: number;
  successRate: number; // 0-1
  explosives: number;
}

export function emptyStat(): PlayStat {
  return { calls: 0, attempts: 0, completions: 0, yards: 0, avg: 0, tds: 0, turnovers: 0, sacks: 0, successes: 0, successRate: 0, explosives: 0 };
}

export function isExplosive(r: PlayResult): boolean {
  return r.isPass ? r.yards >= 20 : r.yards >= 15;
}

export function addResult(st: PlayStat, r: PlayResult): void {
  st.calls += 1;
  if (r.isPass) st.attempts += 1;
  if (r.completed) st.completions += 1;
  st.yards += r.yards;
  if (r.touchdown) st.tds += 1;
  if (r.turnover) st.turnovers += 1;
  if (r.sack) st.sacks += 1;
  if (r.success) st.successes += 1;
  if (isExplosive(r)) st.explosives += 1;
  st.avg = st.yards / st.calls;
  st.successRate = st.successes / st.calls;
}

export function withResults(calls: PlayCall[]): (PlayCall & { result: PlayResult })[] {
  return calls.filter((c): c is PlayCall & { result: PlayResult } => c.result !== null);
}

export function groupStats<K>(calls: PlayCall[], keyFn: (c: PlayCall & { result: PlayResult }) => K | null | K[]): Map<K, PlayStat> {
  const m = new Map<K, PlayStat>();
  for (const c of withResults(calls)) {
    const k = keyFn(c);
    if (k === null) continue;
    const keys = Array.isArray(k) ? k : [k];
    for (const key of keys) {
      let st = m.get(key);
      if (!st) { st = emptyStat(); m.set(key, st); }
      addResult(st, c.result);
    }
  }
  return m;
}

export function statsByPlay(calls: PlayCall[]): Map<string, PlayStat> {
  return groupStats(calls, (c) => c.playId);
}

export function statsByPlayAndDefense(calls: PlayCall[]): Map<string, Map<DefenseSeen, PlayStat>> {
  const out = new Map<string, Map<DefenseSeen, PlayStat>>();
  for (const c of withResults(calls)) {
    let inner = out.get(c.playId);
    if (!inner) { inner = new Map(); out.set(c.playId, inner); }
    let st = inner.get(c.result.defenseSeen);
    if (!st) { st = emptyStat(); inner.set(c.result.defenseSeen, st); }
    addResult(st, c.result);
  }
  return out;
}

export function totals(calls: PlayCall[]): PlayStat {
  const st = emptyStat();
  for (const c of withResults(calls)) addResult(st, c.result);
  return st;
}

/** Rank entries; require a minimum sample so one lucky call doesn't top the list. */
export function rank<K>(m: Map<K, PlayStat>, by: 'successRate' | 'avg' | 'calls' = 'successRate', minCalls = 2, limit = 5): [K, PlayStat][] {
  return [...m.entries()]
    .filter(([, s]) => s.calls >= minCalls)
    .sort((a, b) => b[1][by] - a[1][by] || b[1].calls - a[1].calls)
    .slice(0, limit);
}

export function pct(n: number): string { return `${Math.round(n * 100)}%`; }
export function fmtAvg(n: number): string { return (Math.round(n * 10) / 10).toFixed(1); }
