// =====================================================================
// ATL OC 27 recommendation engine
// Transparent, factor-based scoring. Every number shown to the user is
// traceable to a factor below. Max raw = 95 → normalized to 0-100.
// =====================================================================
import type { Coverage, DefenseSeen, Family, Play, PlayCall, QuickMode, Scheme, Situation } from '../lib/types.ts';
import type { PlayStat } from '../analytics/stats.ts';
import type { Tendencies } from './tendencies.ts';
import { TRACKED_COVERAGES } from './tendencies.ts';
import {
  FAMILY_LABEL, MAN_COVERAGES, ZONE_COVERAGES, coverageToDefenseSeen, defenseSeenToCoverage, familiesOf,
  formationLabel, isRun, listMatches, mainFamily, schemeWeightFor,
} from './classify.ts';
import { distanceBucket, isFourMinute, isTwoMinute, zoneFromYardLine } from './situation.ts';

export interface EngineContext {
  plays: Play[];
  scheme: Scheme | null;
  favorites: Record<string, string[]>; // playId -> roles
  stats: Map<string, PlayStat>;
  statsByDefense: Map<string, Map<DefenseSeen, PlayStat>>;
  tendencies: Tendencies;
  recentCalls: PlayCall[]; // current game, any order
  situation: Situation;
  quickMode?: QuickMode | null;
  playsById?: Map<string, Play>;
}

export interface Factor {
  key: 'situation' | 'coverage' | 'scheme' | 'favorite' | 'history' | 'tendency' | 'game' | 'repetition' | 'risk';
  label: string;
  value: number;
  min: number;
  max: number;
  note: string;
  /** false = no data for this factor yet; it is left out of the normalization. */
  applicable: boolean;
}

export interface Scored {
  play: Play;
  score: number; // 0-100
  raw: number;
  factors: Factor[];
  families: Family[];
  isFavorite: boolean;
  why: string;
}

export interface Recommendation {
  ranked: Scored[];
  primary: Scored | null;
  counter: Scored | null;
  screen: Scored | null;
  run: Scored | null;
  shot: Scored | null;
  modeNote: string | null;
}

const RAW_MAX = 95;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
const BLITZY = new Set(['Blitz', 'Heavy blitz', 'Double mug', 'Edge pressure']);

// ---------------------------------------------------------------------
// Coverage fit (0-1) for a play vs a single coverage
// ---------------------------------------------------------------------
export function coverageFit(p: Play, cov: Coverage): number {
  if (cov === 'Unknown') return 0.5;
  const f = familiesOf(p);
  if (listMatches(p.bestVs, cov)) return 1;
  if (listMatches(p.weakVs, cov)) return 0.1;
  if (cov === 'Prevent') {
    if (isRun(p) || f.has('screen') || f.has('quickGame') || f.has('spacing')) return 0.85;
    if (f.has('shot')) return 0.15;
    return 0.5;
  }
  if (cov === 'Cover 0' && (p.blitzBeater || f.has('screen'))) return 0.95;
  const man = MAN_COVERAGES.includes(cov);
  const zone = ZONE_COVERAGES.includes(cov);
  if (man && p.manBeater) return 0.85;
  if (zone && p.zoneBeater) return 0.85;
  if (man && f.has('mesh')) return 0.75;
  if (zone && (f.has('spacing') || f.has('flood') || f.has('levels'))) return 0.75;
  if (man && p.zoneBeater && !p.manBeater) return 0.3;
  if (zone && p.manBeater && !p.zoneBeater) return 0.45;
  return 0.5;
}

