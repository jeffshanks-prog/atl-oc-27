// Screen Alert engine — flags moments where a screen is a strong strategic option.
// Recommendations, never certainties.
import type { Play, PlayCall, Situation } from '../lib/types.ts';
import type { Scored } from './recommend.ts';
import { familiesOf, isPassPlay } from './classify.ts';

export interface ScreenAlertResult {
  reasons: string[];
  play: Scored | null;
  counters: string;
}

const PRESSURE_CALLS = new Set(['Blitz', 'Heavy blitz', 'Double mug', 'Edge pressure']);

export function screenAlert(
  gameCalls: PlayCall[],
  playsById: Map<string, Play>,
  s: Situation,
  rankedAll: Scored[],
): ScreenAlertResult | null {
  const done = gameCalls.filter((c) => c.result).sort((a, b) => b.sequence - a.sequence);
  const reasons: string[] = [];

  const passes = done.filter((c) => {
    const p = playsById.get(c.playId);
    return p ? isPassPlay(p) && !familiesOf(p).has('screen') : false;
  }).slice(0, 6);
  const pressured = passes.filter((c) => c.result!.defenseSeen === 'Blitz'
    || c.result!.observations.includes('Heavy pressure') || c.result!.observations.includes('Edge rush')
    || c.result!.sack || PRESSURE_CALLS.has(c.pressure)).length;
  if (passes.length >= 3 && pressured / passes.length >= 0.5) {
    reasons.push(`Opponent has brought pressure on ${pressured} of the last ${passes.length} pass attempts.`);
  }

  const last8 = done.slice(0, 8);
  const sacks = last8.filter((c) => c.result!.sack).length;
  if (sacks >= 2) reasons.push(`${sacks} sacks in the last ${last8.length} snaps — the rush is winning.`);

  const edge = last8.filter((c) => c.result!.observations.includes('Edge rush')).length;
  if (edge >= 2) reasons.push(`Edge rush noted ${edge} times recently — rushers are getting upfield.`);

  const userRush = last8.filter((c) => c.result!.observations.includes('Heavy pressure')).length;
  if (userRush >= 3) reasons.push('Repeated heavy pressure — the defense is selling out to get home.');

  if ((s.pressure === 'Heavy blitz' || s.pressure === 'Double mug') && s.distance >= 7) {
    reasons.push(`Long yardage (${Math.round(s.distance)}) into a ${s.pressure.toLowerCase()} look.`);
  } else if (PRESSURE_CALLS.has(s.pressure) && reasons.length === 0) {
    reasons.push(`${s.pressure} showing pre-snap.`);
  }

  // Screens being jumped? Then it's not the moment.
  const jumped = last8.filter((c) => c.result!.observations.includes('User jumped screen')).length;
  if (jumped >= 2) return null;

  if (!reasons.length) return null;
  const play = rankedAll.find((x) => familiesOf(x.play).has('screen')) ?? null;
  return { reasons, play, counters: 'Spacing / Run / Play Action' };
}
