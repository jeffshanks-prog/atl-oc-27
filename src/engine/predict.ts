// Anticipate the defense: after enough recorded snaps, predict this snap's coverage and blitz chance
// from what the opponent called in similar situations earlier in the game.
import type { DefenseSeen, PlayCall, PlayResult, Situation } from '../lib/types.ts';
import { distanceBucket } from './situation.ts';

export const PREDICT_AFTER = 15;
const COVS: DefenseSeen[] = ['C0', 'C1', 'C2', 'C3', 'C4', 'C6', 'Man'];
export const COV_NAME: Record<string, string> = {
  C0: 'Cover 0', C1: 'Cover 1', C2: 'Cover 2', C3: 'Cover 3', C4: 'Cover 4', C6: 'Cover 6', Man: 'Man',
};

export interface DefensePrediction {
  ready: boolean;
  snaps: number;            // snaps with an identified coverage
  needed: number;           // snaps still needed before predictions start
  coverage: DefenseSeen | null;
  prob: number;             // 0-1 for the top coverage
  dist: { cov: DefenseSeen; p: number }[];
  blitzProb: number;
  strength: 'strong' | 'lean' | 'mixed';
  similar: number;          // past snaps in the same down & distance range
  reasons: string[];
}

type Done = PlayCall & { result: PlayResult };
const blitzed = (c: Done) =>
  c.result.defenseSeen === 'Blitz' || c.result.observations.includes('Blitz called') || c.result.observations.includes('Heavy pressure');
const coverOf = (c: Done): DefenseSeen | null => (COVS.includes(c.result.defenseSeen) ? c.result.defenseSeen : null);
const redZone = (y: number) => y >= 80;
const dName = (d: number) => ['', '1st', '2nd', '3rd', '4th'][d];
const bName = (b: string) => (b === 'short' ? 'short' : b === 'medium' ? 'medium' : 'long');

export function predictDefense(gameCalls: PlayCall[], s: Pick<Situation, 'down' | 'distance' | 'yardLine'>): DefensePrediction {
  const done = gameCalls.filter((c): c is Done => c.result !== null).sort((a, b) => a.sequence - b.sequence);
  const known = done.filter((c) => coverOf(c));
  const snaps = known.length;
  const base: DefensePrediction = {
    ready: false, snaps, needed: Math.max(0, PREDICT_AFTER - snaps), coverage: null, prob: 0, dist: [], blitzProb: 0,
    strength: 'mixed', similar: 0, reasons: [],
  };
  if (snaps < PREDICT_AFTER) return base;

  const bucket = distanceBucket(s.distance);
  const rz = redZone(s.yardLine);
  const last = known[known.length - 1];
  const lastCov = last ? coverOf(last) : null;

  const w: Record<string, number> = {};
  let wSum = 0, wBlitz = 0, similar = 0;
  const simCounts: Record<string, number> = {};
  const afterCounts: Record<string, number> = {};
  let afterTotal = 0;

  known.forEach((c, i) => {
    const cov = coverOf(c)!;
    const sameDown = c.down === s.down;
    const sameBucket = distanceBucket(c.distance) === bucket;
    const sameZone = redZone(c.yardLine) === rz;
    // what did they call right after they last called the same thing they just called?
    const prevCov = i > 0 ? coverOf(known[i - 1]) : null;
    const sameSequence = lastCov !== null && prevCov === lastCov;
    let weight = (sameDown && sameBucket ? 8 : sameDown || sameBucket ? 2 : 0.4) * (sameZone ? 2 : 1) * (sameSequence ? 1.5 : 1);
    weight *= Math.pow(0.97, known.length - 1 - i); // newer snaps count more — defenses adjust
    w[cov] = (w[cov] ?? 0) + weight;
    wSum += weight;
    if (blitzed(c)) wBlitz += weight;
    if (sameDown && sameBucket) { similar++; simCounts[cov] = (simCounts[cov] ?? 0) + 1; }
    if (sameSequence) { afterTotal++; afterCounts[cov] = (afterCounts[cov] ?? 0) + 1; }
  });

  // light smoothing so one snap never reads as 100%
  const alpha = 0.3;
  const dist = COVS.map((cov) => ({ cov, p: ((w[cov] ?? 0) + alpha) / (wSum + alpha * COVS.length) }))
    .sort((a, b) => b.p - a.p);
  const top = dist[0];
  const strength = top.p >= 0.55 ? 'strong' : top.p >= 0.4 ? 'lean' : 'mixed';

  const reasons: string[] = [];
  if (similar >= 2) {
    const [sc, sn] = Object.entries(simCounts).sort((a, b) => b[1] - a[1])[0];
    reasons.push(`On ${dName(s.down)} & ${bName(bucket)} they've played ${COV_NAME[sc]} on ${sn} of ${similar} snaps.`);
  }
  if (afterTotal >= 2 && lastCov) {
    const [ac, an] = Object.entries(afterCounts).sort((a, b) => b[1] - a[1])[0];
    reasons.push(`After ${COV_NAME[lastCov]}, they've come back with ${COV_NAME[ac]} ${an} of ${afterTotal} times.`);
  }
  const overall = COVS.map((c) => [c, known.filter((k) => coverOf(k) === c).length] as const).sort((a, b) => b[1] - a[1])[0];
  reasons.push(`Game total: ${COV_NAME[overall[0]]} on ${overall[1]} of ${snaps} snaps.`);
  const blitzProb = wSum ? wBlitz / wSum : 0;
  if (blitzProb >= 0.4) reasons.push(`Pressure likely — they've sent it on ${Math.round(blitzProb * 100)}% of similar snaps.`);

  return { ...base, ready: true, coverage: top.cov, prob: top.p, dist, blitzProb, strength, similar, reasons };
}