function pressureAndAlignmentAdjust(p: Play, s: Situation): { adj: number; notes: string[] } {
  const f = familiesOf(p);
  let adj = 0;
  const notes: string[] = [];
  if (BLITZY.has(s.pressure)) {
    if (p.blitzBeater || f.has('screen') || f.has('quickGame')) { adj += 0.15; notes.push('quick answer vs pressure'); }
    if (f.has('shot') || f.has('playAction')) { adj -= 0.25; notes.push('slow-developing vs pressure'); }
    if (s.pressure === 'Edge pressure' && f.has('insideZone')) adj += 0.1;
  }
  for (const a of s.alignment) {
    if (a === 'Loaded box') {
      if (isRun(p)) { adj -= 0.25; notes.push('run into a loaded box'); }
      else if (f.has('rpo') || f.has('playAction')) { adj += 0.1; notes.push('pass/RPO vs loaded box'); }
    }
    if (a === 'Light box' && isRun(p)) { adj += 0.2; notes.push('run vs light box'); }
    if (a === 'Press' && (p.manBeater || f.has('mesh'))) adj += 0.1;
    if (a === 'Off coverage' && (f.has('quickGame') || f.has('screen'))) { adj += 0.1; notes.push('soft cushion underneath'); }
    if (a === 'User-controlled MLB' && f.has('mesh')) { adj -= 0.1; notes.push('user MLB sits on crossers'); }
    if (a === 'User-controlled Safety' && f.has('shot')) { adj -= 0.1; notes.push('user safety over the top'); }
  }
  return { adj, notes };
}

// ---------------------------------------------------------------------
// Quick modes: filter + effective situation overrides
// ---------------------------------------------------------------------
function modeFilter(mode: QuickMode, p: Play, ctx: EngineContext): boolean {
  const f = familiesOf(p);
  const fav = Boolean(ctx.favorites[p.id]);
  switch (mode) {
    case 'SPACING': return f.has('spacing');
    case 'SCREEN': return f.has('screen');
    case 'RUN': return isRun(p);
    case 'QUICK_GAME': return f.has('quickGame') || f.has('spacing') || (!isRun(p) && p.riskLevel <= 2 && !f.has('shot') && !f.has('screen'));
    case 'BEAT_MAN': return !f.has('screen') && !isRun(p) && (p.manBeater || f.has('mesh') || (/bunch/i.test(p.formation) && f.has('quickGame')));
    case 'BEAT_ZONE': return p.zoneBeater || f.has('spacing') || f.has('flood') || f.has('levels') || listMatches(p.bestVs, 'Cover 3');
    case 'BEAT_BLITZ': return p.blitzBeater || f.has('screen') || f.has('quickGame') || (p.manBeater && p.riskLevel <= 2);
    case 'RPO': return f.has('rpo');
    case 'PLAY_ACTION': return f.has('playAction');
    case 'SHOT': return f.has('shot') || p.explosivePotential >= 4;
    case 'RED_ZONE': return p.redZoneRating >= 3;
    case 'GOAL_LINE': return p.goalLineRating >= 3;
    case 'TWO_MINUTE': return p.twoMinuteRating >= 3 && !isRun(p);
    case 'CLOCK_CONTROL': return p.fourMinuteRating >= 3 || isRun(p);
    case 'FAVORITES': return fav;
    case 'NEED_1': return p.shortYardageRating >= 3;
    case 'NEED_3': return (f.has('quickGame') || isRun(p) || fav) && p.shortYardageRating >= 3;
    case 'NEED_5': return (f.has('spacing') || f.has('mesh') || f.has('flood') || f.has('levels') || f.has('drive') || f.has('quickGame')) && p.mediumYardageRating >= 3;
    case 'NEED_10': return (!isRun(p) && p.longYardageRating >= 3) || f.has('screen');
    default: return true;
  }
}

function effectiveSituation(s: Situation, mode?: QuickMode | null): Situation {
  if (!mode) return s;
  const e = { ...s };
  if (mode === 'NEED_1') e.distance = 1;
  if (mode === 'NEED_3') e.distance = 3;
  if (mode === 'NEED_5') e.distance = 5;
  if (mode === 'NEED_10') e.distance = Math.max(10, s.distance);
  if (mode === 'RED_ZONE' && e.yardLine < 80) e.yardLine = 85;
  if (mode === 'GOAL_LINE' && e.yardLine < 97) e.yardLine = 98;
  if (mode === 'BEAT_BLITZ' && !BLITZY.has(e.pressure)) e.pressure = 'Blitz';
  if (mode === 'BEAT_MAN' && e.coverage === 'Unknown') e.coverage = 'Man';
  if (mode === 'BEAT_ZONE' && e.coverage === 'Unknown') e.coverage = 'Cover 3';
  return e;
}

