// Calibration helper: print the glyph boxes found in each scoreboard region of the fixtures.
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { grayFromRGBA, regionMask } from '../src/vision/gray.ts';
import { REGIONS, THRESHOLD } from '../src/vision/regions.ts';
import { segment } from '../src/vision/glyphs.ts';

for (const f of process.argv.slice(2)) {
  const png = PNG.sync.read(readFileSync(f));
  const img = grayFromRGBA(png.data, png.width, png.height);
  console.log('==', f, png.width, png.height);
  for (const [k, t] of Object.entries(THRESHOLD)) {
    const m = regionMask(img, REGIONS[k as keyof typeof REGIONS], t);
    const gs = segment(m);
    console.log(k.padEnd(13), gs.map((g) => `[${g.x0}-${g.x1} ${g.y0}-${g.y1} ${g.px}]`).join(' '));
  }
}
