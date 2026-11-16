// Writes Lab 06 data sets plus the engine's numbers, for shift_vs_pandas.py.
// Usage: node shift_cases.mjs <output folder>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as S from '../assets/shift-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
const data = JSON.parse(fs.readFileSync(path.join(here, '../assets/data/airquality.json'), 'utf8'));
const L = S.load(data);
const ids = ['6712345621', '6630001121', '6531234521', '6400000021', '6798765421', '6612121221'];
const variants = [S.makeVariant(L, 'a'), S.makeVariant(L, 'b'), ...ids.map((id) => S.makeVariant(L, 'student', id))];
const cases = variants.map((v, j) => {
  const r = S.compare(L, v.k);
  fs.writeFileSync(path.join(out, `v${j}.csv`), S.toCsv(L, r));
  const list = S.placebo(L);
  return { j, label: v.label, day: r.day, hourly: r.hourly, daily: r.daily, notebook: S.notebookReference(r), rank: S.rank(list, r.daily.diff) };
});
const placebo = Object.fromEntries(S.WINDOWS.map((w) => [w, { rates: S.rates(S.placebo(L, w)), days: S.placebo(L, w).map((r) => [r.day, r.diff, r.hourly.p, r.daily.p]) }]));
fs.writeFileSync(path.join(out, 'cases.json'), JSON.stringify({ cases, placebo, nCandidates: L.candidates.length }));
