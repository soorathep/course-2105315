// Writes Lab 02 data sets (truth and every gap pattern) plus the engine's numbers, for gaps_vs_pandas.py.
// Usage: node gaps_cases.mjs <output folder>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as G from '../assets/gaps-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
const data = JSON.parse(fs.readFileSync(path.join(here, '../assets/data/airquality.json'), 'utf8'));
const starts = G.completeStarts(data);
const ids = ['6712345621', '6630001121', '6531234521', '6400000021', '6798765421', '6612121221'];
const variants = [G.makeVariant(data, 'spring'), G.makeVariant(data, 'autumn'), ...ids.map((id) => G.makeVariant(data, 'student', id, starts))];
const cases = variants.map((v, k) => {
  const s = G.series(data, v), p = G.gapPatterns(v, s);
  fs.writeFileSync(path.join(out, `v${k}.csv`), G.toCsv(s, p.combined));
  fs.writeFileSync(path.join(out, `v${k}-truth.csv`), G.toCsv(s, []));
  const patterns = {};
  for (const id of ['scattered', 'daily', 'outage', 'combined', 'byvalue']) {
    const c = G.compare(s, p[id]);
    patterns[id] = { gaps: p[id], truth: c.truth, rows: c.rows.map(({ filled, ...r }) => r) };
  }
  const days = s.t.map((x) => x.day);
  const short = Object.fromEntries([1, 3, 6, 24, 72].map((L) => [L, G.answers(G.fillShortGaps(G.withGaps(s.y, p.combined), L), days)]));
  return { k, label: v.label, start: v.startIndex, nStarts: starts.length, notebook: G.notebookReference(s, p.combined), patterns, short };
});
fs.writeFileSync(path.join(out, 'cases.json'), JSON.stringify(cases));
