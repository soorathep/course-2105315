// Writes Lab 04 data sets plus the engine's numbers, for figures_vs_pandas.py.
// Usage: node figures_cases.mjs <output folder>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as F from '../assets/figures-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
const data = JSON.parse(fs.readFileSync(path.join(here, '../assets/data/airquality.json'), 'utf8'));
const ms = F.months(data), byKey = Object.fromEntries(ms.map((m) => [m.key, m]));
const ids = ['6712345621', '6630001121', '6531234521', '6400000021', '6798765421', '6612121221'];
const variants = [F.makeVariant(data, 'spring'), F.makeVariant(data, 'winter'), ...ids.map((id) => F.makeVariant(data, 'student', id, ms))];
const days = F.dailyMeans(ms);
const cases = variants.map((v, k) => {
  const a = byKey[v.low], b = byKey[v.high], sa = F.stats(a.y), sb = F.stats(b.y), base = F.reportBaseline(sa.mean, sb.mean);
  fs.writeFileSync(path.join(out, `v${k}.csv`), F.toCsv(a, b));
  const top = Math.max(sa.max, sb.max);
  return { k, label: v.label, low: v.low, high: v.high, sa, sb, base, lie: F.lieFactor(sa.mean, sb.mean, base),
    below: F.shareBelow(b.y, sa.mean), hist: { w: 2, top, a: F.histogram(a.y, 2, top), b: F.histogram(b.y, 2, top) }, notebook: F.notebookReference(a, b) };
});
const trends = [['2004-04', '2005-03'], ['2004-10', '2005-02'], ['2004-08', '2004-10'], ['2005-01', '2005-03']].map(([f, t]) => ({ f, t, ...F.trend(days, f, t) }));
fs.writeFileSync(path.join(out, 'cases.json'), JSON.stringify({ cases, nPairs: F.pairs(ms).length, days: days.map((d) => ({ ...d, mean: Number.isFinite(d.mean) ? d.mean : null })), trends }));
