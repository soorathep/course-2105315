/** Lab 04 · page controller. Calculations are in figures-engine.js; charts in charts.js. */
import * as F from './figures-engine.js';
import { monthFigure, histChart, trendChart } from './charts.js';
import { initStudentFields, readStudent, fillStudent, withStudent, studentFileName, downloadJson, downloadText, readJsonFile } from '/teaching/shared/labs-kit/submission.js';

const SCHEMA = 'skh-2105315-lab04-figures-v1';
const PAGE_VERSION = '2027.1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (id) => { const t = ($(id)?.value || '').trim().replace(',', '.'); const v = t === '' ? NaN : Number(t); return Number.isFinite(v) ? v : null; };
const PRED = ['p-looks', 'p-ratio', 'p-overlap'];

const state = {
  data: null, ms: null, byKey: null, days: null, variant: null, a: null, b: null, sa: null, sb: null, base: 0, csv: '',
  fig: 'zero', rebuilt: false, locked: false, enteredBeforeRebuild: {}, ext: { trendRun: false },
};

initStudentFields({ storeKey: 'skh-2105315-student' });

/* ---------- Step 1 ---------- */
function setCase(kind, { quiet = false } = {}) {
  let variant;
  try { variant = F.makeVariant(state.data, kind, readStudent().studentId, state.ms); }
  catch (error) { $('id-note').textContent = error.message; $('student-id').focus(); return false; }
  state.variant = variant;
  state.a = state.byKey[variant.low]; state.b = state.byKey[variant.high];
  state.sa = F.stats(state.a.y); state.sb = F.stats(state.b.y);
  state.base = F.reportBaseline(state.sa.mean, state.sb.mean);
  state.csv = F.toCsv(state.a, state.b);
  state.rebuilt = false; state.locked = false; state.enteredBeforeRebuild = {}; state.ext = { trendRun: false };
  for (const b of document.querySelectorAll('[data-case]')) b.setAttribute('aria-pressed', String(b.dataset.case === kind));
  if (!quiet) $('id-note').textContent = kind === 'student' ? 'Your own data set is loaded. Use it for the work you submit.' : '';
  $('dataset-line').textContent = `${variant.label} · ${state.a.label} and ${state.b.label} · ${state.sa.n + state.sb.n} valid hours · file: ${csvName()}`;
  for (const id of PRED) $(id).disabled = false;
  monthFigure($('report-chart'), items(), { mode: 'bars', base: state.base, report: true });
  $('report-caption').textContent = `As published: "Benzene was far worse in ${state.b.label} than in ${state.a.label}."`;
  renderNotebook();
  $('results').hidden = true;
  drawHist();
  $('trend-figure').hidden = true; $('trend-readout').textContent = '';
  return true;
}

function csvName() {
  const v = state.variant;
  return v.kind === 'student' ? `benzene-two-months-${v.seedId}.csv` : `benzene-two-months-demo-${v.kind}.csv`;
}
const items = () => [{ label: state.a.label, ...state.sa }, { label: state.b.label, ...state.sb }];

/* ---------- Step 5 ---------- */
function renderNotebook() {
  const ref = F.notebookReference(state.a, state.b);
  const keep = Object.fromEntries(ref.map((r) => [r.id, $(`nb-${r.id}`)?.value ?? '']));
  $('notebook-list').innerHTML = ref.map((r) => `<div class="notebook-item"><label for="nb-${r.id}">${esc(r.text)}</label><input id="nb-${r.id}" type="text" inputmode="decimal" autocomplete="off" value="${esc(keep[r.id])}"><p class="notebook-result" id="nb-${r.id}-result"></p></div>`).join('');
  for (const r of ref) $(`nb-${r.id}`).disabled = state.locked;
  $('locked-note').textContent = state.locked
    ? 'Locked when you rebuilt the figure. The submitted file records which numbers you entered before.'
    : 'Enter your numbers before you rebuild the figure. Rebuilding locks your numbers and your predictions.';
}

