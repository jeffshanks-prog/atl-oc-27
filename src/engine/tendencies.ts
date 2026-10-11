// Opponent tendency engine — built only from results the user recorded this game.
import type { DefenseSeen, PlayCall, PlayResult } from '../lib/types.ts';

export const TRACKED_COVERAGES: DefenseSeen[] = ['C0', 'C1', 'C2', 'C3', 'C4', 'C6', 'Man'];
const COVERAGE_NAME: Record<string, string> = {
  C0: 'Cover 0', C1: 'Cover 1', C2: 'Cover 2', C3: 'Cover 3', C4: 'Cover 4', C6: 'Cover 6', Man: 'Man',
};

export interface Tendencies {
  snaps: number;              // recorded results
  coverageSamples: number;    // results where a coverage was identified
  coverage: Record<string, number>; // share of ALL recorded snaps (0-1)
  coverageDist: Record<string, number>; // share among identified coverages (0-1) — used by the engine
  blitz: number;
  press: number;
  loadedBox: number;
  lightBox: number;
  softCoverage: number;
  jumpedFlat: number;   // rate over last 10
  jumpedScreen: number; // rate over last 10
  coveredMiddle: number; // rate over last 10
  heavyPressure: number;
  insights: string[];
}

type Done = PlayCall & { result: PlayResult };

function isPressure(r: PlayResult, c: PlayCall): boolean {
  return r.defenseSeen === 'Blitz' || r.observations.includes('Heavy pressure') || r.observations.includes('Edge rush')
    || ['Blitz', 'Heavy blitz', 'Double mug'].includes(c.pressure);
}

function rate(list: Done[], pred: (c: Done) => boolean): number {
  return list.length ? list.filter(pred).length / list.length : 0;
}

export function computeTendencies(gameCalls: PlayCall[]): Tendencies {
  const done = gameCalls.filter((c): c is Done => c.result !== null)
    .sort((a, b) => a.sequence - b.sequence);
  const snaps = done.length;
  const coverage: Record<string, number> = {};
  const coverageDist: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const c of done) {
    const d = c.result.defenseSeen;
    if (TRACKED_COVERAGES.includes(d)) counts[d] = (counts[d] ?? 0) + 1;
  }
  const coverageSamples = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const k of TRACKED_COVERAGES) {
    coverage[k] = snaps ? (counts[k] ?? 0) / snaps : 0;
    coverageDist[k] = coverageSamples ? (counts[k] ?? 0) / coverageSamples : 0;
  }
  const obs = (o: string) => (c: Done) => c.result.observations.includes(o);
  const last10 = done.slice(-10);

  const t: Tendencies = {
    snaps, coverageSamples, coverage, coverageDist,
    blitz: rate(done, (c) => isPressure(c.result, c)),
    press: rate(done, (c) => obs('Press coverage')(c) || c.alignment.includes('Press')),
    loadedBox: rate(done, (c) => obs('Loaded box')(c) || c.alignment.includes('Loaded box')),
    lightBox: rate(done, (c) => obs('Light box')(c) || c.alignment.includes('Light box')),
    softCoverage: rate(done, (c) => obs('Soft coverage')(c) || c.alignment.includes('Off coverage')),
    jumpedFlat: rate(last10, obs('User jumped flat')),
    jumpedScreen: rate(last10, obs('User jumped screen')),
    coveredMiddle: rate(last10, obs('User covered middle')),
    heavyPressure: rate(last10, (c) => obs('Heavy pressure')(c) || obs('Edge rush')(c)),
    insights: [],
  };

  // ---- plain-language insights (observations, not certainties) ----
  if (snaps >= 3) {
    const top = TRACKED_COVERAGES.map((k) => [k, t.coverage[k]] as const).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 0) t.insights.push(`Opponent has shown ${COVERAGE_NAME[top[0]]} on ${Math.round(top[1] * 100)}% of recorded snaps.`);
    if (t.blitz >= 0.4) t.insights.push(`Pressure seen on ${Math.round(t.blitz * 100)}% of recorded snaps.`);
  }
  if (done.length >= 8) {
    const recent = done.slice(-10);
    const earlier = done.slice(0, -10);
    const recentBlitz = rate(recent, (c) => isPressure(c.result, c));
    const earlierBlitz = earlier.length >= 4 ? rate(earlier, (c) => isPressure(c.result, c)) : null;
    if (earlierBlitz !== null && recentBlitz - earlierBlitz >= 0.15) t.insights.push('Blitz rate has increased over the last 10 plays.');
    if (earlierBlitz !== null && earlierBlitz - recentBlitz >= 0.15) t.insights.push('Blitz rate has dropped over the last 10 plays.');
  }
  const underneath = last10.filter((c) => obs('User jumped flat')(c) || obs('User jumped screen')(c) || obs('User covered middle')(c)).length;
  if (underneath >= 2) t.insights.push('Opponent has started jumping underneath routes.');
  if (t.loadedBox >= 0.4 && snaps >= 4) t.insights.push('Loaded boxes are showing up often — passes and RPO keep them honest.');
  if (t.lightBox >= 0.4 && snaps >= 4) t.insights.push('Light boxes are showing up often — the run game should be available.');
  return t;
}
