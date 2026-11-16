/** Lab 07 · decision engine. Pure functions, no DOM: the page and the Node checks both import it.
 * Data: UCI Air Quality (same file as Labs 01 to 06). Two raw files are made from one 28-day window:
 *   the low-cost sensor PT08.S1(CO), stamped in local time, with -200 for missing and three repeated rows;
 *   the reference analyzer C6H6(GT), stamped in UTC (local time minus 2 hours in summer), with -200 for missing.
 * Question: calibrated on week 1, can the sensor run an hourly benzene alert (above 15 µg/m³) in weeks 2 to 4? */
import { hashText, normaliseId, validStudentId, parseValue, stampAt, MISSING } from './audit-engine.js';

export const COLS = { benz: 'C6H6(GT)', sensor: 'PT08.S1(CO)' };
export const DAYS = 28;
export const CAL_DAYS = 7;
export const UTC_OFFSET = 2;               // Italy, summer time (CEST), 28 Mar to 31 Oct 2004
export const LIMIT = 15;                   // µg/m³, hourly alert level
export const TARGET = 0.8;                 // the sensor must flag at least 80 % of the hours above the limit
export const DUP_ROWS = 3;
export const SHIFTS = [-2, -1, 0, 1, 2, 3, 4];
export const MARGINS = [0, 1, 2, 3, 4, 5, 6];
export const DEMOS = {
  a: { label: 'Demo A', day: '2004-09-05' },
  b: { label: 'Demo B', day: '2004-04-28' },
};
const FIRST = '2004-03-29', LAST_END = '2004-10-30';   // windows lie wholly in summer time

const isNum = Number.isFinite;
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const pad = (n) => String(n).padStart(2, '0');
function isoAt(data, i, minusHours = 0) {
  const s = stampAt(data, i - minusHours);
  return s.iso.replace('T', ' ') + ':00';
}

export function load(data) {
  const get = (col) => Array.from({ length: data.hours }, (_, i) => { const v = parseValue(data.text[col][i]); return isNum(v) && v !== MISSING ? v : NaN; });
  const cal = [];
  for (let i = 0; i + 24 <= data.hours; i++) { const s = stampAt(data, i); if (s.hour === 0) cal.push({ i, day: s.day }); }
  const L = { data, benz: get(COLS.benz), sensor: get(COLS.sensor), cal };
  L.candidates = [];
  for (let k = 0; k + DAYS <= cal.length; k++) {
    if (cal[k].day < FIRST || cal[k + DAYS - 1].day > LAST_END) continue;
    const r = analyse(L, k, UTC_OFFSET);
    if (r.cal.n >= 140 && r.test.n >= 400 && r.test.above >= 30) L.candidates.push(k);
  }
  return L;
}

/** Pearson r over pairs where both are numbers. */
export function pearson(x, y) {
  const p = []; for (let i = 0; i < x.length; i++) if (isNum(x[i]) && isNum(y[i])) p.push([x[i], y[i]]);
  const mx = mean(p.map((q) => q[0])), my = mean(p.map((q) => q[1]));
  let sxy = 0, sxx = 0, syy = 0; for (const [a, b] of p) { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; syy += (b - my) ** 2; }
  return { r: sxy / Math.sqrt(sxx * syy), n: p.length };
}

/** The analyzer values as a merge on the timestamps would pair them with the sensor hours, after adding `shift`
 * hours to the analyzer's UTC stamps. shift = 2 is correct; shift = 0 is the plain merge. */
export function pairedBenz(L, k, shift) {
  const i0 = L.cal[k].i, H = DAYS * 24, out = [];
  // The analyzer row stamped u (UTC) is local hour u + 2. Adding `shift` to the stamps pairs sensor hour t with local hour t - shift + 2.
  for (let j = 0; j < H; j++) { const src = j - shift + UTC_OFFSET; out.push(src >= 0 && src < H ? L.benz[i0 + src] : NaN); }
  return out;
}

/** Calibrate on week 1 and test weeks 2 to 4, with the analyzer stamps shifted by `shift` hours. */
export function analyse(L, k, shift, margin = 0) {
  const i0 = L.cal[k].i, H = DAYS * 24, C = CAL_DAYS * 24;
  const s = L.sensor.slice(i0, i0 + H), b = pairedBenz(L, k, shift), truth = L.benz.slice(i0, i0 + H);
  const cx = [], cy = []; for (let j = 0; j < C; j++) if (isNum(s[j]) && isNum(b[j])) { cx.push(s[j]); cy.push(b[j]); }
  const mx = mean(cx), my = mean(cy); let sxy = 0, sxx = 0; cx.forEach((x, q) => { sxy += (x - mx) * (cy[q] - my); sxx += (x - mx) ** 2; });
  const slope = sxy / sxx, intercept = my - slope * mx;
  const pred = s.map((v) => (isNum(v) ? intercept + slope * v : NaN));
  let n = 0, above = 0, hits = 0, falseAlarms = 0, se = 0;
  for (let j = C; j < H; j++) {
    if (!isNum(pred[j]) || !isNum(truth[j])) continue;
    n++; se += (pred[j] - truth[j]) ** 2;
    const t = truth[j] > LIMIT, f = pred[j] > LIMIT - margin;
    if (t) above++; if (t && f) hits++; if (f && !t) falseAlarms++;
  }
  return { k, shift, margin, cal: { n: cx.length, slope, intercept, r: pearson(cx, cy).r }, pred, truth, sensor: s,
    test: { n, above, hits, missed: above - hits, falseAlarms, hitRate: above ? hits / above : NaN, rmse: Math.sqrt(se / n) } };
}

