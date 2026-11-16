/** Lab 05 · page controller. Calculations are in relations-engine.js; charts in charts.js. */
import * as R from './relations-engine.js';
import { scatter, pairSeries, driftChart, cusumChart } from './charts.js';
import { initStudentFields, readStudent, fillStudent, withStudent, studentFileName, downloadJson, downloadText, readJsonFile } from '/teaching/shared/labs-kit/submission.js';

const SCHEMA = 'skh-2105315-lab05-relations-v1';
const PAGE_VERSION = '2026.2';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (id) => { const t = ($(id)?.value || '').trim().replace(',', '.').replace('−', '-'); const v = t === '' ? NaN : Number(t); return Number.isFinite(v) ? v : null; };
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

const state = { data: null, L: null, variant: null, a: null, b: null, csv: '', detrended: false, cusumRun: false, locked: false, enteredBefore: {}, ext: { tuneRun: false } };

initStudentFields({ storeKey: 'skh-2105315-student' });

/* ---------- Step 1 ---------- */
function setCase(kind, { quiet = false } = {}) {
  let variant;
  try { variant = R.makeVariant(state.L, kind, readStudent().studentId); }
  catch (error) { $('id-note').textContent = error.message; $('student-id').focus(); return false; }
  state.variant = variant;
  state.a = R.partA(state.L.daily, state.L.cal, variant.dayA);
  state.b = R.partB(state.data, state.L.cal, variant.dayB);
  state.csv = R.toCsv(state.a);
  state.detrended = false; state.cusumRun = false; state.locked = false; state.enteredBefore = {}; state.ext = { tuneRun: false };
  for (const b of document.querySelectorAll('[data-case]')) b.setAttribute('aria-pressed', String(b.dataset.case === kind));
  if (!quiet) $('id-note').textContent = kind === 'student' ? 'Your own data set is loaded. Use it for the work you submit.' : '';
  $('dataset-line').textContent = `${variant.label} · Part A from ${dm(state.a.days[0])} (${state.a.raw.n} days with both) · Part B from ${dm(state.b.days[0])} · file: ${csvName()}`;
  $('p-r').disabled = false; $('p-onset').disabled = false;
  scatter($('scatter-raw'), state.a.temp, state.a.nox, ['daily mean temperature, °C', 'daily mean NOx, ppb'], state.a.raw.r);
  $('raw-caption').textContent = `As reported: r = ${R.fmt(state.a.raw.r)} over ${state.a.raw.n} days. Darker points are later in the window.`;
  renderNotebook();
  $('results').hidden = true;
  $('p-onset').innerHTML = '<option value="">Choose a day</option>' + state.b.days.map((d, k) => (k >= R.CAL_DAYS ? `<option value="${k}">${dm(d)} (day ${k + 1})</option>` : '')).join('');
  driftChart($('drift-chart'), state.b.days, state.b.daily, state.b.mu, state.b.sigma);
  $('cusum-box').hidden = true; $('tune-readout').textContent = '';
  return true;
}
function csvName() { const v = state.variant; return v.kind === 'student' ? `nox-temp-daily-${v.seedId}.csv` : `nox-temp-daily-demo-${v.kind}.csv`; }

/* ---------- Step 5 ---------- */
function renderNotebook() {
  const ref = R.notebookReference(state.a);
  const keep = Object.fromEntries(ref.map((r) => [r.id, $(`nb-${r.id}`)?.value ?? '']));
  $('notebook-list').innerHTML = ref.map((r) => `<div class="notebook-item"><label for="nb-${r.id}">${esc(r.text)}</label><input id="nb-${r.id}" type="text" inputmode="decimal" autocomplete="off" value="${esc(keep[r.id])}"><p class="notebook-result" id="nb-${r.id}-result"></p></div>`).join('');
  for (const r of ref) $(`nb-${r.id}`).disabled = state.locked;
  $('locked-note').textContent = state.locked ? 'Locked when you removed the trend. The submitted file records which numbers you entered before.' : 'Enter your numbers before you remove the trend. Doing so locks your numbers and your prediction.';
}
function notebookEntries() {
  return R.notebookReference(state.a).map((r) => {
    const text = ($(`nb-${r.id}`)?.value || '').trim(), value = num(`nb-${r.id}`);
    return { id: r.id, question: r.text, studentText: text, studentValue: value, reference: +r.value.toFixed(6), tolerance: r.tolerance,
      withinTolerance: value === null ? null : Math.abs(value - r.value) <= r.tolerance + 1e-9, enteredBeforeReveal: !!state.enteredBefore[r.id] };
  });
}
function showNotebookResults() {
  const ref = R.notebookReference(state.a);
  for (const n of notebookEntries()) {
    const r = ref.find((x) => x.id === n.id), out = $(`nb-${n.id}-result`), refText = r.value.toFixed(r.decimals).replace('-', '−');
    if (n.studentValue === null) { out.className = 'notebook-result'; out.textContent = `No number entered. The page gives ${refText}.`; }
    else if (n.withinTolerance) { out.className = 'notebook-result match'; out.textContent = `Matches the page (${refText}).`; }
    else { out.className = 'notebook-result miss'; out.textContent = `The page gives ${refText}. Find the line in your code that explains the difference.`; }
  }
}