function notebookEntries() {
  return F.notebookReference(state.a, state.b).map((r) => {
    const text = ($(`nb-${r.id}`)?.value || '').trim(), value = num(`nb-${r.id}`);
    return { id: r.id, question: r.text, studentText: text, studentValue: value, reference: +r.value.toFixed(6), tolerance: r.tolerance,
      withinTolerance: value === null ? null : Math.abs(value - r.value) <= r.tolerance + 1e-9, enteredBeforeRebuild: !!state.enteredBeforeRebuild[r.id] };
  });
}

function showNotebookResults() {
  const ref = F.notebookReference(state.a, state.b);
  for (const n of notebookEntries()) {
    const r = ref.find((x) => x.id === n.id), out = $(`nb-${n.id}-result`), refText = r.value.toFixed(r.decimals);
    if (n.studentValue === null) { out.className = 'notebook-result'; out.textContent = `No number entered. The page gives ${refText}.`; }
    else if (n.withinTolerance) { out.className = 'notebook-result match'; out.textContent = `Matches the page (${refText}).`; }
    else { out.className = 'notebook-result miss'; out.textContent = `The page gives ${refText}. Find the line in your code that explains the difference.`; }
  }
}

/* ---------- Step 6 ---------- */
function rebuild() {
  for (const r of F.notebookReference(state.a, state.b)) state.enteredBeforeRebuild[r.id] = ($(`nb-${r.id}`)?.value || '').trim() !== '';
  state.rebuilt = true; state.locked = true;
  for (const id of PRED) $(id).disabled = true;
  renderNotebook(); showNotebookResults();
  drawFig();
  const looks = num('p-looks'), overlap = num('p-overlap');
  const seen = (state.sb.mean - state.base) / (state.sa.mean - state.base), below = F.shareBelow(state.b.y, state.sa.mean);
  $('pred-verdict').textContent = `By eye you read ${looks === null ? 'no number' : `${looks}×`}; the report's bars give ${seen.toFixed(1)}× and the data ${(state.sb.mean / state.sa.mean).toFixed(2)}×. ` +
    `You predicted ${overlap === null ? 'no share' : `${overlap} %`} of ${state.b.label}'s hours below the mean of ${state.a.label}; the data give ${Math.round(100 * below)} %.`;
  $('results').hidden = false;
  $('status').textContent = 'Figure rebuilt. Go on to Step 7, then download your study.';
}

function drawFig() {
  const mode = state.fig === 'dots' ? 'dots' : 'bars', base = state.fig === 'report' ? state.base : 0;
  monthFigure($('fig-chart'), items(), { mode, base, report: state.fig === 'report' });
  for (const b of document.querySelectorAll('[data-fig]')) b.setAttribute('aria-pressed', String(b.dataset.fig === state.fig));
  const a = state.sa.mean, b = state.sb.mean;
  const seen = mode === 'bars' ? (b - base) / (a - base) : b / a, lie = mode === 'bars' ? F.lieFactor(a, b, base) : 1;
  $('r-seen').textContent = `${seen.toFixed(2)}×`;
  $('r-data').textContent = `${(b / a).toFixed(2)}×`;
  $('r-lie').textContent = lie.toFixed(1);
  $('rg-seen').className = lie > 1.05 ? 'bad' : 'ok'; $('rg-lie').className = lie > 1.05 ? 'bad' : 'ok';
  $('fig-caption').textContent = state.fig === 'report' ? `Bars start at ${base} ${F.UNIT}. The reader compares lengths, so the cut-off bottom makes the difference look ${lie.toFixed(1)} times larger than it is.`
    : state.fig === 'zero' ? 'Bars start at zero, so lengths compare honestly.'
    : 'Points show the mean. Thick line: the middle half of the hours. Thin line: 10th to 90th percentile. The ranges overlap.';
}

