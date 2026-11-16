/** Lab 05 · relations engine. Pure functions, no DOM: the page and the Node checks both import it.
 * Data: UCI Air Quality (same file as Labs 01 to 04), -200 treated as missing, nothing else changed.
 * Part A: daily NOx(GT) and temperature over 16 weeks; does the correlation survive removing the seasonal trend?
 * Part B: the low-cost sensor PT08.S1(CO) calibrated against benzene on 14 days; when does it start to drift? */
import { hashText, normaliseId, validStudentId, parseValue, stampAt, MISSING } from './audit-engine.js';

export const DAYS = 112;                 // 16 weeks
export const CAL_DAYS = 14;              // calibration period for Part B
export const MIN_HOURS = 18;             // a daily mean needs at least 18 valid hours
export const TREND_DAYS = 29;            // centred rolling mean used as the seasonal trend
export const MIN_R = 0.4;                // Part A windows: the report's |r| is at least this
export const COLS = { nox: 'NOx(GT)', temp: 'T', benz: 'C6H6(GT)', sensor: 'PT08.S1(CO)' };
export const DEMOS = {
  a: { label: 'Demo A', partA: '2004-06-20', partB: '2004-03-31' },
  b: { label: 'Demo B', partA: '2004-08-15', partB: '2004-06-04' },
};

const val = (data, col, i) => { const v = parseValue(data.text[col][i]); return Number.isFinite(v) && v !== MISSING ? v : NaN; };
const isNum = Number.isFinite;
const mean = (xs) => { const v = xs.filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
const std = (xs) => { const v = xs.filter(isNum), m = mean(v); return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); };

