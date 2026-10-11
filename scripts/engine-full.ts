// Runs the engine against the full auto-tagged Atlanta playbook (data/atlanta-playbook.csv).
// Run: node --experimental-strip-types scripts/engine-full.ts
import fs from 'node:fs';
import Papa from 'papaparse';
import type { Play, Situation, Scheme, QuickMode } from '../src/lib/types.ts';
import { recommend } from '../src/engine/recommend.ts';
import { computeTendencies } from '../src/engine/tendencies.ts';
import { DEFAULT_WEIGHTS } from '../src/lib/constants.ts';

const rows = Papa.parse<Record<string, string>>(fs.readFileSync('data/atlanta-playbook.csv', 'utf8'), { header: true, skipEmptyLines: true }).data;
const L = (s: string) => (s ? s.split('|') : []);
const plays: Play[] = rows.map((r, i) => ({
  id: `p${i}`, playbookId: 'atl', playbook: 'Atlanta', formationId: r.formation, formationFamily: r.formationFamily, formation: r.formation, set: '',
  playName: r.playName, playType: r.playType as Play['playType'], personnel: null, concept: r.concept || null, primaryScheme: r.primaryScheme || null,
  secondarySchemes: L(r.secondarySchemes), tags: L(r.tags), screenType: r.screenType || null, runConcept: r.runConcept || null, passConcept: r.passConcept || null,
  rpoType: r.rpoType || null, playAction: r.playAction === 'true', bestVs: L(r.bestVs), weakVs: L(r.weakVs), blitzBeater: r.blitzBeater === 'true',
  manBeater: r.manBeater === 'true', zoneBeater: r.zoneBeater === 'true', shortYardageRating: +r.shortYardageRating, mediumYardageRating: +r.mediumYardageRating,
  longYardageRating: +r.longYardageRating, redZoneRating: +r.redZoneRating, goalLineRating: +r.goalLineRating, twoMinuteRating: +r.twoMinuteRating,
  fourMinuteRating: +r.fourMinuteRating, primaryRead: null, secondRead: null, thirdRead: null, checkdown: null, riskLevel: +r.riskLevel,
  explosivePotential: +r.explosivePotential, notes: null, isSeed: true, ownerId: null,
}));
const scheme: Scheme = { id: 's', name: 'JEFF', description: '', primaryConcept: 'Spacing', secondaryConcepts: [], runPhilosophy: '', screenPhilosophy: '',
  preferredFormations: ['Gun Bunch', 'Gun Bunch TE'], preferredPersonnel: [], weights: DEFAULT_WEIGHTS, isDefault: true, isActive: true, playIds: [] };
const base: Situation = { down: 1, distance: 10, yardLine: 30, quarter: 1, clock: '12:00', myScore: 0, oppScore: 0, coverage: 'Unknown', pressure: 'Unknown', alignment: [] };
const playsById = new Map(plays.map((p) => [p.id, p]));
const t0 = performance.now();
function run(label: string, s: Partial<Situation>, mode: QuickMode | null = null) {
  const rec = recommend({ plays, scheme, favorites: {}, stats: new Map(), statsByDefense: new Map(), tendencies: computeTendencies([]), recentCalls: [], situation: { ...base, ...s }, quickMode: mode, playsById });
  const n = (x: typeof rec.primary) => (x ? `${x.play.formationFamily} ${x.play.formation} — ${x.play.playName} (${x.score})` : '—');
  console.log(`\n${label}${mode ? ` [${mode}]` : ''}\n  1) ${n(rec.ranked[0])}\n  2) ${n(rec.ranked[1])}\n  3) ${n(rec.ranked[2])}\n  counter ${n(rec.counter)} | screen ${n(rec.screen)} | run ${n(rec.run)} | shot ${n(rec.shot)}`);
}
console.log(`${plays.length} plays loaded`);
run('1st & 10, unknown', {});
run('2nd & 6 vs Cover 3', { down: 2, distance: 6, coverage: 'Cover 3' });
run('3rd & 2 vs Cover 1 press', { down: 3, distance: 2, coverage: 'Cover 1', alignment: ['Press'] });
run('3rd & 12 vs Cover 0 heavy blitz', { down: 3, distance: 12, coverage: 'Cover 0', pressure: 'Heavy blitz' });
run('1st & goal at the 2', { down: 1, distance: 2, yardLine: 98 });
run('Q4 3:00 up 4, 1st & 10', { quarter: 4, clock: '3:00', myScore: 21, oppScore: 17 });
run('Q4 1:30 down 6, 2nd & 10', { down: 2, quarter: 4, clock: '1:30', myScore: 14, oppScore: 20, yardLine: 45 });
run('screen mode', { down: 2, distance: 8 }, 'SCREEN');
run('beat man', { down: 3, distance: 6 }, 'BEAT_MAN');
run('need 1', { down: 4, distance: 1 }, 'NEED_1');
console.log(`\n${Math.round(performance.now() - t0)} ms for 10 full recommendations`);
