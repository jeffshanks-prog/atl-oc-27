// Checks the defense predictor on a made-up 20-snap game with clear habits.
import { predictDefense } from '../src/engine/predict.ts';
import type { PlayCall, DefenseSeen } from '../src/lib/types.ts';

let seq = 0;
const call = (down: 1 | 2 | 3 | 4, distance: number, yardLine: number, cov: DefenseSeen, blitz = false): PlayCall => ({
  id: String(++seq), gameId: 'g', playId: 'p', sequence: seq, down, distance, yardLine, fieldZone: 'Midfield', quarter: 1, clock: '5:00',
  myScore: 0, oppScore: 0, coverage: 'Unknown', pressure: 'Unknown', alignment: [], matchScore: null, createdAt: '',
  result: { outcome: '+5', yards: 5, success: true, isPass: true, completed: true, touchdown: false, turnover: false, sack: false,
    defenseSeen: cov, observations: blitz ? ['Blitz called'] : [] },
});
// habits: 1st down → Cover 3; 3rd & long → Cover 1 + blitz; red zone → Cover 0 blitz
const game: PlayCall[] = [];
for (let i = 0; i < 5; i++) {
  game.push(call(1, 10, 30 + i * 5, 'C3'));
  game.push(call(2, 6, 35 + i * 5, i % 2 ? 'C4' : 'C3'));
  game.push(call(3, 9, 37 + i * 5, 'C1', true));
}
game.push(call(1, 10, 85, 'C0', true), call(2, 8, 87, 'C0', true));

let fail = 0;
const check = (label: string, ok: boolean, info: string) => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${label}: ${info}`); };
const early = predictDefense(game.slice(0, 10), { down: 1, distance: 10, yardLine: 30 });
check('waits for 15 snaps', !early.ready && early.needed === 5, `ready=${early.ready} needed=${early.needed}`);
const p3 = predictDefense(game, { down: 3, distance: 9, yardLine: 45 });
check('3rd & long → Cover 1 + blitz', p3.coverage === 'C1' && p3.blitzProb > 0.4, `${p3.coverage} ${Math.round(p3.prob * 100)}% blitz ${Math.round(p3.blitzProb * 100)}% (${p3.strength})\n   ${p3.reasons.join('\n   ')}`);
const p1 = predictDefense(game, { down: 1, distance: 10, yardLine: 40 });
check('1st & 10 → Cover 3', p1.coverage === 'C3', `${p1.coverage} ${Math.round(p1.prob * 100)}% blitz ${Math.round(p1.blitzProb * 100)}%`);
const rz = predictDefense(game, { down: 1, distance: 10, yardLine: 88 });
check('red zone leans Cover 0 more than midfield', (rz.dist.find((d) => d.cov === 'C0')?.p ?? 0) > (p1.dist.find((d) => d.cov === 'C0')?.p ?? 0), `C0 ${Math.round((rz.dist.find((d) => d.cov === 'C0')?.p ?? 0) * 100)}% vs ${Math.round((p1.dist.find((d) => d.cov === 'C0')?.p ?? 0) * 100)}%`);
if (fail) process.exit(1);
console.log('Prediction checks passed.');
