// Read Madden 27's scoreboard bug: down & distance, quarter, clock, ball spot, score, possession.
import { type Gray, regionMask } from './gray.ts';
import { REGIONS, THRESHOLD } from './regions.ts';
import { classify, height, segment, type Glyph } from './glyphs.ts';

export type Side = 'left' | 'right';

export interface ScoreboardRead {
  down: 1 | 2 | 3 | 4;
  /** yards to go; for goal-to-go this is the distance to the goal line */
  distance: number;
  distanceKind: 'yards' | 'inches' | 'goal';
  quarter: 1 | 2 | 3 | 4 | 5;
  clock: string; // m:ss
  /** yard line as printed (1-50) and which half it is in, from the offense's point of view */
  spot: number;
  spotSide: 'own' | 'opp' | 'mid';
  /** 1-99 from the offense's own goal line */
  yardLine: number;
  leftScore: number;
  rightScore: number;
  possession: Side;
  /** 0 (perfect) … 1; anything above ~0.3 is not trusted */
  worst: number;
}

const DIGITS = '0123456789';
const MAX_SCORE = 0.3;

function mask(img: Gray, r: keyof typeof THRESHOLD) {
  return regionMask(img, REGIONS[r], THRESHOLD[r]);
}

function readNumber(glyphs: Glyph[]): { value: number; worst: number } | null {
  if (!glyphs.length || glyphs.length > 3) return null;
  let s = '';
  let worst = 0;
  for (const g of glyphs) {
    const m = classify(g.bits, DIGITS);
    s += m.ch;
    worst = Math.max(worst, m.score);
  }
  return { value: parseInt(s, 10), worst };
}

const tall = (gs: Glyph[], frac: number) => {
  const max = Math.max(0, ...gs.map(height));
  return gs.filter((g) => height(g) >= max * frac);
};

/** null when the scoreboard is not on screen or the read is not trustworthy. */
export function readScoreboard(img: Gray): ScoreboardRead | null {
  let worst = 0;
  const note = (s: number) => { worst = Math.max(worst, s); };

  // ---- down & distance + possession arrow ----
  const ddAll = segment(mask(img, 'downDistance'));
  const ddText = tall(ddAll, 0.75);
  if (ddText.length < 5) return null;
  const arrows = ddAll.filter((g) => !ddText.includes(g));
  const textMid = (ddText[0].x0 + ddText[ddText.length - 1].x1) / 2;
  let possession: Side | null = null;
  for (const a of arrows) {
    const m = classify(a.bits, '<>');
    if (m.score > MAX_SCORE) continue;
    possession = (a.x0 + a.x1) / 2 < textMid ? 'left' : 'right';
  }
  if (!possession) return null;

  const dm = classify(ddText[0].bits, '1234'); note(dm.score);
  const amp = classify(ddText[3].bits, '&'); note(amp.score);
  const down = Number(dm.ch) as ScoreboardRead['down'];
  const rest = ddText.slice(4);
  let distance = 0;
  let distanceKind: ScoreboardRead['distanceKind'] = 'yards';
  const asNum = rest.length <= 2 ? readNumber(rest) : null;
  if (asNum && asNum.worst <= MAX_SCORE) { distance = asNum.value; note(asNum.worst); }
  else if (rest.length >= 5) { distanceKind = 'inches'; distance = 1; }
  else if (rest.length === 4) { distanceKind = 'goal'; }
  else return null;

  // ---- quarter ----
  const qAll = segment(mask(img, 'quarter'));
  const qBig = tall(qAll, 0.8);
  let quarter: ScoreboardRead['quarter'];
  if (qBig.length >= 2) quarter = 5; // "OT"
  else {
    if (!qBig.length) return null;
    const qm = classify(qBig[0].bits, '1234'); note(qm.score);
    quarter = Number(qm.ch) as ScoreboardRead['quarter'];
  }

  // ---- game clock ----
  const cl = segment(mask(img, 'clock'));
  let digits = '';
  for (const g of cl) {
    const m = classify(g.bits, '0123456789:');
    if (m.ch === ':') continue;
    note(m.score);
    digits += m.ch;
  }
  if (digits.length < 3 || digits.length > 4) return null;
  const clock = `${parseInt(digits.slice(0, -2), 10)}:${digits.slice(-2)}`;

  // ---- ball spot ----
  const spAll = segment(mask(img, 'ballSpot'));
  const spBig = tall(spAll, 0.7);
  const sp = readNumber(spBig);
  if (!sp) return null;
  note(sp.worst);
  const spot = sp.value;
  const spArrow = spAll.find((g) => !spBig.includes(g) && height(g) >= 4 && g.x1 < spBig[0].x0);
  let spotSide: ScoreboardRead['spotSide'] = 'mid';
  if (spot !== 50) {
    if (!spArrow) return null;
    const am = classify(spArrow.bits, 'v^'); note(am.score);
    spotSide = am.ch === 'v' ? 'own' : 'opp';
  }
  if (spot < 1 || spot > 50) return null;
  const yardLine = spotSide === 'opp' ? 100 - spot : spot;
  if (distanceKind === 'goal') distance = 100 - yardLine;

  // ---- score ----
  const ls = readNumber(segment(mask(img, 'leftScore')));
  const rs = readNumber(segment(mask(img, 'rightScore')));
  if (!ls || !rs) return null;
  note(ls.worst); note(rs.worst);

  if (worst > MAX_SCORE) return null;
  if (distance < 1 || distance > 99) return null;
  return {
    down, distance, distanceKind, quarter, clock, spot, spotSide, yardLine,
    leftScore: ls.value, rightScore: rs.value, possession, worst,
  };
}

/** Two reads describe the same snap (used to wait for a stable picture). */
export function sameSnap(a: ScoreboardRead | null, b: ScoreboardRead | null): boolean {
  if (!a || !b) return false;
  return a.down === b.down && a.distance === b.distance && a.yardLine === b.yardLine && a.possession === b.possession
    && a.leftScore === b.leftScore && a.rightScore === b.rightScore && a.quarter === b.quarter;
}