// ---------------------------------------------------------------------
// Favorite-role matching to situation
// ---------------------------------------------------------------------
function rolesThatFit(roles: string[], s: Situation, mode?: QuickMode | null): string[] {
  const zone = zoneFromYardLine(s.yardLine);
  const cov = s.coverage;
  return roles.filter((role) => {
    switch (role) {
      case 'Money Play': return s.down >= 3;
      case '3rd Down': return s.down === 3;
      case '4th Down': return s.down === 4;
      case 'Red Zone': return zone === 'Red zone' || zone === 'Inside 10';
      case 'Goal Line': return zone === 'Goal line' || zone === 'Inside 10';
      case 'Man Beater': return MAN_COVERAGES.includes(cov) || mode === 'BEAT_MAN';
      case 'Zone Beater': return ZONE_COVERAGES.includes(cov) || mode === 'BEAT_ZONE';
      case 'Cover 2 Beater': return cov === 'Cover 2';
      case 'Cover 3 Beater': return cov === 'Cover 3';
      case 'Cover 4 Beater': return cov === 'Cover 4';
      case 'Blitz Beater': return BLITZY.has(s.pressure) || mode === 'BEAT_BLITZ';
      case 'Shot Play': return mode === 'SHOT' || s.distance >= 10;
      case '2-Minute': return isTwoMinute(s) || mode === 'TWO_MINUTE';
      case 'Clock Killer': return isFourMinute(s) || mode === 'CLOCK_CONTROL';
      case 'Screen': return mode === 'SCREEN' || BLITZY.has(s.pressure);
      case 'Run': return mode === 'RUN';
      case 'Quick Game': return s.distance <= 4 || mode === 'QUICK_GAME';
      default: return false; // Go-To: boost comes from being a favorite at all
    }
  });
}

