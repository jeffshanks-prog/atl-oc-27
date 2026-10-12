// Checks the scoreboard reader against real Madden 27 screenshots, at several screen sizes.
//   npm run test:vision
import { readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { grayFromRGBA, resizeGray } from '../src/vision/gray.ts';
import { readScoreboard } from '../src/vision/scoreboard.ts';
import { defenseFromCall } from '../src/vision/defenseCall.ts';
import { planAutoLog } from '../src/vision/autoLog.ts';
import type { ScoreboardRead } from '../src/vision/scoreboard.ts';

const EXPECT: Record<string, Record<string, unknown>> = {
  'defense-2nd-inches.png': { down: 2, distance: 1, distanceKind: 'inches', quarter: 1, clock: '5:06', spot: 45, spotSide: 'own', leftScore: 0, rightScore: 0, possession: 'left' },
  'offense-2nd-10.png': { down: 2, distance: 10, quarter: 1, clock: '0:48', spot: 30, spotSide: 'own', yardLine: 30, leftScore: 6, rightScore: 7, possession: 'right' },
  'offense-3rd-17.png': { down: 3, distance: 17, quarter: 2, clock: '1:56', spot: 25, spotSide: 'opp', yardLine: 75, leftScore: 13, rightScore: 7, possession: 'right' },
};

let fail = 0;
const dir = new URL('./fixtures/', import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.png'))) {
  const png = PNG.sync.read(readFileSync(new URL(f, dir)));
  const base = grayFromRGBA(png.data, png.width, png.height);
  for (const [w, h] of [[1920, 1080], [2560, 1440], [1600, 900], [1280, 720], [3840, 2160]]) {
    const img = resizeGray(base, w, h);
    const r = readScoreboard(img);
    const exp = EXPECT[f];
    const bad = !r ? ['no read'] : Object.entries(exp).filter(([k, v]) => (r as unknown as Record<string, unknown>)[k] !== v).map(([k, v]) => `${k}: got ${(r as unknown as Record<string, unknown>)[k]} want ${v}`);
    if (bad.length) fail++;
    console.log(`${bad.length ? '✗' : '✓'} ${f} @${w}x${h}${r ? `  ${r.down}&${r.distance} Q${r.quarter} ${r.clock} ${r.spotSide}${r.spot} ${r.leftScore}-${r.rightScore} ball:${r.possession} (match ${(1 - r.worst).toFixed(2)})` : ''}${bad.length ? '  → ' + bad.join(', ') : ''}`);
  }
}

const CALLS: [string, string, boolean][] = [
  ['COVER 6 WILLIE', 'C6', false], ['SAW BLITZ 1', 'C1', true], ['COVER 1', 'C1', false], ['COVER 3 SKY', 'C3', false],
  ['TAMPA 2', 'C2', false], ['COVER 2 MAN', 'Man', false], ['2 MAN UNDER', 'Man', false], ['MIKE STING 0', 'C0', true],
  ['COVER 4 QUARTERS', 'C4', false], ['ENGAGE EIGHT', 'Unknown', false], ['FIRE ZONE 3', 'C3', true], ['COVER 0 BLITZ', 'C0', true],
  ['DOUBLE MUG 0', 'C0', true], ['PALMS', 'C4', false], ['COVER 3 BUZZ', 'C3', false], ['SUGAR 1 ROBBER', 'C1', true], ['SAWBLITZ1', 'C1', true], ['COVER1', 'C1', false], ['COVER3SKY', 'C3', false],
];
for (const [name, cov, blitz] of CALLS) {
  const d = defenseFromCall(name);
  const ok = d.seen === cov && d.blitz === blitz;
  if (!ok) fail++;
  console.log(`${ok ? '✓' : '✗'} "${name}" → ${d.seen}${d.blitz ? ' + blitz' : ''}${ok ? '' : `  (want ${cov}${blitz ? ' + blitz' : ''})`}`);
}

// ---- auto-logging decisions ----
const snap = (p: Partial<ScoreboardRead>): ScoreboardRead => ({
  down: 1, distance: 10, distanceKind: 'yards', quarter: 1, clock: '5:00', spot: 25, spotSide: 'own', yardLine: 25,
  leftScore: 0, rightScore: 0, possession: 'right', worst: 0, ...p,
});
const passy = (n: string) => !/^HB |^QB |^FB /.test(n);
const AUTO: [string, ReturnType<typeof planAutoLog>, string][] = [
  ['12-yard pass vs Cover 1', planAutoLog(snap({ down: 2, yardLine: 30 }), snap({ down: 1, yardLine: 42 }), { defense: 'COVER 1', offense: 'PA PYLON SAIL' }, 'right', passy), 'log PA PYLON SAIL +12 +10 C1'],
  ['run for a loss', planAutoLog(snap({ yardLine: 30 }), snap({ down: 2, distance: 12, yardLine: 28 }), { defense: 'SAWBLITZ1', offense: 'HB COUNTER WK' }, 'right', passy), 'log HB COUNTER WK -2 Loss C1 blitz'],
  ['incomplete pass', planAutoLog(snap({ yardLine: 30 }), snap({ down: 2, yardLine: 30 }), { defense: 'COVER 3 SKY', offense: 'PA BOOT FLOW' }, 'right', passy), 'log PA BOOT FLOW +0 Incomplete C3'],
  ['touchdown', planAutoLog(snap({ yardLine: 85, rightScore: 7 }), snap({ yardLine: 35, rightScore: 13, possession: 'right' }), { defense: 'COVER 0 BLITZ', offense: 'PA PYLON SAIL' }, 'right', passy), 'log PA PYLON SAIL +15 TD C0 blitz'],
  ['interception', planAutoLog(snap({ yardLine: 40 }), snap({ yardLine: 55, possession: 'left' }), { defense: 'COVER 2', offense: 'MESH' }, 'right', passy), 'skip'],
  ['their drive', planAutoLog(snap({ possession: 'left' }), snap({ possession: 'left', down: 2 }), { defense: 'COVER 6 WILLIE', offense: 'MTN PA POWER SPOT' }, 'right', passy), 'skip'],
  ['punt', planAutoLog(snap({ down: 4 }), snap({ possession: 'left' }), { defense: 'PUNT RETURN', offense: 'PUNT' }, 'right', passy), 'skip'],
];
for (const [label, d, want] of AUTO) {
  const got = d.kind === 'log' ? `log ${d.offenseName} ${d.yards >= 0 ? '+' : ''}${d.yards} ${d.outcome} ${d.defense.seen}${d.defense.blitz ? ' blitz' : ''}` : 'skip';
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? '✓' : '✗'} auto-log, ${label}: ${got}${d.kind === 'skip' ? ` (${d.reason})` : ''}${ok ? '' : `  (want ${want})`}`);
}

if (fail) { console.error(`\n${fail} check(s) failed`); process.exit(1); }
console.log('\nAll vision checks passed.');