/** Correlation of sensor and analyzer over the 28 days for each shift of the analyzer stamps. */
export function lagScan(L, k) {
  const i0 = L.cal[k].i, s = L.sensor.slice(i0, i0 + DAYS * 24);
  return SHIFTS.map((h) => ({ shift: h, ...pearson(s, pairedBenz(L, k, h)) }));
}

const dayIndex = (L, key) => L.cal.findIndex((c) => c.day === key);

export function makeVariant(L, kind, studentId = '') {
  let k, seedId = '', label;
  if (kind === 'student') {
    const id = normaliseId(studentId);
    if (!validStudentId(id)) throw new Error('Enter your student ID (8 to 12 digits) to load your own data set.');
    k = L.candidates[hashText(`2105315-lab07|${id}`) % L.candidates.length]; seedId = id; label = `My data set · ID ${id}`;
  } else {
    const demo = DEMOS[kind]; if (!demo) throw new Error('Unknown data set.');
    k = dayIndex(L, demo.day); label = demo.label;
  }
  const dupAt = 30 + (hashText(`2105315-lab07-dup|${kind}|${seedId}`) % (DAYS * 24 - 60));
  return { kind, label, seedId, k, dupAt };
}

/** The two raw files. Sensor: local time, three rows repeated. Analyzer: UTC. Both use -200 for missing. */
export function sensorCsv(L, v) {
  const i0 = L.cal[v.k].i, rows = [];
  for (let j = 0; j < DAYS * 24; j++) { const x = L.sensor[i0 + j]; rows.push(`${isoAt(L.data, i0 + j)},${isNum(x) ? x : MISSING}`); }
  rows.splice(v.dupAt + DUP_ROWS, 0, ...rows.slice(v.dupAt, v.dupAt + DUP_ROWS));
  return ['datetime_local,PT08_S1_CO', ...rows].join('\n') + '\n';
}
export function analyzerCsv(L, v) {
  const i0 = L.cal[v.k].i, rows = [];
  for (let j = 0; j < DAYS * 24; j++) { const x = L.benz[i0 + j]; rows.push(`${isoAt(L.data, i0 + j, UTC_OFFSET)},${isNum(x) ? x : MISSING}`); }
  return ['datetime_utc,C6H6_ugm3', ...rows].join('\n') + '\n';
}

/** What an audit of the two files finds. */
export function audit(L, v) {
  const i0 = L.cal[v.k].i, H = DAYS * 24;
  const sMiss = L.sensor.slice(i0, i0 + H).filter((x) => !isNum(x)).length, bMiss = L.benz.slice(i0, i0 + H).filter((x) => !isNum(x)).length;
  return { sensorRows: H + DUP_ROWS, duplicates: DUP_ROWS, sensorMissing: sMiss, analyzerRows: H, analyzerMissing: bMiss,
    firstSensor: isoAt(L.data, i0), firstAnalyzer: isoAt(L.data, i0, UTC_OFFSET) };
}

/** Numbers for Step 5, from the two downloaded files. */
export function notebookReference(L, v) {
  const scan = lagScan(L, v.k), best = scan.reduce((a, b) => (b.r > a.r ? b : a)), al = analyse(L, v.k, UTC_OFFSET);
  return [
    { id: 'rows', text: 'Rows in the sensor file after removing exact duplicate rows', value: DAYS * 24, tolerance: 0, decimals: 0 },
    { id: 'shift', text: 'Hours to add to the analyzer timestamps that give the highest correlation with the sensor', value: best.shift, tolerance: 0, decimals: 0 },
    { id: 'slope', text: 'Slope of benzene on the sensor, fitted on the first 7 days after aligning (µg/m³ per sensor unit)', value: al.cal.slope, tolerance: 0.0005, decimals: 4 },
  ];
}

export const fmt = (v, d = 2) => (isNum(v) ? v.toFixed(d).replace('-', '−') : '–');
export const pct = (x) => (isNum(x) ? `${Math.round(100 * x)} %` : '–');
export { pad };