// ---------------------------------------------------------------------
// Score a single play
// ---------------------------------------------------------------------
export function scorePlay(p: Play, ctx: EngineContext, sIn?: Situation): Scored {
  const s = sIn ?? effectiveSituation(ctx.situation, ctx.quickMode);
  const fams = familiesOf(p);
  const zone = zoneFromYardLine(s.yardLine);
  const factors: Factor[] = [];
  const whyBits: string[] = [];

  // 1. SITUATION (0-25): yardage fit + field zone + clock
  // Bucket by yards needed for a successful play (40% on 1st, 60% on 2nd, all of it on 3rd/4th).
  const need = s.distance * (s.down === 1 ? 0.4 : s.down === 2 ? 0.6 : 1);
  const bucket = distanceBucket(need);
  const yardRating = bucket === 'short' ? p.shortYardageRating : bucket === 'medium' ? p.mediumYardageRating : p.longYardageRating;
  const extras: number[] = [];
  if (zone === 'Goal line') extras.push(p.goalLineRating);
  else if (zone === 'Inside 10' || zone === 'Red zone') extras.push(p.redZoneRating);
  if (isTwoMinute(s)) extras.push(p.twoMinuteRating);
  else if (isFourMinute(s)) extras.push(p.fourMinuteRating);
  const extra = extras.length ? extras.reduce((a, b) => a + b, 0) / extras.length : 3;
  const situationVal = clamp(yardRating * 3 + extra * 2, 0, 25);
  factors.push({ applicable: true, key: 'situation', label: 'Situation Match', value: r1(situationVal), min: 0, max: 25,
    note: `${bucket} yardage (need ~${r1(need)}) rating ${yardRating}/5${extras.length ? `, field/clock rating ${r1(extra)}/5` : ''}` });
  if (yardRating >= 4) whyBits.push(`fits ${bucket} yardage`);

  // 2. COVERAGE (0-20): coverage + pressure + alignment
  const baseFit = coverageFit(p, s.coverage);
  const pa = pressureAndAlignmentAdjust(p, s);
  const covFit = clamp(baseFit + pa.adj, 0, 1);
  const covVal = covFit * 20;
  let covNote = s.coverage === 'Unknown' ? 'Coverage unknown (neutral)' : `${Math.round(baseFit * 100)}% fit vs ${s.coverage}`;
  if (pa.notes.length) covNote += `; ${pa.notes.join(', ')}`;
  factors.push({ applicable: s.coverage !== 'Unknown' || pa.notes.length > 0, key: 'coverage', label: 'Coverage Match', value: r1(covVal), min: 0, max: 20, note: covNote });
  if (s.coverage !== 'Unknown' && baseFit >= 0.85) whyBits.push(`strong answer vs ${s.coverage}`);
  if (pa.notes.length && pa.adj > 0) whyBits.push(pa.notes[0]);

  // 3. SCHEME (0-15)
  let schemeVal = 7.5;
  let schemeNote = 'No active scheme';
  if (ctx.scheme) {
    const w = schemeWeightFor(p, ctx.scheme);
    const maxW = Math.max(1, ...Object.values(ctx.scheme.weights).map((v) => v ?? 0));
    schemeVal = 11 * (w / maxW);
    const inScheme = ctx.scheme.playIds.includes(p.id);
    const prefForm = ctx.scheme.preferredFormations.some((f) => f.toLowerCase() === formationLabel(p).toLowerCase());
    if (inScheme) schemeVal += 4;
    else if (prefForm) schemeVal += 2;
    schemeVal = clamp(schemeVal, 0, 15);
    schemeNote = `${FAMILY_LABEL[mainFamily(p)]} weighted ${w}% in ${ctx.scheme.name}${inScheme ? ', preferred play' : prefForm ? ', preferred formation' : ''}`;
  }
  factors.push({ applicable: true, key: 'scheme', label: 'Scheme Match', value: r1(schemeVal), min: 0, max: 15, note: schemeNote });

  // 4. FAVORITE (0-10) — only when the play actually fits
  const roles = ctx.favorites[p.id];
  const isFavorite = Boolean(roles);
  const fitShare = (situationVal + covVal) / 45;
  let favVal = 0;
  let favNote = 'Not a favorite';
  if (isFavorite) {
    if (fitShare >= 0.55) {
      const fitRoles = rolesThatFit(roles, s, ctx.quickMode);
      favVal = clamp(6 + fitRoles.length * 2, 0, 10);
      favNote = fitRoles.length ? `Favorite — role fits: ${fitRoles.join(', ')}` : 'Favorite';
      whyBits.push(fitRoles.length ? `your ${fitRoles[0]} favorite` : 'one of your favorites');
    } else {
      favNote = 'Favorite, but a poor situational fit — no boost';
    }
  }
  factors.push({ applicable: true, key: 'favorite', label: 'Favorite Boost', value: favVal, min: 0, max: 10, note: favNote });

  // 5. HISTORY (0-10) — Bayesian-smoothed success from stored results
  const st = ctx.stats.get(p.id);
  let histVal = 5;
  let histNote = 'No recorded results yet (neutral)';
  if (st && st.calls > 0) {
    let rate = (st.successes + 1) / (st.calls + 2);
    let n = st.calls;
    const ds = coverageToDefenseSeen(s.coverage);
    const vsCov = ds ? ctx.statsByDefense.get(p.id)?.get(ds) : undefined;
    if (vsCov && vsCov.calls >= 2) {
      rate = 0.5 * rate + 0.5 * ((vsCov.successes + 1) / (vsCov.calls + 2));
      n = Math.max(n, vsCov.calls);
    }
    const conf = Math.min(1, n / 8);
    histVal = clamp(5 + (rate - 0.5) * 10 * conf * 2, 0, 10);
    if (st.turnovers > 0) histVal = clamp(histVal - Math.min(2, st.turnovers), 0, 10);
    histNote = `${st.successes}/${st.calls} successful, ${r1(st.avg)} avg yds${vsCov && vsCov.calls >= 2 ? `; ${vsCov.successes}/${vsCov.calls} vs ${s.coverage}` : ''}`;
    if (st.calls >= 3 && st.successRate >= 0.6) whyBits.push(`${Math.round(st.successRate * 100)}% success in your games`);
  }
  factors.push({ applicable: Boolean(st && st.calls > 0), key: 'history', label: 'Historical Success', value: r1(histVal), min: 0, max: 10, note: histNote });

  // 6. OPPONENT TENDENCY (0-10)
  const t = ctx.tendencies;
  let tendVal = 5;
  let tendNote = 'Not enough opponent data yet (neutral)';
  if (t.snaps >= 3) {
    const tNotes: string[] = [];
    if (t.coverageSamples >= 2) {
      let exp = 0;
      for (const k of TRACKED_COVERAGES) {
        const share = t.coverageDist[k] ?? 0;
        const cov = defenseSeenToCoverage(k);
        if (share > 0 && cov) exp += share * coverageFit(p, cov);
      }
      tendVal = exp * 10;
      tNotes.push(`${Math.round(exp * 100)}% expected fit vs their coverage mix`);
    }
    if (t.blitz >= 0.4 && (p.blitzBeater || fams.has('screen') || fams.has('quickGame'))) { tendVal += 2; tNotes.push('punishes their pressure'); }
    if (t.blitz >= 0.4 && (fams.has('shot') || fams.has('playAction'))) { tendVal -= 1.5; tNotes.push('slow vs their pressure'); }
    if (t.jumpedScreen >= 0.2 && fams.has('screen')) { tendVal -= 3; tNotes.push('they are jumping screens'); }
    if (t.jumpedFlat >= 0.2 && (fams.has('quickGame') || fams.has('spacing'))) { tendVal -= 2; tNotes.push('they are jumping the flat'); }
    if ((t.jumpedFlat >= 0.2 || t.jumpedScreen >= 0.2) && (fams.has('playAction') || fams.has('shot'))) { tendVal += 2; tNotes.push('underneath jumpers open the deep game'); }
    if (t.coveredMiddle >= 0.2 && fams.has('mesh')) { tendVal -= 2; tNotes.push('user is sitting in the middle'); }
    if (t.coveredMiddle >= 0.2 && (fams.has('spacing') || fams.has('flood'))) { tendVal += 1; tNotes.push('attacks outside the user'); }
    if (t.loadedBox >= 0.4 && isRun(p)) { tendVal -= 2; tNotes.push('they load the box'); }
    if (t.loadedBox >= 0.4 && (fams.has('rpo') || fams.has('playAction'))) { tendVal += 1.5; tNotes.push('stresses their loaded box'); }
    if (t.lightBox >= 0.4 && isRun(p)) { tendVal += 2; tNotes.push('they play light boxes'); }
    tendVal = clamp(tendVal, 0, 10);
    tendNote = tNotes.length ? tNotes.join('; ') : 'No strong tendency signal for this play';
    if (tendVal >= 7.5 && tNotes.length) whyBits.push(tNotes[0]);
  }
  factors.push({ applicable: t.snaps >= 3, key: 'tendency', label: 'Opponent Tendency', value: r1(tendVal), min: 0, max: 10, note: tendNote });

  // 7. GAME SITUATION (0-5): score, quarter, down, sequencing
  let gameVal = 2.5;
  const gNotes: string[] = [];
  const diff = s.myScore - s.oppScore;
  if (s.quarter >= 4 && diff <= -9) {
    if (!isRun(p)) { gameVal += 1.5; gNotes.push('need chunks while trailing'); }
    else { gameVal -= 1.5; gNotes.push('run burns clock while trailing'); }
    if (p.explosivePotential >= 4) gameVal += 1;
  }
  if (isFourMinute(s)) {
    if (isRun(p) || p.fourMinuteRating >= 4) { gameVal += 2; gNotes.push('keeps the clock moving'); }
    else { gameVal -= p.riskLevel >= 3 ? 2 : 1.5; gNotes.push('incompletion stops the clock'); }
  }
  if (s.down === 4 && p.riskLevel <= 2) { gameVal += 1; gNotes.push('high-percentage on 4th'); }
  if (s.down === 1 && p.explosivePotential >= 4 && s.quarter < 4) { gameVal += 0.5; gNotes.push('1st down shot window'); }
  const lastDone = [...ctx.recentCalls].filter((c) => c.result).sort((a, b) => b.sequence - a.sequence)[0];
  if (lastDone && lastDone.result && !lastDone.result.success) {
    const lastPlay = ctx.playsById?.get(lastDone.playId);
    if (lastPlay && mainFamily(lastPlay) !== mainFamily(p)) { gameVal += 0.5; gNotes.push('changes up after a failed call'); }
  }
  gameVal = clamp(gameVal, 0, 5);
  if (gameVal >= 4 && gNotes.length) whyBits.unshift(gNotes[0]);
  factors.push({ applicable: true, key: 'game', label: 'Game Situation', value: r1(gameVal), min: 0, max: 5, note: gNotes.join('; ') || 'Neutral' });

  // 8. REPETITION PENALTY (0 to -15)
  const recent = [...ctx.recentCalls].sort((a, b) => b.sequence - a.sequence);
  let rep = 0;
  const rNotes: string[] = [];
  const idx = recent.findIndex((c) => c.playId === p.id);
  if (idx === 0) { rep -= 15; rNotes.push('called last snap'); }
  else if (idx > 0 && idx < 3) { rep -= 10; rNotes.push(`called ${idx + 1} snaps ago`); }
  else if (idx >= 3 && idx < 6) { rep -= 5; rNotes.push('called recently'); }
  const myMain = mainFamily(p);
  const last2 = recent.slice(0, 2).map((c) => ctx.playsById?.get(c.playId)).filter((x): x is Play => Boolean(x));
  if (last2.length === 2 && last2.every((lp) => mainFamily(lp) === myMain)) { rep -= 4; rNotes.push(`${FAMILY_LABEL[myMain]} twice in a row`); }
  if (idx >= 0) {
    const prev = recent[idx];
    const ds = coverageToDefenseSeen(s.coverage);
    if (prev.result && !prev.result.success && ds && prev.result.defenseSeen === ds) { rep -= 3; rNotes.push(`failed vs ${s.coverage} earlier`); }
  }
  rep = clamp(rep, -15, 0);
  factors.push({ applicable: true, key: 'repetition', label: 'Repetition Penalty', value: rep, min: -15, max: 0, note: rNotes.join('; ') || 'No recent repeats' });

  // 9. RISK PENALTY (0 to -10)
  let sens = 1;
  const rkNotes: string[] = [];
  if (zone === 'Own goal line') { sens = 2.5; rkNotes.push('backed up'); }
  if (isFourMinute(s)) { sens = Math.max(sens, 2); rkNotes.push('protecting a lead'); }
  if (s.down === 4) { sens = Math.max(sens, 1.5); rkNotes.push('4th down'); }
  if (s.quarter >= 4 && diff <= -9) { sens = 0.5; rkNotes.push('must take risks'); }
  const risk = clamp(-Math.max(0, p.riskLevel - 2) * sens * 1.5, -10, 0);
  factors.push({ applicable: true, key: 'risk', label: 'Risk Penalty', value: r1(risk), min: -10, max: 0,
    note: `Risk ${p.riskLevel}/5${rkNotes.length ? ` (${rkNotes.join(', ')})` : ''}` });

  const raw = factors.reduce((a, f) => a + f.value, 0);
  // Normalize over factors that have data, so an empty history doesn't drag every play down.
  const live = factors.filter((f) => f.applicable);
  const liveMax = live.reduce((a, f) => a + f.max, 0) || RAW_MAX;
  const liveRaw = live.reduce((a, f) => a + f.value, 0);
  const score = clamp(Math.round((liveRaw / liveMax) * 100), 0, 100);
  const why = whyBits.length
    ? capitalize(whyBits.slice(0, 3).join(', ')) + '.'
    : 'Balanced fit for the situation and your scheme.';
  return { play: p, score, raw: r1(raw), factors, families: [...fams], isFavorite, why };
}

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---------------------------------------------------------------------
// Sequencing: SPACING → SCREEN → RUN → MESH → RPO → PA → SHOT → SPACING
// Opponent behavior can override the default next step.
// ---------------------------------------------------------------------
export const SEQUENCE: Family[] = ['spacing', 'screen', 'run', 'mesh', 'rpo', 'playAction', 'shot'];

