/** Lab 04 · figure engine. Pure functions, no DOM: the page and the Node checks both import it.
 * Data: hourly benzene, C6H6(GT), UCI Air Quality (same file as Labs 01 to 03), with -200 treated as
 * missing. A student compares two whole months from April 2004 to March 2005; nothing in the data is changed. */
import { hashText, normaliseId, validStudentId, parseValue, stampAt, MISSING } from './audit-engine.js';

export const COLUMN = 'C6H6(GT)';
export const UNIT = 'µg/m³';
export const LEVEL = 10;                 // lab reference level for "hours above"; about the median of the year, not a regulation
export const FIRST_MONTH = '2004-04', LAST_MONTH = '2005-03';
export const DEMOS = {
  spring: { label: 'Demo A · April and October 2004', low: '2004-04', high: '2004-10' },
  winter: { label: 'Demo B · February 2005 and June 2004', low: '2005-02', high: '2004-06' },
};
const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (key) => `${NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

export { stampAt };

/** Every whole month April 2004 to March 2005: hour indices, stamps and values (NaN where missing). */
export function months(data) {
  const out = new Map();
  for (let i = 0; i < data.hours; i++) {
    const s = stampAt(data, i), key = s.day.slice(0, 7);
    if (key < FIRST_MONTH || key > LAST_MONTH) continue;
    if (!out.has(key)) out.set(key, { key, label: monthName(key), t: [], y: [] });
    const v = parseValue(data.text[COLUMN][i]);
    const m = out.get(key);
    m.t.push(s); m.y.push(Number.isFinite(v) && v !== MISSING ? v : NaN);
  }
  return [...out.values()];
}

/** Ordered pairs (low, high) whose monthly means differ by 10 % to 100 %. */
export function pairs(ms) {
  const out = [];
  for (const a of ms) for (const b of ms) {
    if (a === b) continue;
    const r = stats(b.y).mean / stats(a.y).mean;
    if (r >= 1.1 && r <= 2) out.push([a.key, b.key]);
  }
  return out.sort((p, q) => (p[0] + p[1] < q[0] + q[1] ? -1 : 1));
}

export function makeVariant(data, kind, studentId = '', ms = null) {
  if (kind === 'student') {
    const id = normaliseId(studentId);
    if (!validStudentId(id)) throw new Error('Enter your student ID (8 to 12 digits) to load your own data set.');
    const list = pairs(ms || months(data)), [low, high] = list[hashText(`2105315-lab04|${id}`) % list.length];
    return { kind, label: `My data set · ID ${id}`, seedId: id, low, high };
  }
  const demo = DEMOS[kind];
  if (!demo) throw new Error('Unknown data set.');
  return { kind, label: demo.label, seedId: '', low: demo.low, high: demo.high };
}

/* ---------- statistics that match pandas ---------- */
const valid = (xs) => xs.filter((v) => Number.isFinite(v));
/** pandas quantile, linear interpolation. */
export function quantile(xs, q) {
  const v = valid(xs).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const p = (v.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  return v[lo] + (v[hi] - v[lo]) * (p - lo);
}
export function stats(xs) {
  const v = valid(xs);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return { n: v.length, missing: xs.length - v.length, mean, median: quantile(v, 0.5), q1: quantile(v, 0.25), q3: quantile(v, 0.75),
    p10: quantile(v, 0.1), p90: quantile(v, 0.9), max: Math.max(...v), above: v.filter((x) => x > LEVEL).length / v.length };
}

/** Share of the valid hours of `xs` below `level` (Step 3: hours of the higher month below the lower month's mean). */
export function shareBelow(xs, level) { const v = valid(xs); return v.filter((x) => x < level).length / v.length; }

/** The axis the report used: bars start at floor(0.9 × the smaller mean). */
export function reportBaseline(a, b) { return Math.floor(0.9 * Math.min(a, b)); }

/** How much a figure exaggerates (Tufte's lie factor): the change the reader sees over the change in the data. */
export function lieFactor(a, b, base) {
  const shown = (b - base) / (a - base) - 1, actual = b / a - 1;
  return shown / actual;
}

/** Share of valid hours in each bin [k·w, (k+1)·w), as numpy.histogram with the last bin closed. */
export function histogram(xs, w, top) {
  const v = valid(xs), n = Math.ceil(top / w), out = new Array(n).fill(0);
  for (const x of v) out[Math.min(n - 1, Math.floor(x / w))]++;
  return out.map((c) => c / v.length);
}

/** Daily means (days with at least 18 valid hours) for the whole year, for the trend in Step 9. */
export function dailyMeans(ms) {
  const out = [];
  for (const m of ms) {
    const days = new Map();
    m.t.forEach((s, i) => { if (!days.has(s.day)) days.set(s.day, []); if (Number.isFinite(m.y[i])) days.get(s.day).push(m.y[i]); });
    for (const [day, v] of days) out.push({ day, month: m.key, n: v.length, mean: v.length >= 18 ? v.reduce((a, b) => a + b, 0) / v.length : NaN });
  }
  return out;
}

/** Least-squares line through the daily means from month `from` to month `to` (inclusive), per 30 days. */
export function trend(days, from, to) {
  const pts = days.map((d, k) => [k, d.mean, d.month]).filter(([, y, m]) => Number.isFinite(y) && m >= from && m <= to);
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  const slope = sxy / sxx;
  return { n, slope, per30: slope * 30, intercept: my - slope * mx, x0: pts[0][0], x1: pts[n - 1][0] };
}

export function toCsv(a, b) {
  const lines = ['datetime,C6H6_ugm3'];
  for (const m of [a, b].sort((p, q) => (p.key < q.key ? -1 : 1))) m.t.forEach((s, i) => lines.push(`${s.iso.replace('T', ' ')},${Number.isFinite(m.y[i]) ? m.y[i].toFixed(1) : ''}`));
  return lines.join('\n') + '\n';
}

export function notebookReference(a, b) {
  const sa = stats(a.y), sb = stats(b.y);
  return [
    { id: 'mean-low', text: `Mean benzene in ${a.label}, ${UNIT} (missing hours left out)`, value: sa.mean, tolerance: 0.005, decimals: 2 },
    { id: 'mean-high', text: `Mean benzene in ${b.label}, ${UNIT}`, value: sb.mean, tolerance: 0.005, decimals: 2 },
    { id: 'above-high', text: `Share of the valid hours in ${b.label} above ${LEVEL} ${UNIT}, %`, value: 100 * sb.above, tolerance: 0.05, decimals: 1 },
  ];
}

export const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('-', '−') : '–');
