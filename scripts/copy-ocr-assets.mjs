// Copies the text-reading engine and its English data into public/tesseract so the app serves them itself.
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const out = new URL('../public/tesseract/', import.meta.url);
const nm = new URL('../node_modules/', import.meta.url);
const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
];
for (const [from, to] of files) {
  const src = new URL(from, nm);
  if (!existsSync(src)) { if (to.includes('relaxedsimd')) continue; throw new Error(`Missing ${from} — run npm install`); }
  const dest = new URL(to, out);
  mkdirSync(new URL('.', dest), { recursive: true });
  cpSync(src, dest);
}
console.log('OCR assets copied to public/tesseract');