/* ---------- Step 7 ---------- */
function drawHist() {
  const w = Number($('bin').value), top = Math.max(state.sa.max, state.sb.max);
  histChart($('hist-chart'), F.histogram(state.a.y, w, top), F.histogram(state.b.y, w, top), w, [state.a.label, state.b.label]);
  $('hist-caption').textContent = `Amber: ${state.b.label}. Teal outline: ${state.a.label}. Each bar is the share of that month's valid hours.`;
  $('stat-body').innerHTML = items().map((d) => `<tr><td>${esc(d.label)}</td><td>${d.n} of ${d.n + d.missing}</td><td>${F.fmt(d.mean)}</td><td>${F.fmt(d.median)}</td><td>${F.fmt(d.q1, 1)} to ${F.fmt(d.q3, 1)}</td><td>${Math.round(100 * d.above)} %</td></tr>`).join('');
}

/* ---------- Step 9 ---------- */
function fillMonths() {
  const opts = state.ms.map((m) => `<option value="${m.key}">${m.label}</option>`).join('');
  $('t-from').innerHTML = opts; $('t-to').innerHTML = opts;
  $('t-from').value = F.FIRST_MONTH; $('t-to').value = F.LAST_MONTH;
}
function runTrend() {
  let from = $('t-from').value, to = $('t-to').value;
  if (from > to) [from, to] = [to, from];
  if (from === to) { $('trend-readout').textContent = 'Choose at least two months.'; return; }
  const fit = F.trend(state.days, from, to);
  trendChart($('trend-chart'), state.days, fit, from, to);
  $('trend-figure').hidden = false;
  state.ext = { trendRun: true, trend: { from, to, days: fit.n, perThirtyDays: +fit.per30.toFixed(4) } };
  $('trend-readout').textContent = `${F.monthName(from)} to ${F.monthName(to)}: ${fit.n} days, trend ${fit.per30 >= 0 ? '+' : '−'}${Math.abs(fit.per30).toFixed(2)} ${F.UNIT} per 30 days.`;
}

/* ---------- Step 10 ---------- */
const answerIds = { 'p-claim': 'caption', 'ai-answer': 'aiCode', 'h-answer': 'distribution', 'c-zero': 'zeroBaseline', 'c-skew': 'meanMedian', 'e-trend': 'extTrend' };
function questionText(id) {
  const box = $(id).closest('.concept-question');
  return (box ? box.querySelector('h3') : document.querySelector(`label[for="${id}"]`))?.textContent.trim() ?? id;
}

function makeRecord() {
  const a = state.sa.mean, b = state.sb.mean;
  return {
    schema: SCHEMA, course: '2105315', lab: 'Lab 04 · Does this figure tell the truth about the process?', pageVersion: PAGE_VERSION,
    savedAt: new Date().toISOString(), view: document.body.dataset.mode || 'core',
    dataset: { kind: state.variant.kind, seedId: state.variant.seedId, label: state.variant.label, lowMonth: state.variant.low, highMonth: state.variant.high,
      column: F.COLUMN, source: `UCI Air Quality, doi:${state.data.source.doi}, ${state.data.source.license}` },
    predictions: Object.fromEntries(PRED.map((id) => [id.slice(2), { question: document.querySelector(`label[for="${id}"]`).textContent.trim(), answer: ($(id).value || '').trim() }])),
    rebuilt: state.rebuilt,
    figure: state.rebuilt ? { reportBaseline: state.base, seenRatio: +((b - state.base) / (a - state.base)).toFixed(4), dataRatio: +(b / a).toFixed(4),
      lieFactor: +F.lieFactor(a, b, state.base).toFixed(4), shareBelow: +F.shareBelow(state.b.y, a).toFixed(4) } : null,
    notebook: notebookEntries().map((n) => (state.rebuilt ? n : { id: n.id, question: n.question, studentText: n.studentText })),
    histogramBin: Number($('bin').value),
    answers: Object.fromEntries(Object.entries(answerIds).map(([id, key]) => [key, { question: questionText(id), answer: $(id).value }])),
    extension: state.ext,
  };
}

