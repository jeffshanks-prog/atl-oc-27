// Find character shapes in a binary mask and match them against the Madden scoreboard font.
import TEMPLATES from './glyph-templates.ts';

export interface Glyph { x0: number; y0: number; x1: number; y1: number; px: number; bits: string }
export const GW = 20;
export const GH = 32;

/** Connected bright blobs, merged when they share columns (colon dots, the bar in "&"). */
export function segment(mask: { w: number; h: number; m: Uint8Array }, minPx = Math.max(2, Math.round(mask.h / 7))): Glyph[] {
  const { w, h, m } = mask;
  const label = new Int32Array(w * h).fill(-1);
  const boxes: { x0: number; y0: number; x1: number; y1: number; px: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || label[i] !== -1) continue;
    const id = boxes.length;
    const b = { x0: w, y0: h, x1: -1, y1: -1, px: 0 };
    label[i] = id; stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w, y = (p / w) | 0;
      b.px++;
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (m[q] && label[q] === -1) { label[q] = id; stack.push(q); }
      }
    }
    boxes.push(b);
  }
  let list = boxes.filter((b) => b.px >= minPx).sort((a, b) => a.x0 - b.x0);
  // merge blobs that overlap horizontally (stacked pieces of one character)
  const merged: typeof list = [];
  for (const b of list) {
    const last = merged[merged.length - 1];
    if (last) {
      const ov = Math.min(last.x1, b.x1) - Math.max(last.x0, b.x0) + 1;
      const narrow = Math.min(last.x1 - last.x0, b.x1 - b.x0) + 1;
      if (ov > 0 && ov >= narrow * 0.6) {
        last.x0 = Math.min(last.x0, b.x0); last.x1 = Math.max(last.x1, b.x1);
        last.y0 = Math.min(last.y0, b.y0); last.y1 = Math.max(last.y1, b.y1); last.px += b.px;
        continue;
      }
    }
    merged.push({ ...b });
  }
  list = merged;
  return list.map((b) => ({ ...b, bits: normalize(mask, b) }));
}

/** Resample one glyph box to a GW×GH bit string. */
export function normalize(mask: { w: number; m: Uint8Array }, b: { x0: number; y0: number; x1: number; y1: number }): string {
  // Keep the glyph's proportions (a "1" stays thin): one scale for both axes, centred in the cell.
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const s = Math.min(GH / bh, GW / bw);
  const ox = (GW - bw * s) / 2, oy = (GH - bh * s) / 2;
  let out = '';
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const sx0 = b.x0 + (gx - ox) / s, sx1 = b.x0 + (gx + 1 - ox) / s;
      const sy0 = b.y0 + (gy - oy) / s, sy1 = b.y0 + (gy + 1 - oy) / s;
      let on = 0, n = 0;
      if (s >= 1) {
        // enlarging: sample the pixel under the cell centre so 1-px gaps (the hole in a 0) survive
        const x = Math.floor((sx0 + sx1) / 2), y = Math.floor((sy0 + sy1) / 2);
        n = 1;
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) on = mask.m[y * mask.w + x];
      } else {
        for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
          for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
            n++;
            if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
            on += mask.m[y * mask.w + x];
          }
        }
      }
      out += n && on / n >= 0.5 ? '1' : '0';
    }
  }
  return out;
}

const rotate180 = (bits: string) => bits.split('').reverse().join('');

type Lib = Record<string, string[]>;
const unhex = (h: string) => [...h].map((c) => parseInt(c, 16).toString(2).padStart(4, '0')).join('').slice(0, GW * GH);
const BASE: Lib = Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, v.map(unhex)]));
// The scoreboard font draws 9 as an upside-down 6; derive it until a real 9 is learned.
if (!BASE['9'] && BASE['6']) BASE['9'] = BASE['6'].map(rotate180);

function dist(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a.charCodeAt(i) !== b.charCodeAt(i)) d++;
  return d;
}

export interface Match { ch: string; score: number } // score 0 (perfect) … 1

/** Best match among the allowed characters. */
export function classify(bits: string, allowed: string): Match {
  const scores: Record<string, number> = {};
  for (const ch of allowed) {
    for (const t of BASE[ch] ?? []) {
      const s = dist(bits, t) / bits.length;
      if (scores[ch] === undefined || s < scores[ch]) scores[ch] = s;
    }
  }
  let best: Match = { ch: '?', score: 1 };
  for (const [ch, s] of Object.entries(scores)) if (s < best.score) best = { ch, score: s };

  return best;
}

export function aspect(g: Glyph): number { return (g.x1 - g.x0 + 1) / (g.y1 - g.y0 + 1); }
export function height(g: Glyph): number { return g.y1 - g.y0 + 1; }
