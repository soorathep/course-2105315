// Writes Lab 07 raw files plus the engine's numbers, for decision_vs_pandas.py.
// Usage: node decision_cases.mjs <output folder>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as D from '../assets/decision-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
const data = JSON.parse(fs.readFileSync(path.join(here, '../assets/data/airquality.json'), 'utf8'));
const L = D.load(data);
const ids = ['6712345621', '6630001121', '6531234521', '6400000021', '6798765421', '6612121221'];
const variants = [D.makeVariant(L, 'a'), D.makeVariant(L, 'b'), ...ids.map((id) => D.makeVariant(L, 'student', id))];
const strip = (r) => ({ cal: r.cal, test: r.test });
const cases = variants.map((v, j) => {
  fs.writeFileSync(path.join(out, `s${j}.csv`), D.sensorCsv(L, v));
  fs.writeFileSync(path.join(out, `a${j}.csv`), D.analyzerCsv(L, v));
  return { j, label: v.label, start: L.cal[v.k].day, audit: D.audit(L, v), scan: D.lagScan(L, v.k), notebook: D.notebookReference(L, v),
    aligned: strip(D.analyse(L, v.k, D.UTC_OFFSET)), naive: strip(D.analyse(L, v.k, 0)), margin3: strip(D.analyse(L, v.k, D.UTC_OFFSET, 3)) };
});
fs.writeFileSync(path.join(out, 'cases.json'), JSON.stringify({ cases, nCandidates: L.candidates.length }));
