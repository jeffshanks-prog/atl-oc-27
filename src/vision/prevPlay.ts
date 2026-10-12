// Read the two names in Madden's "Previous Play" box (defense call on the left, offense call on the right).
import { type Gray, cropGray } from './gray.ts';
import { REGIONS } from './regions.ts';

export interface OcrEngine { read(img: Gray): Promise<string> }
export interface PreviousPlay { defense: string; offense: string }

/** Crop, enlarge ×2, flip to dark-on-white (keeping soft edges) and pad: what text readers handle best. */
export function prepForOcr(img: Gray, box: (typeof REGIONS)[keyof typeof REGIONS]): Gray {
  const g = cropGray(img, box, 2 * (1080 / img.h));
  const pad = 16;
  const w = g.w + pad * 2, h = g.h + pad * 2;
  const data = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const v = g.data[y * g.w + x];
    // stretch: background (<70) -> white, text (>200) -> black, anti-aliased edges in between
    const t = Math.min(1, Math.max(0, (v - 70) / 130));
    data[(y + pad) * w + x + pad] = Math.round(255 * (1 - t));
  }
  return { w, h, data };
}

export function cleanName(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function readPreviousPlay(img: Gray, ocr: OcrEngine): Promise<PreviousPlay | null> {
  const [d, o] = await Promise.all([
    ocr.read(prepForOcr(img, REGIONS.prevDefense)),
    ocr.read(prepForOcr(img, REGIONS.prevOffense)),
  ]);
  const defense = cleanName(d);
  const offense = cleanName(o);
  if (defense.length < 3 || offense.length < 3) return null;
  return { defense, offense };
}