/* ---------- Step 6 ---------- */
function detrend() {
  for (const r of R.notebookReference(state.a)) state.enteredBefore[r.id] = ($(`nb-${r.id}`)?.value || '').trim() !== '';
  state.detrended = true; state.locked = true; $('p-r').disabled = true;
  renderNotebook(); showNotebookResults();
  const a = state.a;
  pairSeries($('series-chart'), a.days, a.nox, a.temp, a.trendNox, a.trendTemp, ['NOx', 'temperature']);
  scatter($('scatter-a'), a.temp, a.nox, ['temperature, °C', 'NOx, ppb'], a.raw.r);
  scatter($('scatter-b'), a.detTemp, a.detNox, ['temperature minus trend, °C', 'NOx minus trend, ppb'], a.det.r);
  const p = num('p-r');
  $('detrend-readout').textContent = `r falls from ${R.fmt(a.raw.r)} to ${R.fmt(a.det.r)} (${a.det.n} days). You predicted ${p === null ? 'no value' : R.fmt(p)}. ` +
    (Math.abs(a.det.r) < 0.2 ? 'Most of the reported correlation came from the seasonal trend that both series share.' : 'Part of the correlation remains in the day-to-day changes; the trend explains the rest.');
  $('results').hidden = false;
  $('status').textContent = 'Part A done. Go on to Part B in Step 7.';
}

/* ---------- Step 7 ---------- */
function runCusum() {
  state.cusumRun = true; $('p-onset').disabled = true;
  const c = R.cusum(state.b), thr = R.threshold(state.b), guess = $('p-onset').value === '' ? null : Number($('p-onset').value);
  driftChart($('drift-chart'), state.b.days, state.b.daily, state.b.mu, state.b.sigma, { guess, onset: c.onset, alarm: c.alarm, thr });
  cusumChart($('cusum-chart'), state.b.days, c.up, c.down, c.H);
  $('cusum-box').hidden = false;
  const d = (k) => (k === null ? 'none in 16 weeks' : `${dm(state.b.days[k])} (day ${k + 1})`);
  $('cusum-readout').textContent = `CUSUM alarm: ${d(c.alarm)}${c.side ? `, sensor reading ${c.side === 'up' ? 'low' : 'high'} against benzene` : ''}; estimated start ${d(c.onset)}. 3σ rule: ${d(thr)}. Your guess: ${guess === null ? 'none' : d(guess)}.`;
  $('status').textContent = 'Part B done. Answer Step 8, then download your study.';
}

/* ---------- Step 9 ---------- */
function runTune() {
  const k = Number($('ck').value), h = Number($('ch').value), c = R.cusum(state.b, k, h);
  state.ext = { tuneRun: true, k, h, alarm: c.alarm, onset: c.onset };
  $('tune-readout').textContent = `k = ${k}σ, h = ${h}σ: alarm ${c.alarm === null ? 'none' : `${dm(state.b.days[c.alarm])} (day ${c.alarm + 1})`}, estimated start ${c.onset === null ? '–' : `day ${c.onset + 1}`}.`;
  driftChart($('drift-chart'), state.b.days, state.b.daily, state.b.mu, state.b.sigma, { onset: c.onset, alarm: c.alarm, thr: R.threshold(state.b) });
}

/* ---------- Step 10 ---------- */
const answerIds = { 'p-third': 'thirdVariable', 'ai-answer': 'aiCode', 'c-effect': 'noEffect', 'c-cusum': 'cusumEarlier', 'e-tune': 'extTune' };
function questionText(id) { const box = $(id).closest('.concept-question'); return (box ? box.querySelector('h3') : document.querySelector(`label[for="${id}"]`))?.textContent.trim() ?? id; }

