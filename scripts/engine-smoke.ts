// Quick sanity test for the recommendation engine using the 13 seed plays.
// Run: npm run test:engine
import type { Play, PlayCall, Situation, Scheme } from '../src/lib/types.ts';
import { recommend } from '../src/engine/recommend.ts';
import { computeTendencies } from '../src/engine/tendencies.ts';
import { screenAlert } from '../src/engine/screenAlert.ts';
import { statsByPlay, statsByPlayAndDefense } from '../src/analytics/stats.ts';
import { DEFAULT_WEIGHTS } from '../src/lib/constants.ts';

let n = 0;
function mk(formation: string, playName: string, o: Partial<Play>): Play {
  n++;
  return {
    id: `p${n}`, playbookId: 'atl', playbook: 'Atlanta', formationId: formation, formationFamily: 'Gun', formation, set: '',
    playName, playType: 'Pass', personnel: null, concept: null, primaryScheme: null, secondarySchemes: [], tags: [],
    screenType: null, runConcept: null, passConcept: null, rpoType: null, playAction: false, bestVs: [], weakVs: [],
    blitzBeater: false, manBeater: false, zoneBeater: false, shortYardageRating: 3, mediumYardageRating: 3,
    longYardageRating: 3, redZoneRating: 3, goalLineRating: 3, twoMinuteRating: 3, fourMinuteRating: 3,
    primaryRead: null, secondRead: null, thirdRead: null, checkdown: null, riskLevel: 2, explosivePotential: 2,
    notes: null, isSeed: true, ownerId: null, ...o,
  };
}
const plays: Play[] = [
  mk('Bunch', 'Spacing', { concept: 'Spacing', zoneBeater: true, bestVs: ['Cover 3', 'Cover 2', 'Zone'], shortYardageRating: 4, mediumYardageRating: 4, longYardageRating: 2 }),
  mk('Bunch', 'HB Slip Screen', { playType: 'Screen', screenType: 'Slip Screen', blitzBeater: true, bestVs: ['Blitz', 'Cover 0', 'Man'], shortYardageRating: 2, mediumYardageRating: 4, longYardageRating: 4, explosivePotential: 3 }),
  mk('Bunch', 'Mesh Spot', { concept: 'Mesh', manBeater: true, zoneBeater: true, bestVs: ['Man', 'Cover 1', 'Cover 3'], shortYardageRating: 4, mediumYardageRating: 4, longYardageRating: 2 }),
  mk('Bunch', 'Inside Cross', { concept: 'Crossers', manBeater: true, bestVs: ['Man', 'Cover 1'], shortYardageRating: 2, mediumYardageRating: 4, riskLevel: 3, explosivePotential: 3 }),
  mk('Bunch', 'Verticals', { concept: 'Verticals', bestVs: ['Cover 3', 'Cover 1'], weakVs: ['Cover 4'], shortYardageRating: 1, mediumYardageRating: 2, longYardageRating: 4, riskLevel: 4, explosivePotential: 5 }),
  mk('Bunch', 'Z Spot', { concept: 'Spot', zoneBeater: true, bestVs: ['Cover 3', 'Cover 2', 'Zone'], shortYardageRating: 4, longYardageRating: 1 }),
  mk('Bunch', 'HB Base', { playType: 'Run', runConcept: 'Base', bestVs: ['Cover 2', 'Cover 4'], shortYardageRating: 4, longYardageRating: 1, riskLevel: 1, fourMinuteRating: 5 }),
  mk('Bunch TE', 'Spacing', { concept: 'Spacing', zoneBeater: true, bestVs: ['Cover 3', 'Cover 2', 'Zone'], shortYardageRating: 4, mediumYardageRating: 4, longYardageRating: 2 }),
  mk('Bunch TE', 'HB Slip Screen', { playType: 'Screen', screenType: 'Slip Screen', blitzBeater: true, bestVs: ['Blitz', 'Cover 0', 'Man'], mediumYardageRating: 4, longYardageRating: 4 }),
  mk('Bunch TE', 'Mesh', { concept: 'Mesh', manBeater: true, blitzBeater: true, bestVs: ['Man', 'Cover 1', 'Cover 0'], shortYardageRating: 4, mediumYardageRating: 4 }),
  mk('Bunch TE', 'Mesh Dig', { concept: 'Mesh', manBeater: true, zoneBeater: true, bestVs: ['Man', 'Cover 1', 'Cover 3'], mediumYardageRating: 4 }),
  mk('Bunch TE', 'Inside Zone', { playType: 'Run', runConcept: 'Inside Zone', bestVs: ['Cover 2', 'Cover 4'], shortYardageRating: 4, longYardageRating: 1, riskLevel: 1, fourMinuteRating: 5 }),
  mk('Bunch TE', 'RPO Alert Bubble', { playType: 'RPO', rpoType: 'Alert Bubble', screenType: 'Bubble', bestVs: ['Cover 3'] }),
];
const playsById = new Map(plays.map((p) => [p.id, p]));
const scheme: Scheme = {
  id: 's', name: "JEFF'S ATL SPACING OFFENSE", description: '', primaryConcept: 'Spacing', secondaryConcepts: [],
  runPhilosophy: '', screenPhilosophy: '', preferredFormations: [], preferredPersonnel: [], weights: DEFAULT_WEIGHTS,
  isDefault: true, isActive: true, playIds: [],
};
const base: Situation = { down: 2, distance: 6, yardLine: 40, quarter: 2, clock: '8:00', myScore: 7, oppScore: 7, coverage: 'Cover 3', pressure: 'Normal rush', alignment: [] };

