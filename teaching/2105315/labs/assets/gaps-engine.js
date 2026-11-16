/** Lab 02 · gap-filling engine. Pure functions, no DOM: the page and the Node checks both import it.
 * Data: benzene, C6H6(GT), from the UCI Air Quality record (same file as Lab 01). Each window is a
 * real 14-day stretch with no missing benzene hour, so the true value of every hour is known. The gaps
 * are made for the exercise, in patterns seen in the real record. */
import { hashText, normaliseId, validStudentId, parseValue, stampAt, indexOf, MISSING } from './audit-engine.js';

export const COLUMN = 'C6H6(GT)';
export const UNIT = 'µg/m³';
export const WINDOW_HOURS = 336;
export const OUTAGE_HOURS = 72;
export const SCATTERED_HOURS = 12;
export const BYVALUE_HOURS = 15;
export const METHODS = [
  { id: 'drop', label: 'Drop the missing hours' },
  { id: 'mean', label: 'Fill with the mean' },
  { id: 'linear', label: 'Linear interpolation' },
  { id: 'ffill', label: 'Carry the last value forward' },
  { id: 'hour', label: 'Same hour on other days' },
];
export const PATTERNS = [
  { id: 'scattered', label: 'Scattered hours', note: `${SCATTERED_HOURS} single hours, spread over the two weeks` },
  { id: 'daily', label: 'Every day at 04:00', note: 'the same hour each day, as in the real CO record' },
  { id: 'outage', label: 'Three-day outage', note: `${OUTAGE_HOURS} hours in one block` },
];
export const DEMOS = {
  spring: { label: 'Demo A · spring 2004', start: '2004-04-26T00:00', seed: 101 },
  autumn: { label: 'Demo B · autumn 2004', start: '2004-11-08T00:00', seed: 202 },
};

export { stampAt };

/** Every start hour whose 336 hours all have a benzene value (about 4,300 choices). */
export function completeStarts(data) {
  const text = data.text[COLUMN];
  const out = [];
  let bad = 0;
  const isBad = (i) => { const v = parseValue(text[i]); return !Number.isFinite(v) || v === MISSING; };
  for (let i = 0; i < WINDOW_HOURS; i++) bad += isBad(i);
  for (let s = 0; s + WINDOW_HOURS <= data.hours; s++) {
    if (s > 0) bad += isBad(s + WINDOW_HOURS - 1) - isBad(s - 1);
    if (bad === 0) out.push(s);
  }
  return out;
}

/** Which 14 days, and the seed that places the gaps. kind: 'spring' | 'autumn' | 'student'. */
export function makeVariant(data, kind, studentId = '', starts = null) {
  if (kind === 'student') {
    const id = normaliseId(studentId);
    if (!validStudentId(id)) throw new Error('Enter your student ID (8 to 12 digits) to load your own data set.');
    const h = hashText(`2105315-lab02|${id}`);
    const list = starts || completeStarts(data);
    return { kind, label: `My data set · ID ${id}`, seedId: id, startIndex: list[h % list.length], seed: hashText(`gaps|${id}`) };
  }
  const demo = DEMOS[kind];
  if (!demo) throw new Error('Unknown data set.');
  return { kind, label: demo.label, seedId: '', startIndex: indexOf(data, demo.start), seed: demo.seed };
}

/** The true record: hour stamps and benzene values. */
export function series(data, variant) {
  const t = [], y = new Array(WINDOW_HOURS);
  for (let i = 0; i < WINDOW_HOURS; i++) {
    t.push(stampAt(data, variant.startIndex + i));
    y[i] = parseValue(data.text[COLUMN][variant.startIndex + i]);
  }
  return { t, y };
}

function rng(seed) {                       // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gap positions (sorted hour indices) for every pattern. The first and last hour are never removed, so
 * every method has a value on both sides of every gap. */
export function gapPatterns(variant, s) {
  const r = rng(variant.seed);
  const n = WINDOW_HOURS;
  const outStart = 24 + Math.floor(r() * (n - 48 - OUTAGE_HOURS));
  const outage = Array.from({ length: OUTAGE_HOURS }, (_, k) => outStart + k);
  const daily = [];
  for (let i = 1; i < n - 1; i++) if (s.t[i].hour === 4) daily.push(i);
  const taken = new Set();
  const scattered = [];
  while (scattered.length < SCATTERED_HOURS) {
    const i = 6 + Math.floor(r() * (n - 12));
    if (s.t[i].hour === 4 || taken.has(i)) continue;
    scattered.push(i); taken.add(i - 1); taken.add(i); taken.add(i + 1);
  }
  scattered.sort((a, b) => a - b);
  const combined = [...new Set([...scattered, ...daily, ...outage])].sort((a, b) => a - b);
  const byvalue = s.y.map((v, i) => [v, i]).filter(([, i]) => i > 0 && i < n - 1)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, BYVALUE_HOURS).map(([, i]) => i).sort((a, b) => a - b);
  return { scattered, daily, outage, combined, byvalue };
}

/** The record with gaps: NaN where a value is missing. */
export function withGaps(y, gaps) {
  const out = y.slice();
  for (const i of gaps) out[i] = NaN;
  return out;
}

