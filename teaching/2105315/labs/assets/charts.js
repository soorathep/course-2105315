/** Small SVG charts for the 2105315 labs. Teal = reference, amber = the effect the step is about.
 * Every chart is a 760 x 300 viewBox; on phones the container scrolls sideways (.figure-scroll). */
const NS = 'http://www.w3.org/2000/svg';
const W = 760, H = 300, M = { l: 58, r: 18, t: 18, b: 44 };

function el(name, attrs = {}, text) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function frame(svg, label) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
}

function niceTicks(lo, hi, count = 5) {
  const span = hi - lo || 1, raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

function yAxis(svg, y, ticks, label, fmt = (v) => String(v)) {
  const g = el('g', { class: 'grid' }), a = el('g', { class: 'ax' });
  for (const v of ticks) {
    g.append(el('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v) }));
    a.append(el('text', { x: M.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, fmt(v)));
  }
  a.append(el('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b }));
  a.append(el('text', { class: 'ax-label', x: 14, y: M.t + (H - M.t - M.b) / 2, transform: `rotate(-90 14 ${M.t + (H - M.t - M.b) / 2})`, 'text-anchor': 'middle' }, label));
  svg.append(g, a);
}

/** CO(GT) over the window. mode 'recorded' plots -200 as a number; 'missing' leaves a gap and marks a rug. */
export function coChart(svg, points, mode) {
  const n = points.length;
  const valid = points.filter((p) => !p.missing).map((p) => p.value);
  const top = Math.max(1, ...valid) * 1.08;
  const lo = mode === 'recorded' ? -210 : 0;
  const x = (k) => M.l + (k / Math.max(1, n - 1)) * (W - M.l - M.r);
  const y = (v) => M.t + (1 - (v - lo) / (top - lo)) * (H - M.t - M.b);
  frame(svg, mode === 'recorded'
    ? 'CO(GT) over 14 days with the -200 code plotted as if it were a concentration. The line drops to -200 at every missing hour.'
    : 'CO(GT) over 14 days with -200 treated as missing. The line breaks at missing hours, which are marked on the time axis.');
  const ticks = mode === 'recorded' ? [-200, -150, -100, -50, 0] : niceTicks(0, top, 5);
  yAxis(svg, y, ticks, 'CO(GT), mg/m³');
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  points.forEach((p, k) => {
    if (p.hour === 0) {
      ax.append(el('line', { x1: x(k), x2: x(k), y1: H - M.b, y2: H - M.b + 5 }));
      if (k + 24 <= n) ax.append(el('text', { x: x(k + 12), y: H - M.b + 18, 'text-anchor': 'middle' }, p.date.slice(0, 5)));
    }
  });
  svg.append(ax);
  if (mode === 'recorded') svg.append(el('line', { class: 'zero-line', x1: M.l, x2: W - M.r, y1: y(0), y2: y(0) }));
  let d = '', pen = false;
  points.forEach((p, k) => {
    if (mode === 'missing' && p.missing) { pen = false; return; }
    const v = p.missing ? -200 : p.value;
    d += `${pen ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
  });
  svg.append(el('path', { class: 'series-ref', d }));
  const marks = el('g');
  points.forEach((p, k) => {
    if (!p.missing) return;
    if (mode === 'recorded') marks.append(el('circle', { class: 'pt-missing', cx: x(k), cy: y(-200), r: 3.2 }));
    else marks.append(el('line', { class: 'rug-missing', x1: x(k), x2: x(k), y1: H - M.b - 1, y2: H - M.b - 9 }));
  });
  svg.append(marks);
}

/** Share of hours at -200 for each hour of the day: amber bars for the student's window, teal outline for the year. */
export function hoursChart(svg, mine, year) {
  frame(svg, 'Share of hours with CO(GT) missing, by hour of the day. Bars: your 14 days. Outlined bars: the whole year.');
  const top = Math.max(0.1, ...mine, ...year) * 1.1;
  const bw = (W - M.l - M.r) / 24;
  const y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  yAxis(svg, y, niceTicks(0, top, 4), 'share missing', (v) => `${Math.round(v * 100)} %`);
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  for (let h = 0; h < 24; h += 2) ax.append(el('text', { x: M.l + bw * (h + 0.5), y: H - M.b + 18, 'text-anchor': 'middle' }, String(h).padStart(2, '0')));
  ax.append(el('text', { class: 'ax-label', x: M.l + (W - M.l - M.r) / 2, y: H - 6, 'text-anchor': 'middle' }, 'hour of day (local time)'));
  svg.append(ax);
  mine.forEach((v, h) => svg.append(el('rect', { class: 'bar-effect', x: M.l + bw * h + bw * 0.22, y: y(v), width: bw * 0.56, height: Math.max(0, H - M.b - y(v)) })));
  year.forEach((v, h) => svg.append(el('rect', { class: 'bar-ref', x: M.l + bw * h + bw * 0.12, y: y(v), width: bw * 0.76, height: Math.max(0, H - M.b - y(v)) })));
}

/** Daily mean CO(GT): filled teal = reported, open = below the minimum number of valid hours. */
export function dailyChart(svg, days) {
  frame(svg, 'Daily mean CO(GT). Filled points are days with enough valid hours to report; open points are days below the minimum; dashed squares are days with no valid hour.');
  const vals = days.filter((d) => Number.isFinite(d.mean)).map((d) => d.mean);
  const top = Math.max(1, ...vals) * 1.15;
  const step = (W - M.l - M.r) / days.length;
  const y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  yAxis(svg, y, niceTicks(0, top, 4), 'daily mean CO, mg/m³');
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  days.forEach((d, k) => {
    const cx = M.l + step * (k + 0.5);
    if (k % 2 === 0) ax.append(el('text', { x: cx, y: H - M.b + 18, 'text-anchor': 'middle' }, `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`));
    if (!Number.isFinite(d.mean)) {
      svg.append(el('rect', { class: 'day-empty', x: cx - 5, y: H - M.b - 12, width: 10, height: 10 }));
      svg.append(el('text', { class: 'ax-label', x: cx, y: H - M.b - 18, 'text-anchor': 'middle' }, '0h'));
      return;
    }
    svg.append(el('circle', { class: d.reported ? 'day-reported' : 'day-dropped', cx, cy: y(d.mean), r: 5.5 }));
    svg.append(el('text', { class: 'ax-label', x: cx, y: y(d.mean) - 10, 'text-anchor': 'middle' }, `${d.valid}h`));
  });
  svg.append(ax);
}

/** Lab 02 · benzene over 14 days with gaps. Sand bands mark missing hours. Before the reveal the teal line
 * is the record as received (it breaks at gaps). After the reveal the teal line is the true record and the
 * amber line shows what a fill method put into the gaps. */
export function gapChart(svg, t, obs, gaps, { truth = null, filled = null, unit = 'µg/m³' } = {}) {
  const n = t.length;
  const vals = (truth || obs).filter((v) => Number.isFinite(v));
  const top = Math.max(1, ...vals, ...(filled || []).filter((v) => Number.isFinite(v))) * 1.08;
  const x = (k) => M.l + (k / Math.max(1, n - 1)) * (W - M.l - M.r);
  const y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  frame(svg, truth
    ? 'Benzene over 14 days. Teal line: the true record. Amber line: the values the chosen method put into the missing hours. Shaded bands: missing hours.'
    : 'Benzene over 14 days as received. The line breaks at missing hours, shown as shaded bands.');
  const miss = new Set(gaps);
  const bands = el('g');
  for (let k = 0; k < n; k++) {
    if (!miss.has(k) || miss.has(k - 1)) continue;
    let j = k; while (miss.has(j + 1)) j++;
    const half = (W - M.l - M.r) / (n - 1) / 2;
    bands.append(el('rect', { class: 'threshold-band', x: x(k) - half, y: M.t, width: x(j) - x(k) + 2 * half, height: H - M.t - M.b }));
  }
  svg.append(bands);
  yAxis(svg, y, niceTicks(0, top, 5), `benzene, ${unit}`);
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  t.forEach((s, k) => {
    if (s.hour !== 0) return;
    ax.append(el('line', { x1: x(k), x2: x(k), y1: H - M.b, y2: H - M.b + 5 }));
    if (k + 24 <= n) ax.append(el('text', { x: x(k + 12), y: H - M.b + 18, 'text-anchor': 'middle' }, `${s.day.slice(8, 10)}/${s.day.slice(5, 7)}`));
  });
  svg.append(ax);
  const line = (xs, keep) => {
    let d = '', pen = false;
    xs.forEach((v, k) => {
      if (!Number.isFinite(v) || !keep(k)) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
    });
    return d;
  };
  svg.append(el('path', { class: 'series-ref', d: line(truth || obs, () => true) }));
  if (filled) {
    // draw each filled run joined to its observed neighbours, so the amber segment shows the bridge
    const show = (k) => miss.has(k) || miss.has(k - 1) || miss.has(k + 1);
    svg.append(el('path', { class: 'series-effect', d: line(filled, show) }));
  }
}

/** Lab 03 · benzene record with numbered candidate hours. Optional: the second sensor scaled to benzene units
 * (dashed graphite), a smoothed series (amber), and after the reveal each marker filled amber (fault) or
 * outlined teal (real). */
export function spikeChart(svg, t, y, { marks = [], sensor = null, smoothed = null, reveal = false, from = 0, to = null, unit = 'µg/m³' } = {}) {
  const end = to ?? t.length - 1, n = end - from + 1;
  const range = (xs) => xs.slice(from, end + 1).filter((v) => Number.isFinite(v));
  const top = Math.max(1, ...range(y), ...(sensor ? range(sensor) : []), ...(smoothed ? range(smoothed) : [])) * 1.1;
  const lo = Math.min(0, ...(sensor ? range(sensor) : [0]));
  const x = (k) => M.l + ((k - from) / Math.max(1, n - 1)) * (W - M.l - M.r);
  const yy = (v) => M.t + (1 - (v - lo) / (top - lo)) * (H - M.t - M.b);
  frame(svg, smoothed ? 'Benzene over the window: teal, the record; amber, the rolling mean.'
    : `Benzene over the window with ${marks.length} numbered hours to judge${sensor ? '; dashed line: the second sensor, scaled to benzene units' : ''}.`);
  yAxis(svg, yy, niceTicks(lo, top, 5), `benzene, ${unit}`);
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  for (let k = from; k <= end; k++) {
    if (t[k].hour !== 0) continue;
    ax.append(el('line', { x1: x(k), x2: x(k), y1: H - M.b, y2: H - M.b + 5 }));
    if (k + 12 <= end) ax.append(el('text', { x: x(k + 12), y: H - M.b + 18, 'text-anchor': 'middle' }, `${t[k].day.slice(8, 10)}/${t[k].day.slice(5, 7)}`));
  }
  svg.append(ax);
  const line = (xs) => {
    let d = '', pen = false;
    for (let k = from; k <= end; k++) {
      if (!Number.isFinite(xs[k])) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(k).toFixed(1)},${yy(xs[k]).toFixed(1)}`; pen = true;
    }
    return d;
  };
  if (sensor) svg.append(el('path', { class: 'series-sensor', d: line(sensor) }));
  svg.append(el('path', { class: 'series-ref', d: line(y) }));
  if (smoothed) svg.append(el('path', { class: 'series-effect', d: line(smoothed) }));
  const g = el('g');
  for (const m of marks) {
    if (m.i < from || m.i > end) continue;
    const cls = reveal ? (m.fault ? 'mark-fault' : 'mark-real') : 'mark-open';
    g.append(el('circle', { class: cls, cx: x(m.i), cy: yy(y[m.i]), r: 9 }));
    g.append(el('text', { class: `mark-n ${cls}-n`, x: x(m.i), y: yy(y[m.i]) + 4, 'text-anchor': 'middle' }, String(m.n)));
  }
  svg.append(g);
}

/** Lab 04 · two monthly summaries. mode 'bars': bars from `base`; 'dots': mean as a dot with the
 * interquartile range (thick) and the 10th to 90th percentile (thin), on an axis from zero. */
export function monthFigure(svg, items, { mode = 'bars', base = 0, report = false, unit = 'µg/m³' } = {}) {
  const top = Math.max(...items.map((d) => (mode === 'dots' ? d.p90 : d.mean))) * 1.12;
  const lo = mode === 'bars' ? base : 0;
  const y = (v) => M.t + (1 - (v - lo) / (top - lo)) * (H - M.t - M.b);
  frame(svg, mode === 'bars'
    ? `Bar chart of the monthly mean benzene, axis starting at ${lo}.`
    : 'Monthly mean benzene as dots, with the middle half of the hours (thick line) and the 10th to 90th percentile (thin line), axis from zero.');
  yAxis(svg, y, niceTicks(lo, top, 5).filter((v) => v >= lo), `mean benzene, ${unit}`);
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  const slot = (W - M.l - M.r) / items.length;
  items.forEach((d, k) => {
    const cx = M.l + slot * (k + 0.5), cls = k ? 'bar-effect' : 'bar-solid-ref';
    ax.append(el('text', { x: cx, y: H - M.b + 20, 'text-anchor': 'middle' }, d.label));
    if (mode === 'bars') {
      svg.append(el('rect', { class: cls, x: cx - slot * 0.22, y: y(d.mean), width: slot * 0.44, height: Math.max(0, H - M.b - y(d.mean)) }));
      svg.append(el('text', { class: 'bar-label', x: cx, y: y(d.mean) - 8, 'text-anchor': 'middle' }, d.mean.toFixed(1)));
    } else {
      svg.append(el('line', { class: `whisk ${k ? 'eff' : 'ref'}`, x1: cx, x2: cx, y1: y(d.p10), y2: y(d.p90) }));
      svg.append(el('line', { class: `iqr ${k ? 'eff' : 'ref'}`, x1: cx, x2: cx, y1: y(d.q1), y2: y(d.q3) }));
      svg.append(el('circle', { class: k ? 'pt-eff' : 'pt-ref', cx, cy: y(d.mean), r: 8 }));
      svg.append(el('text', { class: 'bar-label', x: cx + 16, y: y(d.mean) + 5 }, d.mean.toFixed(1)));
    }
  });
  if (report) svg.append(el('text', { class: 'report-tag', x: W - M.r, y: M.t + 12, 'text-anchor': 'end' }, 'figure as published in the report'));
  svg.append(ax);
}

/** Lab 04 · share of hours per bin for two months: teal outline (lower month), amber fill (higher month). */
export function histChart(svg, a, b, w, labels, unit = 'µg/m³') {
  const n = a.length, top = Math.max(...a, ...b) * 1.12;
  frame(svg, `Share of hours in ${w}-${unit} bins. Amber bars: ${labels[1]}. Teal outlines: ${labels[0]}.`);
  const x = (v) => M.l + (v / (n * w)) * (W - M.l - M.r), y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  yAxis(svg, y, niceTicks(0, top, 4), 'share of hours', (v) => `${Math.round(v * 100)} %`);
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  for (const v of niceTicks(0, n * w, 8)) ax.append(el('text', { x: x(v), y: H - M.b + 18, 'text-anchor': 'middle' }, String(v)));
  ax.append(el('text', { class: 'ax-label', x: M.l + (W - M.l - M.r) / 2, y: H - 6, 'text-anchor': 'middle' }, `benzene, ${unit}`));
  svg.append(ax);
  b.forEach((v, k) => svg.append(el('rect', { class: 'bar-effect', x: x(k * w) + 1, y: y(v), width: Math.max(1, x(w) - x(0) - 2), height: H - M.b - y(v) })));
  a.forEach((v, k) => svg.append(el('rect', { class: 'bar-ref', x: x(k * w) + 1, y: y(v), width: Math.max(1, x(w) - x(0) - 2), height: H - M.b - y(v) })));
}

/** Lab 04 · daily means for the year (teal points), the chosen window shaded, and its trend line (amber). */
export function trendChart(svg, days, fit, from, to, unit = 'µg/m³') {
  const n = days.length, vals = days.filter((d) => Number.isFinite(d.mean)).map((d) => d.mean), top = Math.max(...vals) * 1.08;
  frame(svg, 'Daily mean benzene, April 2004 to March 2005, with a straight line fitted to the chosen months.');
  const x = (k) => M.l + (k / (n - 1)) * (W - M.l - M.r), y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  const k0 = days.findIndex((d) => d.month >= from), k1 = days.length - 1 - [...days].reverse().findIndex((d) => d.month <= to);
  svg.append(el('rect', { class: 'threshold-band', x: x(k0), y: M.t, width: x(k1) - x(k0), height: H - M.t - M.b }));
  yAxis(svg, y, niceTicks(0, top, 5), `daily mean, ${unit}`);
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  days.forEach((d, k) => { if (d.day.endsWith('-01')) { ax.append(el('line', { x1: x(k), x2: x(k), y1: H - M.b, y2: H - M.b + 5 })); ax.append(el('text', { x: x(k + 15), y: H - M.b + 18, 'text-anchor': 'middle' }, d.day.slice(5, 7) + '/' + d.day.slice(2, 4))); } });
  svg.append(ax);
  const g = el('g');
  days.forEach((d, k) => { if (Number.isFinite(d.mean)) g.append(el('circle', { class: 'pt-ref-small', cx: x(k), cy: y(d.mean), r: 2.6 })); });
  svg.append(g);
  svg.append(el('line', { class: 'trend-line', x1: x(fit.x0), x2: x(fit.x1), y1: y(fit.intercept + fit.slope * fit.x0), y2: y(fit.intercept + fit.slope * fit.x1) }));
}

/** Lab 05 · two daily series on their own scales (each drawn as z-scores), with dashed seasonal trends. */
export function pairSeries(svg, days, a, b, ta, tb, labels) {
  const z = (xs) => { const v = xs.filter(Number.isFinite), m = v.reduce((s, x) => s + x, 0) / v.length, sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)); return [(x) => (x - m) / sd]; };
  const [za] = z(a), [zb] = z(b), n = days.length;
  frame(svg, `${labels[0]} (amber) and ${labels[1]} (teal), daily, each scaled to its own mean and spread, with dashed 29-day trends.`);
  const x = (k) => M.l + (k / (n - 1)) * (W - M.l - M.r), y = (v) => M.t + (1 - (v + 3) / 6) * (H - M.t - M.b);
  yAxis(svg, y, [-2, 0, 2], 'standard deviations from mean', (v) => (v > 0 ? `+${v}` : String(v)));
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  days.forEach((d, k) => { if (d.endsWith('-01')) ax.append(el('text', { x: x(k), y: H - M.b + 18, 'text-anchor': 'middle' }, `1/${d.slice(5, 7)}`)); });
  svg.append(ax);
  const line = (xs, f, cls) => { let d = '', pen = false; xs.forEach((v, k) => { if (!Number.isFinite(v)) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(k).toFixed(1)},${y(Math.max(-3, Math.min(3, f(v)))).toFixed(1)}`; pen = true; }); svg.append(el('path', { class: cls, d })); };
  line(b, zb, 'series-ref'); line(a, za, 'series-effect');
  line(tb, zb, 'trend-ref'); line(ta, za, 'trend-eff');
}

/** Lab 05 · scatter of two series with their r. Points coloured by position in the window (sequential teal). */
export function scatter(svg, xs, ys, labels, r) {
  const p = xs.map((v, i) => [v, ys[i], i]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const lo = (v) => Math.min(...v), hi = (v) => Math.max(...v), ax0 = lo(p.map((q) => q[0])), ax1 = hi(p.map((q) => q[0])), ay0 = lo(p.map((q) => q[1])), ay1 = hi(p.map((q) => q[1]));
  const padx = (ax1 - ax0) * 0.06 || 1, pady = (ay1 - ay0) * 0.08 || 1;
  frame(svg, `Scatter of ${labels[1]} against ${labels[0]}; r = ${r.toFixed(2)}. Darker points are later in the window.`);
  const x = (v) => M.l + ((v - ax0 + padx) / (ax1 - ax0 + 2 * padx)) * (W - M.l - M.r), y = (v) => M.t + (1 - (v - ay0 + pady) / (ay1 - ay0 + 2 * pady)) * (H - M.t - M.b);
  yAxis(svg, y, niceTicks(ay0 - pady, ay1 + pady, 5), labels[1], (v) => String(+v.toFixed(2)));
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  for (const v of niceTicks(ax0 - padx, ax1 + padx, 6)) ax.append(el('text', { x: x(v), y: H - M.b + 18, 'text-anchor': 'middle' }, String(+v.toFixed(2))));
  ax.append(el('text', { class: 'ax-label', x: M.l + (W - M.l - M.r) / 2, y: H - 6, 'text-anchor': 'middle' }, labels[0]));
  svg.append(ax);
  const n = Math.max(...p.map((q) => q[2])) || 1, ramp = ['#C7E3E1', '#8CC5C1', '#4E9E99', '#0F6E6B', '#08403E'];
  for (const [a, b, i] of p) svg.append(el('circle', { cx: x(a), cy: y(b), r: 4.5, fill: ramp[Math.min(4, Math.floor((i / n) * 5))], stroke: '#1C242B', 'stroke-width': 0.4 }));
  svg.append(el('text', { class: 'bar-label', x: W - M.r - 6, y: M.t + 16, 'text-anchor': 'end' }, `r = ${r.toFixed(2).replace('-', '−')}`));
}

/** Lab 05 · daily mean residual of the calibrated sensor. Sand band: calibration days. Dashed: mean ± 3 sigma.
 * Vertical marks: the student's guess (graphite), the CUSUM onset and alarm (amber), the 3-sigma alarm (rust). */
export function driftChart(svg, days, daily, mu, sigma, marks = {}) {
  const n = days.length, v = daily.filter(Number.isFinite), top = Math.max(...v, mu + 3.5 * sigma), bot = Math.min(...v, mu - 3.5 * sigma);
  frame(svg, 'Daily mean difference between benzene and the calibrated sensor, over 16 weeks.');
  const x = (k) => M.l + ((k + 0.5) / n) * (W - M.l - M.r), y = (val) => M.t + (1 - (val - bot) / (top - bot)) * (H - M.t - M.b);
  svg.append(el('rect', { class: 'threshold-band', x: M.l, y: M.t, width: x(13.5) - M.l, height: H - M.t - M.b }));
  yAxis(svg, y, niceTicks(bot, top, 5), 'residual, µg/m³', (q) => String(+q.toFixed(1)));
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  days.forEach((d, k) => { if (k % 14 === 0) ax.append(el('text', { x: x(k), y: H - M.b + 18, 'text-anchor': 'middle' }, `${d.slice(8, 10)}/${d.slice(5, 7)}`)); });
  svg.append(ax);
  for (const lvl of [mu - 3 * sigma, mu + 3 * sigma]) svg.append(el('line', { class: 'limit-line', x1: M.l, x2: W - M.r, y1: y(lvl), y2: y(lvl) }));
  svg.append(el('line', { class: 'zero-line', x1: M.l, x2: W - M.r, y1: y(mu), y2: y(mu) }));
  const ms = [[marks.guess, 'mk-guess', 'your guess'], [marks.onset, 'mk-onset', 'CUSUM: start'], [marks.alarm, 'mk-alarm', 'CUSUM alarm'], [marks.thr, 'mk-thr', '3σ alarm']]
    .filter((m) => Number.isInteger(m[0])).map((m, i) => ({ k: m[0], cls: m[1], label: m[2], dy: 12 + 14 * i }));
  for (const m of ms) svg.append(el('line', { class: m.cls, x1: x(m.k), x2: x(m.k), y1: M.t, y2: H - M.b }));
  // Labels of lines that sit close together start to the right of the rightmost line in the group.
  for (const m of ms) { const near = ms.filter((o) => Math.abs(x(o.k) - x(m.k)) < 60).map((o) => x(o.k)); svg.append(el('text', { class: `${m.cls}-t`, x: Math.max(...near) + 5, y: M.t + m.dy }, m.label)); }
  daily.forEach((val, k) => { if (Number.isFinite(val)) svg.append(el('circle', { class: k < 14 ? 'pt-ref' : 'pt-ref-small', cx: x(k), cy: y(val), r: k < 14 ? 3.5 : 3 })); });
}

/** Lab 05 · the two CUSUM sums and the decision limit h. */
export function cusumChart(svg, days, up, down, Hs) {
  const n = days.length, top = Math.max(Hs * 1.3, ...up, ...down);
  frame(svg, 'CUSUM sums: amber for upward drift, teal for downward drift; dashed line: the decision limit.');
  const x = (k) => M.l + ((k + 0.5) / n) * (W - M.l - M.r), y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  yAxis(svg, y, niceTicks(0, top, 4), 'CUSUM, µg/m³', (q) => String(+q.toFixed(1)));
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  days.forEach((d, k) => { if (k % 14 === 0) ax.append(el('text', { x: x(k), y: H - M.b + 18, 'text-anchor': 'middle' }, `${d.slice(8, 10)}/${d.slice(5, 7)}`)); });
  svg.append(ax);
  svg.append(el('line', { class: 'limit-line', x1: M.l, x2: W - M.r, y1: y(Hs), y2: y(Hs) }));
  const line = (xs, cls) => svg.append(el('path', { class: cls, d: xs.map((v, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join('') }));
  line(down, 'series-ref'); line(up, 'series-effect');
}

/** Lab 06 · 14 days before and after a change. Thin line: hourly values. Points: daily means.
 * Teal: before; amber: after. Horizontal lines: the mean of the daily means on each side. */
export function shiftChart(svg, r, { showDaily = true, showHourly = true } = {}) {
  const n = r.days.length, hours = [...r.hourlyBefore, ...r.hourlyAfter], daily = [...r.dailyBefore, ...r.dailyAfter];
  const top = Math.max(...hours.filter(Number.isFinite), 5) * 1.05;
  frame(svg, `Benzene ${r.w} days before and after the change on ${r.day}. Hourly values as a thin line, daily means as points, the mean of each side as a horizontal line.`);
  const xh = (j) => M.l + (j / (n * 24)) * (W - M.l - M.r), xd = (k) => xh(k * 24 + 12), y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  yAxis(svg, y, niceTicks(0, top, 5), 'benzene, µg/m³', (v) => String(v));
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  const step = n > 30 ? 14 : 7;
  for (let k = 0; k <= n; k += step) { const d = r.days[Math.min(k, n - 1)]; if (k < n) ax.append(el('text', { x: xh(k * 24), y: H - M.b + 18, 'text-anchor': 'middle' }, `${d.slice(8, 10)}/${d.slice(5, 7)}`)); }
  svg.append(ax);
  if (showHourly) for (const [from, to, cls] of [[0, r.w * 24, '#0F6E6B'], [r.w * 24, n * 24, '#E29A2D']]) {
    let d = '', pen = false;
    for (let j = from; j < to; j++) { const v = hours[j]; if (!Number.isFinite(v)) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${xh(j).toFixed(1)},${y(v).toFixed(1)}`; pen = true; }
    svg.append(el('path', { d, fill: 'none', stroke: cls, 'stroke-width': 1, opacity: showDaily ? 0.35 : 0.8 }));
  }
  svg.append(el('line', { x1: xh(r.w * 24), x2: xh(r.w * 24), y1: M.t, y2: H - M.b, stroke: '#333F4A', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
  svg.append(el('text', { class: 'bar-label', x: xh(r.w * 24) + 6, y: M.t + 14 }, 'change'));
  if (showDaily) {
    const mB = r.daily.meanBefore, mA = r.daily.meanAfter;
    svg.append(el('line', { x1: M.l, x2: xh(r.w * 24), y1: y(mB), y2: y(mB), stroke: '#0F6E6B', 'stroke-width': 2.5 }));
    svg.append(el('line', { x1: xh(r.w * 24), x2: W - M.r, y1: y(mA), y2: y(mA), stroke: '#E29A2D', 'stroke-width': 2.5 }));
    daily.forEach((v, k) => { if (Number.isFinite(v)) svg.append(el('circle', { cx: xd(k), cy: y(v), r: 4.5, fill: k < r.w ? '#0F6E6B' : '#E29A2D', stroke: '#fff', 'stroke-width': 1 })); });
  }
}

/** Lab 06 · before/after differences at every placebo date (histogram, 0.5 µg/m³ bins).
 * Bars at least as far from zero as the student's difference are amber; the student's difference is a dashed line. */
export function placeboChart(svg, list, diff) {
  const bw = 0.5, ds = list.map((r) => r.diff), lo = Math.floor(Math.min(...ds, diff) / bw) * bw, hi = Math.ceil(Math.max(...ds, diff) / bw) * bw + bw;
  const nb = Math.round((hi - lo) / bw), counts = new Array(nb).fill(0);
  for (const d of ds) counts[Math.min(nb - 1, Math.floor((d - lo) / bw))]++;
  const top = Math.max(...counts) * 1.12;
  frame(svg, `Before/after differences at ${list.length} dates with no planned change. Amber bars are at least as far from zero as your difference, ${diff.toFixed(2)}.`);
  const x = (v) => M.l + ((v - lo) / (hi - lo)) * (W - M.l - M.r), y = (c) => M.t + (1 - c / top) * (H - M.t - M.b);
  yAxis(svg, y, niceTicks(0, top, 4), 'number of dates', (v) => String(v));
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  for (const v of niceTicks(lo, hi, 8)) ax.append(el('text', { x: x(v), y: H - M.b + 18, 'text-anchor': 'middle' }, String(v).replace('-', '−')));
  ax.append(el('text', { class: 'ax-label', x: M.l + (W - M.l - M.r) / 2, y: H - 6, 'text-anchor': 'middle' }, 'mean after minus mean before, µg/m³'));
  svg.append(ax);
  counts.forEach((c, b) => {
    if (!c) return;
    const mid = lo + (b + 0.5) * bw, far = Math.abs(mid) >= Math.abs(diff) - bw / 2 + 1e-9 && Math.sign(mid) !== 0;
    svg.append(el('rect', { x: x(lo + b * bw) + 1, y: y(c), width: x(lo + bw) - x(lo) - 2, height: H - M.b - y(c), fill: far ? '#E29A2D' : '#B9C1C6' }));
  });
  for (const v of [diff, -diff]) svg.append(el('line', { x1: x(v), x2: x(v), y1: M.t, y2: H - M.b, stroke: v === diff ? '#1C242B' : '#66727C', 'stroke-width': v === diff ? 2.5 : 1.5, 'stroke-dasharray': '6 4' }));
  svg.append(el('text', { class: 'bar-label', x: x(diff) + (diff >= 0 ? 6 : -6), y: M.t + 14, 'text-anchor': diff >= 0 ? 'start' : 'end' }, `your date ${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(2)}`));
}

/** Lab 07 · correlation of sensor and analyzer for each shift of the analyzer timestamps.
 * Amber: the shift with the highest r. The plain merge (shift 0) is labelled. */
export function lagChart(svg, scan) {
  const best = scan.reduce((a, b) => (b.r > a.r ? b : a));
  frame(svg, `Correlation of sensor and analyzer for each number of hours added to the analyzer timestamps. Highest at ${best.shift} hours, r = ${best.r.toFixed(2)}.`);
  const n = scan.length, slot = (W - M.l - M.r) / n, y = (v) => M.t + (1 - v) * (H - M.t - M.b);
  yAxis(svg, y, [0, 0.25, 0.5, 0.75, 1], 'correlation r', (v) => String(v));
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  ax.append(el('text', { class: 'ax-label', x: M.l + (W - M.l - M.r) / 2, y: H - 6, 'text-anchor': 'middle' }, 'hours added to the analyzer timestamps'));
  svg.append(ax);
  scan.forEach((s, q) => {
    const x0 = M.l + slot * q + slot * 0.2, w = slot * 0.6, top = y(Math.max(0, s.r));
    svg.append(el('rect', { x: x0, y: top, width: w, height: H - M.b - top, fill: s === best ? '#E29A2D' : s.shift === 0 ? '#0F6E6B' : '#B9C1C6' }));
    svg.append(el('text', { class: 'bar-label', x: x0 + w / 2, y: top - 6, 'text-anchor': 'middle' }, s.r.toFixed(2)));
    ax.append(el('text', { x: x0 + w / 2, y: H - M.b + 18, 'text-anchor': 'middle' }, `${s.shift > 0 ? '+' : s.shift < 0 ? '−' : ''}${Math.abs(s.shift)}${s.shift === 0 ? ' (plain merge)' : ''}`));
  });
}

/** Lab 07 · weeks 2 to 4, hour by hour: analyzer (teal) and the calibrated sensor (amber), with the alert level.
 * Rust ticks along the top: hours above the level that the sensor missed. */
export function alertChart(svg, r, { limit = 15, margin = 0, from = 7 * 24 } = {}) {
  const t = r.truth.slice(from), p = r.pred.slice(from), n = t.length;
  const top = Math.max(30, ...t.filter(Number.isFinite), ...p.filter(Number.isFinite)) * 1.05;
  frame(svg, `Weeks 2 to 4, hourly: benzene from the analyzer and from the calibrated sensor, with the alert level ${limit} µg/m³.`);
  const x = (j) => M.l + (j / (n - 1)) * (W - M.l - M.r), y = (v) => M.t + 8 + (1 - Math.max(0, v) / top) * (H - M.t - M.b - 8);
  yAxis(svg, y, niceTicks(0, top, 5), 'benzene, µg/m³', (v) => String(v));
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  for (let d = 0; d < n / 24; d += 7) ax.append(el('text', { x: x(d * 24), y: H - M.b + 18, 'text-anchor': 'middle' }, `week ${2 + d / 7}`));
  svg.append(ax);
  const path = (v, stroke, w, op) => { let d = '', pen = false; v.forEach((q, j) => { if (!Number.isFinite(q)) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(j).toFixed(1)},${y(q).toFixed(1)}`; pen = true; }); svg.append(el('path', { d, fill: 'none', stroke, 'stroke-width': w, opacity: op })); };
  path(t, '#0F6E6B', 1.4, 0.9); path(p, '#E29A2D', 1.6, 0.95);
  svg.append(el('line', { x1: M.l, x2: W - M.r, y1: y(limit), y2: y(limit), stroke: '#333F4A', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }));
  svg.append(el('text', { class: 'bar-label', x: W - M.r - 4, y: y(limit) - 6, 'text-anchor': 'end' }, `alert level ${limit}`));
  if (margin) svg.append(el('line', { x1: M.l, x2: W - M.r, y1: y(limit - margin), y2: y(limit - margin), stroke: '#9a5f10', 'stroke-width': 1.2, 'stroke-dasharray': '2 3' }));
  t.forEach((q, j) => { if (Number.isFinite(q) && Number.isFinite(p[j]) && q > limit && !(p[j] > limit - margin)) svg.append(el('line', { x1: x(j), x2: x(j), y1: M.t - 2, y2: M.t + 6, stroke: '#BE654C', 'stroke-width': 2 })); });
}
