/** Lab 06 · shift engine. Pure functions, no DOM: the page and the Node checks both import it.
 * Data: UCI Air Quality (same file as Labs 01 to 05), -200 treated as missing, nothing else changed.
 * A report says benzene changed after a date. Compare the 14 days before with the 14 days after:
 * a t-test on hourly values, a t-test on daily means, and the same tests at every other date in the record
 * (placebo dates), where nothing was changed on purpose. */
import { hashText, normaliseId, validStudentId, parseValue, stampAt, MISSING } from './audit-engine.js';

export const COL = 'C6H6(GT)';
export const WINDOW = 14;                 // days before and after
export const MIN_HOURS = 18;              // a daily mean needs at least 18 valid hours
export const WINDOWS = [7, 14, 21, 28];   // Extension
export const ALPHA = 0.05;
export const DEMOS = {
  a: { label: 'Demo A', day: '2004-07-29' },
  b: { label: 'Demo B', day: '2004-11-07' },
};

const isNum = Number.isFinite;
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const variance = (v) => { const m = mean(v); return v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1); };
export const minDays = (w) => Math.round(0.85 * w);

/* ---------- Student t distribution ---------- */
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5, ser = 1.000000000190015;
  tmp -= (x + 0.5) * Math.log(tmp);
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betacf(a, b, x) {
  const FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}
/** Regularized incomplete beta I_x(a, b). */
export function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
/** Two-sided p for a t statistic with df degrees of freedom. */
export const tTwoSided = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);
/** t quantile with two-sided tail probability p (bisection). */
export function tQuantile(p, df) {
  let lo = 0, hi = 1000;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tTwoSided(mid, df) > p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** Welch two-sample t-test, after minus before (scipy.stats.ttest_ind(after, before, equal_var=False)). */
export function welch(after, before) {
  const na = after.length, nb = before.length, va = variance(after) / na, vb = variance(before) / nb, se = Math.sqrt(va + vb);
  const diff = mean(after) - mean(before), t = diff / se, df = (va + vb) ** 2 / (va ** 2 / (na - 1) + vb ** 2 / (nb - 1));
  const q = tQuantile(1 - 0.95, df);
  return { diff, t, df, p: tTwoSided(t, df), se, ci: [diff - q * se, diff + q * se], na, nb, meanAfter: mean(after), meanBefore: mean(before) };
}

/* ---------- data ---------- */
export function load(data) {
  const hourly = [], cal = [];
  for (let i = 0; i < data.hours; i++) { const v = parseValue(data.text[COL][i]); hourly.push(isNum(v) && v !== MISSING ? v : NaN); }
  for (let i = 0; i + 24 <= data.hours; i++) { const s = stampAt(data, i); if (s.hour === 0) cal.push({ i, day: s.day }); }
  const daily = cal.map(({ i }) => { const v = hourly.slice(i, i + 24).filter(isNum); return v.length >= MIN_HOURS ? mean(v) : NaN; });
  const L = { data, hourly, cal, daily, placebo: {} };
  // Student dates: the hourly test gives p < 0.01, and every Extension window has enough data.
  L.candidates = placebo(L, WINDOW).filter((r) => r.hourly.p < 0.01 && WINDOWS.every((w) => compare(L, r.k, w))).map((r) => r.k);
  return L;
}

/** Before and after for the change at the start of calendar day k, w days each side; null if too few valid days. */
export function compare(L, k, w = WINDOW) {
  if (k - w < 0 || k + w > L.cal.length) return null;
  const dB = L.daily.slice(k - w, k), dA = L.daily.slice(k, k + w);
  const vB = dB.filter(isNum), vA = dA.filter(isNum);
  if (vB.length < minDays(w) || vA.length < minDays(w)) return null;
  const i0 = L.cal[k - w].i, i1 = L.cal[k].i, i2 = i1 + w * 24;
  const hB = L.hourly.slice(i0, i1), hA = L.hourly.slice(i1, i2);
  return { k, w, day: L.cal[k].day, days: L.cal.slice(k - w, k + w).map((c) => c.day), dailyBefore: dB, dailyAfter: dA,
    hourlyBefore: hB, hourlyAfter: hA, hourly: welch(hA.filter(isNum), hB.filter(isNum)), daily: welch(vA, vB) };
}

/** The same two tests at every date in the record with enough data (cached per window length). */
export function placebo(L, w = WINDOW) {
  if (!L.placebo[w]) {
    const out = [];
    for (let k = w; k + w <= L.cal.length; k++) { const r = compare(L, k, w); if (r) out.push({ k, day: r.day, diff: r.daily.diff, hourly: { p: r.hourly.p }, daily: { p: r.daily.p } }); }
    L.placebo[w] = out;
  }
  return L.placebo[w];
}

/** Share of placebo dates the tests call significant, and where one date's difference ranks among them. */
export function rates(list) {
  const n = list.length;
  return { n, hourly: list.filter((r) => r.hourly.p < ALPHA).length / n, daily: list.filter((r) => r.daily.p < ALPHA).length / n };
}
export function rank(list, diff) {
  const larger = list.filter((r) => Math.abs(r.diff) >= Math.abs(diff) - 1e-12).length;
  return { larger, n: list.length, share: larger / list.length };
}

const dayIndex = (L, key) => L.cal.findIndex((c) => c.day === key);

export function makeVariant(L, kind, studentId = '') {
  if (kind === 'student') {
    const id = normaliseId(studentId);
    if (!validStudentId(id)) throw new Error('Enter your student ID (8 to 12 digits) to load your own data set.');
    return { kind, label: `My data set · ID ${id}`, seedId: id, k: L.candidates[hashText(`2105315-lab06|${id}`) % L.candidates.length] };
  }
  const demo = DEMOS[kind];
  if (!demo) throw new Error('Unknown data set.');
  return { kind, label: demo.label, seedId: '', k: dayIndex(L, demo.day) };
}

/** Hourly file for Step 5: 28 days, one row per hour, period = before or after. */
export function toCsv(L, r) {
  const lines = ['datetime,C6H6_ugm3,period'], i0 = L.cal[r.k - r.w].i;
  [...r.hourlyBefore, ...r.hourlyAfter].forEach((v, j) => lines.push(`${stampAt(L.data, i0 + j).iso},${isNum(v) ? v.toFixed(1) : ''},${j < r.w * 24 ? 'before' : 'after'}`));
  return lines.join('\n') + '\n';
}

/** Numbers for Step 5. The file holds the source values, so these are the page's numbers. */
export function notebookReference(r) {
  return [
    { id: 'hours', text: 'Hourly values with data, before and after together', value: r.hourly.na + r.hourly.nb, tolerance: 0, decimals: 0 },
    { id: 'diff', text: 'Mean of the daily means after minus before, µg/m³ (days with at least 18 hours)', value: r.daily.diff, tolerance: 0.01, decimals: 2 },
    { id: 'p-daily', text: 'p of the Welch t-test on those daily means (scipy ttest_ind, equal_var=False)', value: r.daily.p, tolerance: 0.005, decimals: 3 },
  ];
}

export const fmt = (v, d = 2) => (isNum(v) ? v.toFixed(d).replace('-', '−') : '–');
export function fmtP(p) {
  if (!isNum(p)) return '–';
  if (p >= 0.001) return p.toFixed(3);
  const e = Math.floor(Math.log10(p)), m = p / 10 ** e;
  return `${m.toFixed(1)} × 10${String(e).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}`;
}
export const pct = (x) => `${Math.round(100 * x)} %`;
