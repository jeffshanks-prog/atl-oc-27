// Reads the Previous Play box from the fixtures with the same engine the browser uses.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { createWorker, PSM } from 'tesseract.js';
import { grayFromRGBA, type Gray } from '../src/vision/gray.ts';
import { readPreviousPlay } from '../src/vision/prevPlay.ts';
import { defenseFromCall } from '../src/vision/defenseCall.ts';

const worker = await createWorker('eng', 1, {
  langPath: fileURLToPath(new URL('../node_modules/@tesseract.js-data/eng/4.0.0_best_int/', import.meta.url)), gzip: true,
});
await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
const ocr = {
  async read(g: Gray) {
    const png = new PNG({ width: g.w, height: g.h });
    for (let i = 0; i < g.data.length; i++) { png.data[i * 4] = png.data[i * 4 + 1] = png.data[i * 4 + 2] = g.data[i]; png.data[i * 4 + 3] = 255; }
    return (await worker.recognize(PNG.sync.write(png))).data.text;
  },
};
const EXPECT: Record<string, [string, string]> = {
  'defense-2nd-inches.png': ['COVER 6 WILLIE', 'MTN PA POWER SPOT'],
  'offense-2nd-10.png': ['SAW BLITZ 1', 'HB COUNTER WK'],
  'offense-3rd-17.png': ['COVER 1', 'PA PYLON SAIL'],
};
let fail = 0;
for (const [f, [d, o]] of Object.entries(EXPECT)) {
  const png = PNG.sync.read(readFileSync(new URL(`./fixtures/${f}`, import.meta.url)));
  const img = grayFromRGBA(png.data, png.width, png.height);
  const r = await readPreviousPlay(img, ocr);
  const norm = (x?: string) => (x ?? '').replace(/ /g, '');
  const ok = norm(r?.defense) === norm(d) && norm(r?.offense) === norm(o) && defenseFromCall(r!.defense).seen === defenseFromCall(d).seen;
  if (!ok) fail++;
  const def = r ? defenseFromCall(r.defense) : null;
  console.log(`${ok ? '✓' : '✗'} ${f}: defense "${r?.defense}" (${def?.seen}${def?.blitz ? ' + blitz' : ''}) · offense "${r?.offense}"`);
}
await worker.terminate();
if (fail) process.exit(1);
console.log('Previous Play reads OK.');
