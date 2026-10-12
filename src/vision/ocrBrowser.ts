// Browser text reader for the Previous Play box. Loaded only after the user links a game screen.
// Engine + English data are served from /tesseract (copied there by scripts/copy-ocr-assets.mjs).
import type { Gray } from './gray.ts';
import type { OcrEngine } from './prevPlay.ts';

let enginePromise: Promise<OcrEngine> | null = null;

export function browserOcr(): Promise<OcrEngine> {
  enginePromise ??= (async () => {
    const { createWorker, PSM } = await import('tesseract.js');
    const base = `${location.origin}/tesseract`;
    const worker = await createWorker('eng', 1, {
      workerPath: `${base}/worker.min.js`,
      corePath: `${base}/core`,
      langPath: `${base}/lang`,
      gzip: true,
    });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const canvas = document.createElement('canvas');
    return {
      async read(img: Gray) {
        canvas.width = img.w; canvas.height = img.h;
        const ctx = canvas.getContext('2d')!;
        const id = ctx.createImageData(img.w, img.h);
        for (let i = 0, j = 0; i < img.data.length; i++, j += 4) {
          id.data[j] = id.data[j + 1] = id.data[j + 2] = img.data[i]; id.data[j + 3] = 255;
        }
        ctx.putImageData(id, 0, 0);
        const { data } = await worker.recognize(canvas);
        return data.text;
      },
    };
  })();
  enginePromise.catch(() => { enginePromise = null; });
  return enginePromise;
}
