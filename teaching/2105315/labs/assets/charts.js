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
  yAxis(svg, y, ticks, 'CO(GT) / mg m⁻³');
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
  yAxis(svg, y, niceTicks(0, top, 4), 'share missing', (v) => `${Math.round(v * 100)}%`);
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
  yAxis(svg, y, niceTicks(0, top, 4), 'daily mean CO / mg m⁻³');
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
export function gapChart(svg, t, obs, gaps, { truth = null, filled = null, unit = 'µg m⁻³' } = {}) {
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
  yAxis(svg, y, niceTicks(0, top, 5), `benzene / ${unit}`);
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
export function spikeChart(svg, t, y, { marks = [], sensor = null, smoothed = null, reveal = false, from = 0, to = null, unit = 'µg m⁻³' } = {}) {
  const end = to ?? t.length - 1, n = end - from + 1;
  const range = (xs) => xs.slice(from, end + 1).filter((v) => Number.isFinite(v));
  const top = Math.max(1, ...range(y), ...(sensor ? range(sensor) : []), ...(smoothed ? range(smoothed) : [])) * 1.1;
  const lo = Math.min(0, ...(sensor ? range(sensor) : [0]));
  const x = (k) => M.l + ((k - from) / Math.max(1, n - 1)) * (W - M.l - M.r);
  const yy = (v) => M.t + (1 - (v - lo) / (top - lo)) * (H - M.t - M.b);
  frame(svg, smoothed ? 'Benzene over the window: teal, the record; amber, the rolling mean.'
    : `Benzene over the window with ${marks.length} numbered hours to judge${sensor ? '; dashed line: the second sensor, scaled to benzene units' : ''}.`);
  yAxis(svg, yy, niceTicks(lo, top, 5), `benzene / ${unit}`);
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
export function monthFigure(svg, items, { mode = 'bars', base = 0, report = false, unit = 'µg m⁻³' } = {}) {
  const top = Math.max(...items.map((d) => (mode === 'dots' ? d.p90 : d.mean))) * 1.12;
  const lo = mode === 'bars' ? base : 0;
  const y = (v) => M.t + (1 - (v - lo) / (top - lo)) * (H - M.t - M.b);
  frame(svg, mode === 'bars'
    ? `Bar chart of the monthly mean benzene, axis starting at ${lo}.`
    : 'Monthly mean benzene as dots, with the middle half of the hours (thick line) and the 10th to 90th percentile (thin line), axis from zero.');
  yAxis(svg, y, niceTicks(lo, top, 5).filter((v) => v >= lo), `mean benzene / ${unit}`);
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
export function histChart(svg, a, b, w, labels, unit = 'µg m⁻³') {
  const n = a.length, top = Math.max(...a, ...b) * 1.12;
  frame(svg, `Share of hours in ${w}-${unit} bins. Amber bars: ${labels[1]}. Teal outlines: ${labels[0]}.`);
  const x = (v) => M.l + (v / (n * w)) * (W - M.l - M.r), y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  yAxis(svg, y, niceTicks(0, top, 4), 'share of hours', (v) => `${Math.round(v * 100)}%`);
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  for (const v of niceTicks(0, n * w, 8)) ax.append(el('text', { x: x(v), y: H - M.b + 18, 'text-anchor': 'middle' }, String(v)));
  ax.append(el('text', { class: 'ax-label', x: M.l + (W - M.l - M.r) / 2, y: H - 6, 'text-anchor': 'middle' }, `benzene / ${unit}`));
  svg.append(ax);
  b.forEach((v, k) => svg.append(el('rect', { class: 'bar-effect', x: x(k * w) + 1, y: y(v), width: Math.max(1, x(w) - x(0) - 2), height: H - M.b - y(v) })));
  a.forEach((v, k) => svg.append(el('rect', { class: 'bar-ref', x: x(k * w) + 1, y: y(v), width: Math.max(1, x(w) - x(0) - 2), height: H - M.b - y(v) })));
}

/** Lab 04 · daily means for the year (teal points), the chosen window shaded, and its trend line (amber). */
export function trendChart(svg, days, fit, from, to, unit = 'µg m⁻³') {
  const n = days.length, vals = days.filter((d) => Number.isFinite(d.mean)).map((d) => d.mean), top = Math.max(...vals) * 1.08;
  frame(svg, 'Daily mean benzene, April 2004 to March 2005, with a straight line fitted to the chosen months.');
  const x = (k) => M.l + (k / (n - 1)) * (W - M.l - M.r), y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  const k0 = days.findIndex((d) => d.month >= from), k1 = days.length - 1 - [...days].reverse().findIndex((d) => d.month <= to);
  svg.append(el('rect', { class: 'threshold-band', x: x(k0), y: M.t, width: x(k1) - x(k0), height: H - M.t - M.b }));
  yAxis(svg, y, niceTicks(0, top, 5), `daily mean / ${unit}`);
  const ax = el('g', { class: 'ax' });
  ax.append(el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
  days.forEach((d, k) => { if (d.day.endsWith('-01')) { ax.append(el('line', { x1: x(k), x2: x(k), y1: H - M.b, y2: H - M.b + 5 })); ax.append(el('text', { x: x(k + 15), y: H - M.b + 18, 'text-anchor': 'middle' }, d.day.slice(5, 7) + '/' + d.day.slice(2, 4))); } });
  svg.append(ax);
  const g = el('g');
  days.forEach((d, k) => { if (Number.isFinite(d.mean)) g.append(el('circle', { class: 'pt-ref-small', cx: x(k), cy: y(d.mean), r: 2.6 })); });
  svg.append(g);
  svg.append(el('line', { class: 'trend-line', x1: x(fit.x0), x2: x(fit.x1), y1: y(fit.intercept + fit.slope * fit.x0), y2: y(fit.intercept + fit.slope * fit.x1) }));
}