const valid = (xs) => xs.filter((v) => Number.isFinite(v));
const meanOf = (xs) => { const v = valid(xs); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };

/** Fill the gaps. Matches pandas: fillna(mean), interpolate() (linear, by position), ffill(),
 * fillna(groupby(hour).transform("mean")). Hours a method cannot fill stay NaN. */
export function fill(obs, method, hours) {
  const y = obs.slice(), n = y.length;
  if (method === 'drop') return y;
  if (method === 'mean') { const m = meanOf(obs); return y.map((v) => (Number.isFinite(v) ? v : m)); }
  if (method === 'ffill') { let last = NaN; return y.map((v) => (Number.isFinite(v) ? (last = v) : last)); }
  if (method === 'hour') {
    const sum = new Array(24).fill(0), cnt = new Array(24).fill(0);
    obs.forEach((v, i) => { if (Number.isFinite(v)) { sum[hours[i]] += v; cnt[hours[i]]++; } });
    return y.map((v, i) => (Number.isFinite(v) ? v : cnt[hours[i]] ? sum[hours[i]] / cnt[hours[i]] : NaN));
  }
  if (method === 'linear') {
    let i = 0;
    while (i < n) {
      if (Number.isFinite(y[i])) { i++; continue; }
      let j = i; while (j < n && !Number.isFinite(y[j])) j++;
      const a = i - 1, b = j;
      if (a >= 0 && b < n) for (let k = i; k < j; k++) y[k] = y[a] + (y[b] - y[a]) * (k - a) / (b - a);
      else if (a >= 0) for (let k = i; k < j; k++) y[k] = y[a];   // pandas fills a trailing gap with the last value
      i = j;
    }
    return y;
  }
  throw new Error(`Unknown method ${method}`);
}

/** Linear interpolation only across gaps no longer than maxGap hours; longer gaps stay missing. */
export function fillShortGaps(obs, maxGap) {
  const lin = fill(obs, 'linear'), y = obs.slice(), n = y.length;
  let i = 0;
  while (i < n) {
    if (Number.isFinite(obs[i])) { i++; continue; }
    let j = i; while (j < n && !Number.isFinite(obs[j])) j++;
    if (j - i <= maxGap) for (let k = i; k < j; k++) y[k] = lin[k];
    i = j;
  }
  return y;
}

/** The two answers the report needs: the two-week mean and the typical daily peak (mean over calendar
 * days of each day's highest hour; a day with no value is left out, as pandas groupby().max().mean() does). */
export function answers(xs, days) {
  const v = valid(xs), top = new Map();
  xs.forEach((x, i) => { if (Number.isFinite(x)) top.set(days[i], Math.max(top.get(days[i]) ?? -Infinity, x)); });
  return { mean: meanOf(xs), dailyMax: meanOf([...top.values()]), unfilled: xs.length - v.length };
}

/** Every method on one gap pattern, with its error against the truth. */
export function compare(s, gaps) {
  const days = s.t.map((x) => x.day), hours = s.t.map((x) => x.hour);
  const truth = answers(s.y, days);
  const obs = withGaps(s.y, gaps);
  const rows = METHODS.map((m) => {
    const filled = fill(obs, m.id, hours), a = answers(filled, days);
    return { id: m.id, label: m.label, filled, ...a, err: { mean: a.mean - truth.mean, dailyMax: a.dailyMax - truth.dailyMax } };
  });
  for (const k of ['mean', 'dailyMax']) {
    const best = Math.min(...rows.map((r) => Math.abs(r.err[k])));
    for (const r of rows) r[`best_${k}`] = Math.abs(r.err[k]) <= best + 0.005;
  }
  // Overall: relative error of the mean plus relative error of the daily peak. Ties within 0.2 % count as equal.
  for (const r of rows) r.score = Math.abs(r.err.mean) / truth.mean + Math.abs(r.err.dailyMax) / truth.dailyMax;
  const top = Math.min(...rows.map((r) => r.score));
  for (const r of rows) r.best_overall = r.score <= top + 0.002;
  return { truth, rows, missing: gaps.length };
}

/** The file students download: comma-separated, one hour per row, empty cell where the value is missing. */
export function toCsv(s, gaps) {
  const miss = new Set(gaps);
  const lines = ['datetime,C6H6_ugm3'];
  s.t.forEach((t, i) => lines.push(`${t.iso.replace('T', ' ')},${miss.has(i) ? '' : s.y[i].toFixed(1)}`));
  return lines.join('\n') + '\n';
}

/** Numbers for Step 5 (on the downloaded file, all three patterns together). */
export function notebookReference(s, gaps) {
  const obs = withGaps(s.y, gaps);
  return [
    { id: 'missing', text: 'Missing hours in the file', value: gaps.length, tolerance: 0, decimals: 0 },
    { id: 'mean-drop', text: `Mean benzene after dropping the missing hours, ${UNIT}`, value: meanOf(obs), tolerance: 0.005, decimals: 2 },
    { id: 'mean-linear', text: `Mean benzene after linear interpolation, ${UNIT}`, value: meanOf(fill(obs, 'linear')), tolerance: 0.005, decimals: 2 },
  ];
}

export const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('-', '−') : '–');
export const signed = (v, d = 2) => (Number.isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d) : '–');