function run(label: string, s: Situation, calls: PlayCall[] = [], favorites: Record<string, string[]> = {}, quickMode: Parameters<typeof recommend>[0]['quickMode'] = null) {
  const t = computeTendencies(calls);
  const rec = recommend({ plays, scheme, favorites, stats: statsByPlay(calls), statsByDefense: statsByPlayAndDefense(calls), tendencies: t, recentCalls: calls, situation: s, quickMode, playsById });
  const name = (x: { play: Play; score: number } | null) => (x ? `${x.play.formation} — ${x.play.playName} (${x.score}%)` : '—');
  console.log(`\n== ${label}`);
  console.log(`  PRIMARY: ${name(rec.primary)}  | why: ${rec.primary?.why}`);
  console.log(`  COUNTER: ${name(rec.counter)}  SCREEN: ${name(rec.screen)}  RUN: ${name(rec.run)}  SHOT: ${name(rec.shot)}`);
  const alert = screenAlert(calls, playsById, s, rec.ranked);
  if (alert) console.log(`  🚨 ${alert.reasons.join(' ')} → ${name(alert.play)}`);
  if (t.insights.length) console.log(`  insights: ${t.insights.join(' | ')}`);
  return rec;
}

const r1 = run('2nd & 6 vs Cover 3', base);
console.assert(r1.primary && /Spacing|Spot/.test(r1.primary.play.playName), 'zone beater expected vs C3');
const r2 = run('3rd & 4 vs Cover 1 press', { ...base, down: 3, distance: 4, coverage: 'Cover 1', alignment: ['Press'] });
console.assert(r2.primary && /Mesh|Cross|Screen/.test(r2.primary.play.playName), 'man/blitz beater expected vs C1');
const r3 = run('2nd & 12 vs Cover 0 heavy blitz', { ...base, distance: 12, coverage: 'Cover 0', pressure: 'Heavy blitz' });
console.assert(r3.primary && /Screen|Mesh/.test(r3.primary.play.playName), 'blitz beater expected');
run('Q4 2:30 up 7, 1st & 10 (four-minute)', { ...base, down: 1, distance: 10, quarter: 4, clock: '2:30', myScore: 21, oppScore: 14, coverage: 'Unknown', pressure: 'Unknown' });
run('NEED 1 mode', { ...base, coverage: 'Unknown' }, [], {}, 'NEED_1');

// Simulated game: opponent blitzes repeatedly
const calls: PlayCall[] = [];
for (let i = 0; i < 6; i++) {
  calls.push({ id: `c${i}`, gameId: 'g', playId: i % 2 ? 'p1' : 'p3', sequence: i + 1, down: 1, distance: 10, yardLine: 30, fieldZone: 'Own territory', quarter: 1, clock: '10:00', myScore: 0, oppScore: 0, coverage: 'Unknown', pressure: 'Unknown', alignment: [], matchScore: null, createdAt: '', result: { outcome: i < 4 ? 'Sack' : '+3', yards: i < 4 ? -6 : 3, success: false, isPass: true, completed: i >= 4, touchdown: false, turnover: false, sack: i < 4, defenseSeen: i < 4 ? 'Blitz' : 'C1', observations: i < 3 ? ['Heavy pressure'] : [] } });
}
const r4 = run('After repeated blitzes, unknown coverage', { ...base, coverage: 'Unknown', pressure: 'Unknown' }, calls, { p2: ['Blitz Beater'] });
console.assert(r4.primary?.play.id !== 'p1', 'should not repeat last call');
console.log('\nFactors for primary:');
for (const f of r4.primary!.factors) console.log(`  ${f.label.padEnd(20)} ${String(f.value).padStart(5)}  ${f.note}`);
console.log('\nOK');