export function counterFamilies(primary: Play, s: Situation, t: Tendencies): Family[] {
  const main = familiesOf(primary).has('run') ? 'run' : mainFamily(primary);
  const out: Family[] = [];
  if (BLITZY.has(s.pressure) || t.blitz >= 0.4) out.push('screen');
  if (s.alignment.includes('Loaded box') || t.loadedBox >= 0.4) out.push('rpo', 'playAction');
  if (s.alignment.includes('Light box') || t.lightBox >= 0.4) out.push('run');
  if (t.jumpedFlat >= 0.2 || t.jumpedScreen >= 0.2) out.push('playAction', 'shot');
  if (t.coveredMiddle >= 0.2) out.push('spacing', 'flood');
  const i = SEQUENCE.indexOf(main as Family);
  if (i >= 0) {
    for (let k = 1; k < SEQUENCE.length; k++) out.push(SEQUENCE[(i + k) % SEQUENCE.length]);
  } else {
    out.push(...SEQUENCE);
  }
  return [...new Set(out)].filter((f) => f !== main);
}

// ---------------------------------------------------------------------
// Full recommendation
// ---------------------------------------------------------------------
export function recommend(ctx: EngineContext): Recommendation {
  const s = effectiveSituation(ctx.situation, ctx.quickMode);
  const sorted = ctx.plays.map((p) => scorePlay(p, ctx, s)).sort((a, b) => b.score - a.score || b.raw - a.raw);
  // Keep variety: the same play name from another formation (e.g. Bunch vs Bunch TE "Spacing")
  // drops behind every distinct play, so NEXT PLAY and the answer cards show real alternatives.
  const seenNames = new Set<string>();
  const firsts: Scored[] = [];
  const repeats: Scored[] = [];
  for (const x of sorted) {
    const k = x.play.playName.toLowerCase();
    (seenNames.has(k) ? repeats : firsts).push(x);
    seenNames.add(k);
  }
  const all = [...firsts, ...repeats];
  let pool = all;
  let modeNote: string | null = null;
  if (ctx.quickMode) {
    const mode = ctx.quickMode;
    const filtered = all.filter((x) => modeFilter(mode, x.play, ctx));
    if (filtered.length) pool = filtered;
    else modeNote = mode === 'FAVORITES'
      ? 'You have no favorites yet — showing the best overall calls. Tap ♡ on any play to add it.'
      : 'No plays in your playbook match this mode yet — showing the best overall calls. Tag more plays in Admin.';
  }
  const primary = pool[0] ?? null;
  const used = new Set<string>(primary ? [primary.play.playName.toLowerCase()] : []);
  const pick = (list: Scored[], pred: (x: Scored) => boolean) => {
    const hit = list.find((x) => !used.has(x.play.playName.toLowerCase()) && pred(x));
    if (hit) used.add(hit.play.playName.toLowerCase());
    return hit ?? null;
  };

  let counter: Scored | null = null;
  if (primary) {
    for (const fam of counterFamilies(primary.play, s, ctx.tendencies)) {
      counter = pick(all, (x) => familiesOf(x.play).has(fam) && x.score >= 35);
      if (counter) break;
    }
    if (!counter) counter = pick(all, (x) => mainFamily(x.play) !== mainFamily(primary.play));
  }
  const screen = pick(all, (x) => familiesOf(x.play).has('screen'));
  const run = pick(all, (x) => isRun(x.play));
  const shot = pick(all, (x) => familiesOf(x.play).has('shot') || x.play.explosivePotential >= 4);
  return { ranked: pool, primary, counter, screen, run, shot, modeNote };
}
