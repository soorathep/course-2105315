// Writes Lab 03 data sets plus the engine's numbers, for spikes_vs_pandas.py.
// Usage: node spikes_cases.mjs <output folder>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as S from '../assets/spikes-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
const data = JSON.parse(fs.readFileSync(path.join(here, '../assets/data/airquality.json'), 'utf8'));
const starts = S.completeStarts(data);
const ids = ['6712345621', '6630001121', '6531234521', '6400000021', '6798765421', '6612121221'];
const variants = [S.makeVariant(data, 'spring'), S.makeVariant(data, 'autumn'), ...ids.map((id) => S.makeVariant(data, 'student', id, starts))];
const cases = variants.map((v, k) => {
  const s = S.series(data, v), r = S.rules(s), r5 = S.rules(s, 5);
  fs.writeFileSync(path.join(out, `v${k}.csv`), S.toCsv(s));
  const smooth = [];
  for (const w of [3, 6, 12, 24]) for (const c of [false, true]) {
    const sm = S.smooth(s.truth, w, c);
    smooth.push({ w, centre: c, values: sm.map((x) => (Number.isFinite(x) ? x : null)), dailyPeak: S.dailyPeak(s.t, sm) });
  }
  return { k, label: v.label, start: v.startIndex, nStarts: starts.length, faults: s.faults, truth: s.truth,
    flags: r.flags, hampel5: r5.flags.hampel, fit: r.fit, score: S.score(s, r.flags), notebook: S.notebookReference(s),
    candidates: S.candidates(s), smooth, rawPeak: S.dailyPeak(s.t, s.truth) };
});
fs.writeFileSync(path.join(out, 'cases.json'), JSON.stringify(cases));