function makeRecord() {
  const c = R.cusum(state.b), guess = $('p-onset').value === '' ? null : Number($('p-onset').value);
  return {
    schema: SCHEMA, course: '2105315', lab: 'Lab 05 · Correlated, or driven by a third variable?', pageVersion: PAGE_VERSION,
    savedAt: new Date().toISOString(), view: document.body.dataset.mode || 'core',
    dataset: { kind: state.variant.kind, seedId: state.variant.seedId, label: state.variant.label, partAStart: state.a.days[0], partBStart: state.b.days[0],
      source: `UCI Air Quality, doi:${state.data.source.doi}, ${state.data.source.license}` },
    predictions: { rAfterTrend: ($('p-r').value || '').trim(), onsetDay: guess },
    partA: state.detrended ? { rRaw: +state.a.raw.r.toFixed(6), rDetrended: +state.a.det.r.toFixed(6), days: state.a.raw.n } : null,
    partB: state.cusumRun ? { mu: +state.b.mu.toFixed(6), sigma: +state.b.sigma.toFixed(6), cusumAlarmDay: c.alarm, cusumSide: c.side, cusumOnsetDay: c.onset, threeSigmaDay: R.threshold(state.b), guessDay: guess } : null,
    notebook: notebookEntries().map((n) => (state.detrended ? n : { id: n.id, question: n.question, studentText: n.studentText })),
    answers: Object.fromEntries(Object.entries(answerIds).map(([id, key]) => [key, { question: questionText(id), answer: $(id).value }])),
    extension: state.ext,
  };
}

function exportStudy() {
  if (!state.a) return;
  const student = readStudent();
  downloadJson(withStudent(makeRecord()), studentFileName('2105315-lab05-relations.json'));
  const warn = state.variant.kind !== 'student' ? ' This file uses a demo data set; load My data set for the work you submit.'
    : student.studentId.replace(/\s+/g, '') !== state.variant.seedId ? ' The student ID in your details differs from the ID that chose this data set.' : '';
  $('status').textContent = `Study downloaded.${warn}`;
}

async function openStudy(file) {
  let rec;
  try { rec = await readJsonFile(file); } catch (error) { $('status').textContent = error.message; return; }
  if (rec?.schema !== SCHEMA) { $('status').textContent = 'This file is not a Lab 05 study. Choose the file this page downloaded.'; return; }
  if (rec.student) fillStudent(rec.student);
  const kind = rec.dataset?.kind;
  if (kind === 'student' && rec.dataset.seedId) $('student-id').value = rec.dataset.seedId;
  if (!setCase(kind, { quiet: true })) return;
  if (rec.student) fillStudent(rec.student);
  $('p-r').value = rec.predictions?.rAfterTrend ?? '';
  if (Number.isInteger(rec.predictions?.onsetDay)) $('p-onset').value = String(rec.predictions.onsetDay);
  for (const n of rec.notebook || []) if ($(`nb-${n.id}`)) $(`nb-${n.id}`).value = n.studentText ?? '';
  for (const [id, key] of Object.entries(answerIds)) if (typeof rec.answers?.[key]?.answer === 'string') $(id).value = rec.answers[key].answer;
  if (rec.partA) { detrend(); for (const n of rec.notebook || []) state.enteredBefore[n.id] = !!n.enteredBeforeReveal; }
  if (rec.partB) runCusum();
  if (rec.extension?.tuneRun) { $('ck').value = rec.extension.k; $('ch').value = rec.extension.h; $('ck-out').textContent = rec.extension.k; $('ch-out').textContent = rec.extension.h; runTune(); }
  $('status').textContent = `Study reopened: ${state.variant.label}.`;
}

/* ---------- wiring ---------- */
async function start() {
  try {
    const response = await fetch(new URL('./data/airquality.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.L = R.load(state.data);
  } catch (error) { $('dataset-line').textContent = `The station record did not load (${error.message}). Reload the page.`; return; }
  for (const b of document.querySelectorAll('[data-case]')) b.addEventListener('click', () => setCase(b.dataset.case));
  $('download-csv').addEventListener('click', () => downloadText(state.csv, csvName()));
  $('run-detrend').addEventListener('click', detrend);
  $('run-cusum').addEventListener('click', runCusum);
  $('run-tune').addEventListener('click', runTune);
  $('ck').addEventListener('input', () => { $('ck-out').textContent = $('ck').value; if (state.ext.tuneRun) runTune(); });
  $('ch').addEventListener('input', () => { $('ch-out').textContent = $('ch').value; if (state.ext.tuneRun) runTune(); });
  $('export-study').addEventListener('click', exportStudy);
  $('import-study').addEventListener('change', (e) => { openStudy(e.target.files?.[0]); e.target.value = ''; });
  $('student-id').addEventListener('input', () => {
    if (state.variant?.kind === 'student' && $('student-id').value.replace(/\s+/g, '') !== state.variant.seedId) $('id-note').textContent = 'Your ID changed. Press My data set to load the data set for this ID.';
  });
  setCase('a');
  for (const id of ['run-detrend', 'run-cusum', 'run-tune', 'export-study']) $(id).disabled = false;
}

start();
