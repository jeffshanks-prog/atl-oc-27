// Tiny image helpers that work the same in the browser (canvas ImageData) and in Node tests.

export interface Gray { w: number; h: number; data: Uint8Array }
export interface Box { x0: number; y0: number; x1: number; y1: number }

/** Every screen position in this folder is measured on a 1920×1080 frame and scaled to the real size. */
export const REF_W = 1920;
export const REF_H = 1080;

export function grayFromRGBA(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Gray {
  const data = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    data[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  }
  return { w, h, data };
}

/** Scale a 1920×1080 reference box onto an image of any 16:9 size. */
export function scaleBox(b: Box, img: { w: number; h: number }): Box {
  const sx = img.w / REF_W;
  const sy = img.h / REF_H;
  return { x0: Math.round(b.x0 * sx), y0: Math.round(b.y0 * sy), x1: Math.round(b.x1 * sx), y1: Math.round(b.y1 * sy) };
}

/** Binary mask (1 = bright text) for one region, at the frame's own resolution. */
export function regionMask(img: Gray, ref: Box, threshold: number): { w: number; h: number; m: Uint8Array } {
  const b = scaleBox(ref, img);
  const w = Math.max(1, b.x1 - b.x0);
  const h = Math.max(1, b.y1 - b.y0);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = b.y0 + y;
    if (sy < 0 || sy >= img.h) continue;
    for (let x = 0; x < w; x++) {
      const sx = b.x0 + x;
      if (sx < 0 || sx >= img.w) continue;
      m[y * w + x] = img.data[sy * img.w + sx] >= threshold ? 1 : 0;
    }
  }
  return { w, h, m };
}

/** Box-filter resize (used by tests and template building to imitate other monitor sizes). */
export function resizeGray(img: Gray, w: number, h: number): Gray {
  if (w === img.w && h === img.h) return img;
  const data = new Uint8Array(w * h);
  const sx = img.w / w, sy = img.h / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0, n = 0;
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
    for (let yy = y0; yy < y1 && yy < img.h; yy++) for (let xx = x0; xx < x1 && xx < img.w; xx++) { sum += img.data[yy * img.w + xx]; n++; }
    data[y * w + x] = n ? sum / n : 0;
  }
  return { w, h, data };
}

/** Crop a region (scaled) out of a gray image, upscaled for OCR. */
export function cropGray(img: Gray, ref: Box, scale = 1): Gray {
  const b = scaleBox(ref, img);
  const w = Math.max(1, Math.round((b.x1 - b.x0) * scale));
  const h = Math.max(1, Math.round((b.y1 - b.y0) * scale));
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.w - 1, Math.floor(b.x0 + x / scale));
      const sy = Math.min(img.h - 1, Math.floor(b.y0 + y / scale));
      data[y * w + x] = img.data[sy * img.w + sx];
    }
  }
  return { w, h, data };
}