function exportStudy() {
  if (!state.a) return;
  const student = readStudent();
  downloadJson(withStudent(makeRecord()), studentFileName('2105315-lab04-figures.json'));
  const warn = state.variant.kind !== 'student' ? ' This file uses a demo data set; load My data set for the work you submit.'
    : student.studentId.replace(/\s+/g, '') !== state.variant.seedId ? ' The student ID in your details differs from the ID that chose this data set.' : '';
  $('status').textContent = `Study downloaded.${warn}`;
}

async function openStudy(file) {
  let rec;
  try { rec = await readJsonFile(file); }
  catch (error) { $('status').textContent = error.message; return; }
  if (rec?.schema !== SCHEMA) { $('status').textContent = 'This file is not a Lab 04 study. Choose the file this page downloaded.'; return; }
  if (rec.student) fillStudent(rec.student);
  const kind = rec.dataset?.kind;
  if (kind === 'student' && rec.dataset.seedId) $('student-id').value = rec.dataset.seedId;
  if (!setCase(kind, { quiet: true })) return;
  if (rec.student) fillStudent(rec.student);
  for (const id of PRED) if (typeof rec.predictions?.[id.slice(2)]?.answer === 'string') $(id).value = rec.predictions[id.slice(2)].answer;
  for (const n of rec.notebook || []) if ($(`nb-${n.id}`)) $(`nb-${n.id}`).value = n.studentText ?? '';
  for (const [id, key] of Object.entries(answerIds)) if (typeof rec.answers?.[key]?.answer === 'string') $(id).value = rec.answers[key].answer;
  if (Number.isFinite(rec.histogramBin)) { $('bin').value = rec.histogramBin; $('bin-out').textContent = `${rec.histogramBin} µg/m³`; drawHist(); }
  if (rec.rebuilt) {
    rebuild();
    for (const n of rec.notebook || []) state.enteredBeforeRebuild[n.id] = !!n.enteredBeforeRebuild;
  }
  if (rec.extension?.trendRun) { $('t-from').value = rec.extension.trend.from; $('t-to').value = rec.extension.trend.to; runTrend(); }
  $('status').textContent = `Study reopened: ${state.variant.label}${rec.rebuilt ? ', figure restored' : ''}.`;
}

/* ---------- wiring ---------- */
async function start() {
  try {
    const response = await fetch(new URL('./data/airquality.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.ms = F.months(state.data);
    state.byKey = Object.fromEntries(state.ms.map((m) => [m.key, m]));
    state.days = F.dailyMeans(state.ms);
  } catch (error) {
    $('dataset-line').textContent = `The station record did not load (${error.message}). Reload the page.`;
    return;
  }
  fillMonths();
  for (const b of document.querySelectorAll('[data-case]')) b.addEventListener('click', () => setCase(b.dataset.case));
  for (const b of document.querySelectorAll('[data-fig]')) b.addEventListener('click', () => { state.fig = b.dataset.fig; drawFig(); });
  $('bin').addEventListener('input', () => { $('bin-out').textContent = `${$('bin').value} µg/m³`; drawHist(); });
  $('download-csv').addEventListener('click', () => downloadText(state.csv, csvName()));
  $('run-rebuild').addEventListener('click', rebuild);
  $('run-trend').addEventListener('click', runTrend);
  for (const id of ['t-from', 't-to']) $(id).addEventListener('change', () => { if (state.ext.trendRun) runTrend(); });
  $('export-study').addEventListener('click', exportStudy);
  $('import-study').addEventListener('change', (e) => { openStudy(e.target.files?.[0]); e.target.value = ''; });
  $('student-id').addEventListener('input', () => {
    if (state.variant?.kind === 'student' && $('student-id').value.replace(/\s+/g, '') !== state.variant.seedId) $('id-note').textContent = 'Your ID changed. Press My data set to load the data set for this ID.';
  });
  setCase('spring');
  for (const id of ['run-rebuild', 'run-trend', 'export-study']) $(id).disabled = false;
}

start();