/** Pearson r over the pairs where both are numbers (pandas Series.corr). */
export function pearson(x, y) {
  const p = x.map((v, i) => [v, y[i]]).filter(([a, b]) => isNum(a) && isNum(b));
  const mx = mean(p.map((q) => q[0])), my = mean(p.map((q) => q[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [a, b] of p) { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; syy += (b - my) ** 2; }
  return { r: sxy / Math.sqrt(sxx * syy), n: p.length };
}

/** Whole calendar days in the record: start hour index and day key. */
export function calendar(data) {
  const out = [];
  for (let i = 0; i + 24 <= data.hours; i++) { const s = stampAt(data, i); if (s.hour === 0) out.push({ i, day: s.day }); }
  return out;
}

/** Daily means of one column (NaN for days with fewer than 18 valid hours). */
export function dailyMeans(data, col, cal) {
  return cal.map(({ i }) => { const v = []; for (let k = 0; k < 24; k++) { const x = val(data, col, i + k); if (isNum(x)) v.push(x); } return v.length >= MIN_HOURS ? mean(v) : NaN; });
}

/** pandas rolling(w, center=True, min_periods=m).mean() on a series with NaN. */
export function rollingCentred(xs, w = TREND_DAYS, minPeriods = 15) {
  const lo = Math.floor(w / 2);
  return xs.map((_, i) => { const a = i - lo, b = a + w - 1, v = []; for (let k = Math.max(0, a); k <= Math.min(xs.length - 1, b); k++) if (isNum(xs[k])) v.push(xs[k]); return v.length >= minPeriods ? mean(v) : NaN; });
}

/** Part A for the 16 weeks starting at calendar day d: raw r, r after removing the trend, and the series. */
export function partA(daily, cal, d) {
  const nox = daily.nox.slice(d, d + DAYS), temp = daily.temp.slice(d, d + DAYS);
  const tn = rollingCentred(nox), tt = rollingCentred(temp);
  const dn = nox.map((v, i) => v - tn[i]), dt = temp.map((v, i) => v - tt[i]);
  const raw = pearson(temp, nox), det = pearson(dt, dn);
  return { days: cal.slice(d, d + DAYS).map((c) => c.day), nox, temp, trendNox: tn, trendTemp: tt, detNox: dn, detTemp: dt, raw, det };
}

/** Calendar days that can start Part A: at least 70 complete days and |r| >= 0.4 (about 50 windows, summer to autumn). */
export function startsA(daily, cal) {
  const out = [];
  for (let d = 0; d + DAYS <= cal.length; d++) { const a = partA(daily, cal, d); if (a.raw.n >= 70 && Math.abs(a.raw.r) >= MIN_R) out.push(d); }
  return out;
}

/** Part B: fit benzene = a + b·sensor on the first 14 days (hours with both), daily mean residual over 16 weeks. */
export function partB(data, cal, d) {
  const h0 = cal[d].i, H = DAYS * 24, b = [], s = [];
  for (let k = 0; k < H; k++) { b.push(val(data, COLS.benz, h0 + k)); s.push(val(data, COLS.sensor, h0 + k)); }
  const calPairs = []; for (let k = 0; k < CAL_DAYS * 24; k++) if (isNum(b[k]) && isNum(s[k])) calPairs.push([s[k], b[k]]);
  const mx = mean(calPairs.map((p) => p[0])), my = mean(calPairs.map((p) => p[1]));
  let sxy = 0, sxx = 0; for (const [x, y] of calPairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const res = b.map((y, k) => (isNum(y) && isNum(s[k]) ? y - (intercept + slope * s[k]) : NaN));
  const daily = []; for (let j = 0; j < DAYS; j++) { const v = res.slice(j * 24, j * 24 + 24).filter(isNum); daily.push(v.length >= MIN_HOURS ? mean(v) : NaN); }
  const calDaily = daily.slice(0, CAL_DAYS);
  return { days: cal.slice(d, d + DAYS).map((c) => c.day), fit: { slope, intercept, hours: calPairs.length }, daily, mu: mean(calDaily), sigma: std(calDaily) };
}

export function startsB(data, cal) {
  const out = [];
  for (let d = 0; d + DAYS <= cal.length; d++) {
    let n = 0; for (let k = 0; k < CAL_DAYS * 24; k++) if (isNum(val(data, COLS.benz, cal[d].i + k)) && isNum(val(data, COLS.sensor, cal[d].i + k))) n++;
    if (n < 200) continue;
    const pb = partB(data, cal, d);
    if (pb.daily.filter(isNum).length >= 80 && pb.daily.slice(0, CAL_DAYS).filter(isNum).length >= 10) out.push(d);
  }
  return out;
}

/** Two-sided CUSUM on the daily residuals after the calibration days. k and h in units of sigma.
 * Alarm: first day either sum exceeds h. Onset estimate: the last day that sum was zero before the alarm. */
export function cusum(pb, k = 0.5, h = 5) {
  const K = k * pb.sigma, Hs = h * pb.sigma, up = [], down = [];
  let su = 0, sd = 0, alarm = null, side = null, lastZeroUp = CAL_DAYS - 1, lastZeroDown = CAL_DAYS - 1;
  pb.daily.forEach((v, j) => {
    if (j < CAL_DAYS || !isNum(v)) { up.push(j < CAL_DAYS ? 0 : su); down.push(j < CAL_DAYS ? 0 : sd); return; }
    su = Math.max(0, su + (v - pb.mu) - K); sd = Math.max(0, sd - (v - pb.mu) - K);
    up.push(su); down.push(sd);
    if (alarm === null) {
      if (su === 0) lastZeroUp = j;
      if (sd === 0) lastZeroDown = j;
      if (su > Hs || sd > Hs) { alarm = j; side = su > Hs ? 'up' : 'down'; }
    }
  });
  return { up, down, alarm, side, onset: alarm === null ? null : (side === 'up' ? lastZeroUp : lastZeroDown) + 1, K, H: Hs };
}

/** The simple rule: the first day after calibration whose residual is more than 3 sigma from the calibration mean. */
export function threshold(pb, z = 3) {
  const j = pb.daily.findIndex((v, i) => i >= CAL_DAYS && isNum(v) && Math.abs(v - pb.mu) > z * pb.sigma);
  return j < 0 ? null : j;
}

export function load(data) {
  const cal = calendar(data);
  const daily = { nox: dailyMeans(data, COLS.nox, cal), temp: dailyMeans(data, COLS.temp, cal) };
  return { cal, daily, startsA: startsA(daily, cal), startsB: startsB(data, cal) };
}

const dayIndex = (cal, key) => cal.findIndex((c) => c.day === key);

export function makeVariant(L, kind, studentId = '') {
  if (kind === 'student') {
    const id = normaliseId(studentId);
    if (!validStudentId(id)) throw new Error('Enter your student ID (8 to 12 digits) to load your own data set.');
    return { kind, label: `My data set · ID ${id}`, seedId: id,
      dayA: L.startsA[hashText(`2105315-lab05a|${id}`) % L.startsA.length], dayB: L.startsB[hashText(`2105315-lab05b|${id}`) % L.startsB.length] };
  }
  const demo = DEMOS[kind];
  if (!demo) throw new Error('Unknown data set.');
  return { kind, label: demo.label, seedId: '', dayA: dayIndex(L.cal, demo.partA), dayB: dayIndex(L.cal, demo.partB) };
}

export function toCsv(a) {
  const lines = ['date,NOx_ppb,T_degC'];
  a.days.forEach((day, i) => lines.push(`${day},${isNum(a.nox[i]) ? a.nox[i].toFixed(2) : ''},${isNum(a.temp[i]) ? a.temp[i].toFixed(2) : ''}`));
  return lines.join('\n') + '\n';
}

/** Numbers for Step 5, computed from the downloaded file (values rounded to 2 decimals, as written). */
export function notebookReference(a) {
  const r2 = (xs) => xs.map((v) => (isNum(v) ? Math.round(v * 100) / 100 : NaN));
  const nox = r2(a.nox), temp = r2(a.temp);
  const tn = rollingCentred(nox), tt = rollingCentred(temp);
  const raw = pearson(temp, nox), det = pearson(temp.map((v, i) => v - tt[i]), nox.map((v, i) => v - tn[i]));
  return [
    { id: 'days', text: 'Days with both NOx and temperature', value: raw.n, tolerance: 0, decimals: 0 },
    { id: 'r-raw', text: 'Correlation r between daily temperature and daily NOx', value: raw.r, tolerance: 0.005, decimals: 2 },
    { id: 'r-det', text: 'r after subtracting each series’ 29-day centered rolling mean (min_periods=15)', value: det.r, tolerance: 0.005, decimals: 2 },
  ];
}

export const fmt = (v, d = 2) => (isNum(v) ? v.toFixed(d).replace('-', '−') : '–');
