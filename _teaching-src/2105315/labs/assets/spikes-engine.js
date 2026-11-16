/** Lab 03 · spike engine. Pure functions, no DOM: the page and the Node checks both import it.
 * Data: benzene C6H6(GT) from the reference analyzer and the co-located low-cost sensor PT08.S1(CO),
 * UCI Air Quality (same file as Labs 01 and 02). Each window is a real 14-day stretch in which both have
 * every hour. Eight one-hour transmitter faults are added to the benzene record only; the sensor is left
 * as recorded. A fault is therefore known to be an error, and a real event shows on both instruments. */
import { hashText, normaliseId, validStudentId, parseValue, stampAt, indexOf, MISSING } from './audit-engine.js';

export const COLUMN = 'C6H6(GT)';
export const SENSOR = 'PT08.S1(CO)';
export const UNIT = 'µg/m³';
export const WINDOW_HOURS = 336;
export const FAULTS = 8;
export const CANDIDATES = 15;
export const HAMPEL_WINDOW = 7;
export const RULES = [
  { id: 'z', label: 'z-score over the whole record', detail: '|x − mean| > 3 standard deviations' },
  { id: 'hampel', label: 'Hampel filter', detail: '|x − median of 7 h| > 3 × 1.4826 × MAD of 7 h' },
  { id: 'sensor', label: 'Compare with the second sensor', detail: 'residual from a straight-line fit to PT08.S1(CO), > 4 × 1.4826 × MAD' },
];
export const DEMOS = {
  spring: { label: 'Demo A · spring 2004', start: '2004-04-26T00:00', seed: 303 },
  autumn: { label: 'Demo B · autumn 2004', start: '2004-11-08T00:00', seed: 404 },
};

export { stampAt };

const bad = (t) => { const v = parseValue(t); return !Number.isFinite(v) || v === MISSING; };

/** Start hours whose 336 hours all have both benzene and the sensor. */
export function completeStarts(data) {
  const b = data.text[COLUMN], s = data.text[SENSOR], out = [];
  const isBad = (i) => (bad(b[i]) || bad(s[i]) ? 1 : 0);
  let n = 0;
  for (let i = 0; i < WINDOW_HOURS; i++) n += isBad(i);
  for (let st = 0; st + WINDOW_HOURS <= data.hours; st++) {
    if (st > 0) n += isBad(st + WINDOW_HOURS - 1) - isBad(st - 1);
    if (n === 0) out.push(st);
  }
  return out;
}

export function makeVariant(data, kind, studentId = '', starts = null) {
  if (kind === 'student') {
    const id = normaliseId(studentId);
    if (!validStudentId(id)) throw new Error('Enter your student ID (8 to 12 digits) to load your own data set.');
    const list = starts || completeStarts(data);
    return { kind, label: `My data set · ID ${id}`, seedId: id, startIndex: list[hashText(`2105315-lab03|${id}`) % list.length], seed: hashText(`spikes|${id}`) };
  }
  const demo = DEMOS[kind];
  if (!demo) throw new Error('Unknown data set.');
  return { kind, label: demo.label, seedId: '', startIndex: indexOf(data, demo.start), seed: demo.seed };
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

const r1 = (v) => Math.round(v * 10) / 10;

/** True benzene, sensor, and the benzene record with eight faults (values kept to one decimal, as in the source). */
export function series(data, variant) {
  const t = [], truth = [], sensor = [];
  for (let i = 0; i < WINDOW_HOURS; i++) {
    t.push(stampAt(data, variant.startIndex + i));
    truth.push(parseValue(data.text[COLUMN][variant.startIndex + i]));
    sensor.push(parseValue(data.text[SENSOR][variant.startIndex + i]));
  }
  const r = rng(variant.seed), faults = [];
  while (faults.length < FAULTS) {
    const i = 4 + Math.floor(r() * (WINDOW_HOURS - 8));
    if (faults.every((f) => Math.abs(f.i - i) >= 6)) faults.push({ i });
  }
  const kinds = ['jump', 'jump', 'jump', 'jump', 'small', 'small', 'drop', 'drop'];
  for (let k = kinds.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [kinds[k], kinds[j]] = [kinds[j], kinds[k]]; }
  const y = truth.slice();
  faults.forEach((f, k) => {
    const u = r();
    f.kind = kinds[k];
    if (f.kind === 'jump') y[f.i] = r1(truth[f.i] + 15 + 15 * u);
    else if (f.kind === 'small') y[f.i] = r1(truth[f.i] + 6 + 4 * u);
    else y[f.i] = truth[f.i] > 3 ? 0.1 : r1(truth[f.i] + 8 + 4 * u);
    f.truth = truth[f.i]; f.recorded = y[f.i];
  });
  faults.sort((a, b) => a.i - b.i);
  return { t, truth, sensor, y, faults };
}

/* ---------- statistics that match pandas ---------- */
export function median(xs) {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b), n = v.length;
  if (!n) return NaN;
  return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); };

