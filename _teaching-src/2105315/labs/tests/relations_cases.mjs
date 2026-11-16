// Writes Lab 05 data sets plus the engine's numbers, for relations_vs_pandas.py.
// Usage: node relations_cases.mjs <output folder>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as R from '../assets/relations-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
const data = JSON.parse(fs.readFileSync(path.join(here, '../assets/data/airquality.json'), 'utf8'));
const L = R.load(data);
const ids = ['6712345621', '6630001121', '6531234521', '6400000021', '6798765421', '6612121221'];
const variants = [R.makeVariant(L, 'a'), R.makeVariant(L, 'b'), ...ids.map((id) => R.makeVariant(L, 'student', id))];
const nan = (xs) => xs.map((v) => (Number.isFinite(v) ? v : null));
const cases = variants.map((v, k) => {
  const a = R.partA(L.daily, L.cal, v.dayA), b = R.partB(data, L.cal, v.dayB);
  fs.writeFileSync(path.join(out, `v${k}.csv`), R.toCsv(a));
  return { k, label: v.label, startA: a.days[0], startB: b.days[0], raw: a.raw, det: a.det, notebook: R.notebookReference(a),
    bDaily: nan(b.daily), mu: b.mu, sigma: b.sigma, fit: b.fit, cusum: R.cusum(b), cusum2: R.cusum(b, 1, 4), thr: R.threshold(b) };
});
fs.writeFileSync(path.join(out, 'cases.json'), JSON.stringify({ cases, startsA: L.startsA.map((d) => L.cal[d].day), nB: L.startsB.length }));
