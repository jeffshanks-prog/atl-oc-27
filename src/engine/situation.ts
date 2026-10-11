import type { Down, FieldZone, Outcome, PlayResult, Situation } from '../lib/types.ts';

export function zoneFromYardLine(y: number): FieldZone {
  if (y <= 5) return 'Own goal line';
  if (y < 45) return 'Own territory';
  if (y <= 55) return 'Midfield';
  if (y < 80) return 'Opponent territory';
  if (y < 90) return 'Red zone';
  if (y < 97) return 'Inside 10';
  return 'Goal line';
}

export function yardLineLabel(y: number): string {
  if (y === 50) return '50';
  return y < 50 ? `OWN ${y}` : `OPP ${100 - y}`;
}

export function distanceLabel(d: number): string {
  if (d < 1) return 'Inches';
  if (d === 13) return '11–15';
  if (d === 18) return '16+';
  return String(Math.round(d * 10) / 10);
}

export function downLabel(d: Down): string {
  return ['', '1st', '2nd', '3rd', '4th'][d];
}

export function situationLabel(s: Pick<Situation, 'down' | 'distance' | 'yardLine'>): string {
  const goal = 100 - s.yardLine <= s.distance;
  return `${downLabel(s.down)} & ${goal ? 'Goal' : distanceLabel(s.distance)}`;
}

export type DistanceBucket = 'short' | 'medium' | 'long';
export function distanceBucket(d: number): DistanceBucket {
  return d <= 3 ? 'short' : d <= 7 ? 'medium' : 'long';
}

export function clockToSeconds(c: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(c.trim());
  if (!m) return 900;
  return Number(m[1]) * 60 + Number(m[2]);
}
export function normalizeClock(c: string): string {
  const digits = c.replace(/[^\d]/g, '').slice(-4);
  if (!digits) return '15:00';
  const pad = digits.padStart(3, '0');
  const mm = pad.slice(0, -2);
  const ss = Math.min(59, Number(pad.slice(-2)));
  return `${Math.min(15, Number(mm))}:${String(ss).padStart(2, '0')}`;
}

export type ScoreState = 'Winning' | 'Losing' | 'Tied';
export function scoreState(s: Pick<Situation, 'myScore' | 'oppScore'>): ScoreState {
  return s.myScore > s.oppScore ? 'Winning' : s.myScore < s.oppScore ? 'Losing' : 'Tied';
}

export function isTwoMinute(s: Situation): boolean {
  const secs = clockToSeconds(s.clock);
  return ((s.quarter === 2 || s.quarter === 4) && secs <= 120) || (s.quarter === 4 && s.myScore < s.oppScore && secs <= 300);
}
export function isFourMinute(s: Situation): boolean {
  return s.quarter === 4 && s.myScore > s.oppScore && clockToSeconds(s.clock) <= 300;
}

/** Standard success rate definition: 40% of needed on 1st, 60% on 2nd, 100% on 3rd/4th. */
export function isSuccess(down: Down, distance: number, yards: number, touchdown: boolean, turnover: boolean): boolean {
  if (turnover) return false;
  if (touchdown) return true;
  const need = down === 1 ? 0.4 : down === 2 ? 0.6 : 1;
  return yards >= Math.max(0.5, distance) * need - 1e-9 && yards > 0;
}

export function defaultYards(outcome: Outcome, s: Pick<Situation, 'yardLine'>): number {
  switch (outcome) {
    case 'TD': return 100 - s.yardLine;
    case '+20': return 20;
    case '+10': return 10;
    case '+5': return 5;
    case '+3': return 3;
    case '+1': return 1;
    case 'Loss': return -2;
    case 'Sack': return -6;
    default: return 0;
  }
}

export function freshSituation(prev?: Partial<Situation>): Situation {
  return {
    down: 1, distance: 10, yardLine: 25, quarter: prev?.quarter ?? 1, clock: prev?.clock ?? '15:00',
    myScore: prev?.myScore ?? 0, oppScore: prev?.oppScore ?? 0,
    coverage: 'Unknown', pressure: 'Unknown', alignment: [],
  };
}

/** Advance down/distance/field position after a result. User can always edit afterwards. */
export function nextSituation(s: Situation, r: PlayResult): Situation {
  const base = { ...s, coverage: 'Unknown' as const, pressure: 'Unknown' as const, alignment: [] };
  if (r.touchdown) return { ...freshSituation(s), myScore: s.myScore + 7 };
  if (r.turnover) return freshSituation(s);
  const yl = Math.max(1, Math.min(99, s.yardLine + r.yards));
  if (r.yards >= s.distance) {
    return { ...base, down: 1, yardLine: yl, distance: Math.min(10, 100 - yl) };
  }
  if (s.down === 4) return freshSituation(s); // turnover on downs
  const remaining = Math.max(0.5, s.distance - r.yards);
  return { ...base, down: (s.down + 1) as Down, yardLine: yl, distance: Math.min(remaining, 100 - yl) };
}