/** pandas rolling(w, center=True): the window for i runs from i - floor(w/2) for w values; NaN if incomplete. */
function centered(xs, w, f) {
  const n = xs.length, out = new Array(n).fill(NaN), lo = Math.floor(w / 2);
  for (let i = 0; i < n; i++) { const a = i - lo, b = a + w - 1; if (a >= 0 && b < n) out[i] = f(xs.slice(a, b + 1)); }
  return out;
}

/** Scores and flags for the three rules. hampelK sets the Hampel threshold (default 3). */
export function rules(s, hampelK = 3) {
  const y = s.y, n = y.length;
  const m = mean(y), sd = std(y);
  const z = y.map((v) => Math.abs(v - m) / sd);
  const med = centered(y, HAMPEL_WINDOW, median);
  const mad = centered(y, HAMPEL_WINDOW, (w) => { const c = median(w); return median(w.map((v) => Math.abs(v - c))); });
  const hampel = y.map((v, i) => (Number.isFinite(med[i]) ? Math.abs(v - med[i]) / (1.4826 * mad[i]) : NaN));
  const sx = mean(s.sensor), sy = m;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (s.sensor[i] - sx) * (y[i] - sy); sxx += (s.sensor[i] - sx) ** 2; }
  const slope = sxy / sxx, intercept = sy - slope * sx;
  const res = y.map((v, i) => v - (intercept + slope * s.sensor[i]));
  const rmed = median(res), rmad = median(res.map((v) => Math.abs(v - rmed)));
  const sensorScore = res.map((v) => Math.abs(v - rmed) / (1.4826 * rmad));
  const flags = {
    z: z.map((v) => v > 3),
    hampel: hampel.map((v) => Number.isFinite(v) && v > hampelK),
    sensor: sensorScore.map((v) => v > 4),
  };
  return { z, hampel, sensorScore, med, fit: { slope, intercept }, flags, mean: m, std: sd };
}

/** How each rule did against the known faults. */
export function score(s, flags) {
  const fault = new Set(s.faults.map((f) => f.i));
  const out = {};
  for (const [id, f] of Object.entries(flags)) {
    const hit = [], wrong = [];
    f.forEach((on, i) => { if (on) (fault.has(i) ? hit : wrong).push(i); });
    out[id] = { caught: hit.length, missed: FAULTS - hit.length, falseAlarms: wrong.length, flagged: hit.length + wrong.length, hours: f.map((on, i) => (on ? i : -1)).filter((i) => i >= 0) };
  }
  return out;
}

/** The 15 hours a student judges: the eight faults and the seven real hours that look most like spikes. */
export function candidates(s) {
  const r = rules(s), fault = new Set(s.faults.map((f) => f.i));
  const real = r.hampel.map((v, i) => [Number.isFinite(v) ? Math.abs(s.y[i] - r.med[i]) : -1, i])
    .filter(([, i]) => !fault.has(i)).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, CANDIDATES - FAULTS).map(([, i]) => i);
  return [...fault, ...real].sort((a, b) => a - b).map((i, k) => ({ n: k + 1, i, fault: fault.has(i) }));
}

/** pandas rolling(w).mean() (trailing) or rolling(w, center=True).mean(). */
export function smooth(xs, w, centre) {
  if (centre) return centered(xs, w, mean);
  return xs.map((_, i) => (i >= w - 1 ? mean(xs.slice(i - w + 1, i + 1)) : NaN));
}

/** Typical daily peak of a series: mean over calendar days of the day's highest value (days with a value). */
export function dailyPeak(t, xs) {
  const top = new Map();
  t.forEach((s, i) => { if (Number.isFinite(xs[i])) top.set(s.day, Math.max(top.get(s.day) ?? -Infinity, xs[i])); });
  return top.size ? mean([...top.values()]) : NaN;
}

/** How many hours a rolling mean runs late: (w − 1)/2 for a trailing window; for a centered window 0, or
 * 0.5 when w is even (pandas puts the extra hour before the centre). */
export function lagOf(w, centre) {
  return centre ? (w % 2 ? 0 : 0.5) : (w - 1) / 2;
}

export function toCsv(s) {
  const lines = ['datetime,C6H6_ugm3,PT08_S1_CO'];
  s.t.forEach((t, i) => lines.push(`${t.iso.replace('T', ' ')},${s.y[i].toFixed(1)},${Math.round(s.sensor[i])}`));
  return lines.join('\n') + '\n';
}

/** Numbers for Step 5: what the AI's z-score code reports on the downloaded file. */
export function notebookReference(s) {
  const r = rules(s), kept = s.y.filter((_, i) => !r.flags.z[i]);
  return [
    { id: 'zcount', text: 'Hours with |z| > 3 (z from the mean and standard deviation of all hours)', value: r.flags.z.filter(Boolean).length, tolerance: 0, decimals: 0 },
    { id: 'mean-all', text: `Mean benzene of all hours, ${UNIT}`, value: r.mean, tolerance: 0.005, decimals: 2 },
    { id: 'mean-kept', text: `Mean benzene after removing the rows with |z| > 3, ${UNIT}`, value: mean(kept), tolerance: 0.005, decimals: 2 },
  ];
}

export const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('-', '−') : '–');
export const signed = (v, d = 2) => (Number.isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d) : '–');
