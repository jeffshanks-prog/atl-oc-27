// Classifies plays into concept families from their stored data (never from UI code).
import type { ConceptKey, Coverage, DefenseSeen, Family, Play, Scheme } from '../lib/types.ts';
import type { ScreenCategory } from '../lib/constants.ts';

function haystack(p: Play): string {
  return [
    p.playName, p.concept, p.passConcept, p.runConcept, p.primaryScheme, p.screenType, p.rpoType,
    ...p.secondarySchemes, ...p.tags,
  ].filter(Boolean).join(' | ').toLowerCase();
}

const cache = new WeakMap<Play, Set<Family>>();

export function familiesOf(p: Play): Set<Family> {
  const hit = cache.get(p);
  if (hit) return hit;
  const h = haystack(p);
  const has = (...w: string[]) => w.some((x) => h.includes(x));
  const s = new Set<Family>();

  if (p.playType === 'Screen' || p.screenType || has('screen', 'bubble')) s.add('screen');
  if (p.playType === 'Run') {
    s.add('run');
    if (has('inside zone')) s.add('insideZone');
    if (has('outside zone', 'stretch', 'toss')) s.add('outsideZone');
    if (has('power', 'counter', 'duo')) s.add('power');
  }
  if (p.playType === 'RPO' || p.rpoType || has('rpo')) s.add('rpo');
  if (p.playAction || p.playType === 'Play Action' || has('play action', 'pa ')) s.add('playAction');
  if (p.playType !== 'Run') {
    if (has('spacing')) s.add('spacing');
    if (has('mesh', 'cross', 'shallow') || /\bdrag\b/.test(h)) s.add('mesh');
    if (has('flood', 'sail')) s.add('flood');
    if (has('levels')) s.add('levels');
    if (has('drive')) s.add('drive');
    if (has('vert', 'seam')) s.add('verticals');
    if (has('quick', 'spot', 'snag', 'slant', 'stick', 'hitch')) s.add('quickGame');
    if (!s.has('screen') && (p.explosivePotential >= 4 || (p.playType !== 'RPO' && has('shot', 'vert', 'deep', 'post')))) s.add('shot');
  }
  cache.set(p, s);
  return s;
}

export function isRun(p: Play): boolean { return p.playType === 'Run'; }
export function isPassPlay(p: Play): boolean { return p.playType !== 'Run'; }

/** Display priority for a play's headline family. */
const MAIN_ORDER: Family[] = [
  'screen', 'rpo', 'playAction', 'mesh', 'spacing', 'flood', 'levels', 'drive', 'verticals', 'quickGame',
  'insideZone', 'outsideZone', 'power', 'run', 'shot',
];
export function mainFamily(p: Play): Family {
  const f = familiesOf(p);
  return MAIN_ORDER.find((x) => f.has(x)) ?? (isRun(p) ? 'run' : 'quickGame');
}

export function familyToWeightKey(f: Family): ConceptKey {
  return f === 'insideZone' || f === 'outsideZone' || f === 'power' ? 'run' : f;
}

/** Weight (0-100) the scheme gives to the best-matching family of this play. */
export function schemeWeightFor(p: Play, scheme: Scheme | null): number {
  if (!scheme) return 0;
  let best = 0;
  for (const f of familiesOf(p)) best = Math.max(best, scheme.weights[familyToWeightKey(f)] ?? 0);
  return best;
}

export const FAMILY_LABEL: Record<Family, string> = {
  spacing: 'Spacing', screen: 'Screen', run: 'Run', mesh: 'Mesh / Man', rpo: 'RPO', playAction: 'Play Action',
  shot: 'Shot', flood: 'Flood', levels: 'Levels', drive: 'Drive', quickGame: 'Quick Game', verticals: 'Verticals',
  insideZone: 'Inside Zone', outsideZone: 'Outside Zone', power: 'Power',
};

// ---- coverage helpers ----
export const MAN_COVERAGES: Coverage[] = ['Cover 0', 'Cover 1', 'Man'];
export const ZONE_COVERAGES: Coverage[] = ['Cover 2', 'Cover 3', 'Cover 4', 'Cover 6', 'Match', 'Prevent'];

export function coverageTokens(c: Coverage): string[] {
  switch (c) {
    case 'Cover 0': return ['cover 0', 'c0', 'man', 'blitz'];
    case 'Cover 1': return ['cover 1', 'c1', 'man'];
    case 'Cover 2': return ['cover 2', 'c2', 'zone'];
    case 'Cover 3': return ['cover 3', 'c3', 'zone'];
    case 'Cover 4': return ['cover 4', 'c4', 'quarters', 'zone'];
    case 'Cover 6': return ['cover 6', 'c6', 'zone'];
    case 'Man': return ['man'];
    case 'Match': return ['match', 'zone'];
    case 'Prevent': return ['prevent'];
    default: return [];
  }
}

export function listMatches(list: string[], c: Coverage): boolean {
  const toks = coverageTokens(c);
  return list.some((v) => toks.includes(v.trim().toLowerCase()));
}

export function defenseSeenToCoverage(d: DefenseSeen): Coverage | null {
  const map: Partial<Record<DefenseSeen, Coverage>> = {
    C0: 'Cover 0', C1: 'Cover 1', C2: 'Cover 2', C3: 'Cover 3', C4: 'Cover 4', C6: 'Cover 6', Man: 'Man',
  };
  return map[d] ?? null;
}
export function coverageToDefenseSeen(c: Coverage): DefenseSeen | null {
  const map: Partial<Record<Coverage, DefenseSeen>> = {
    'Cover 0': 'C0', 'Cover 1': 'C1', 'Cover 2': 'C2', 'Cover 3': 'C3', 'Cover 4': 'C4', 'Cover 6': 'C6', Man: 'Man',
  };
  return map[c] ?? null;
}

export function screenCategory(p: Play): ScreenCategory {
  const h = `${p.screenType ?? ''} ${p.playName} ${p.tags.join(' ')}`.toLowerCase();
  if (p.playType === 'RPO' || h.includes('rpo')) return 'RPO Screen';
  if (h.includes('slip')) return 'Slip Screen';
  if (h.includes('bubble')) return 'Bubble';
  if (/\bte\b/.test(h) && h.includes('screen')) return 'TE Screen';
  if (h.includes('motion') || h.includes('jet')) return 'Motion Screen';
  if (h.includes('delay') || h.includes('middle screen')) return 'Delayed Screen';
  if (/\b(wr|receiver|tunnel|jailbreak|swing)\b/.test(h)) return 'WR Screen';
  if (/\b(hb|rb)\b/.test(h)) return 'HB Screen';
  return 'Other';
}

export function playLabel(p: Play): string {
  const set = p.set ? ` ${p.set}` : '';
  return `${p.formationFamily} ${p.formation}${set} — ${p.playName}`;
}
export function formationLabel(p: Play): string {
  return `${p.formationFamily} ${p.formation}${p.set ? ` ${p.set}` : ''}`;
}
