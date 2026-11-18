/** Lab 06 · page controller. Calculations are in shift-engine.js; charts in charts.js. */
import * as S from './shift-engine.js';
import { shiftChart, placeboChart } from './charts.js';
import { initStudentFields, readStudent, fillStudent, withStudent, studentFileName, downloadJson, downloadText, readJsonFile } from '/teaching/shared/labs-kit/submission.js';

const SCHEMA = 'skh-2105315-lab06-shift-v1';
const PAGE_VERSION = '2026.2';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (id) => { const t = ($(id)?.value || '').trim().replace(',', '.').replace('−', '-').replace('%', ''); const v = t === '' ? NaN : Number(t); return Number.isFinite(v) ? v : null; };
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const signed = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;
const ci = (c) => `${S.fmt(c[0])} to ${S.fmt(c[1])}`;

const state = { data: null, L: null, variant: null, r: null, csv: '', dailyRun: false, placeboRun: false, locked: false, enteredBefore: {}, ext: { w: null } };

initStudentFields({ storeKey: 'skh-2105315-student' });

/* ---------- Step 1 ---------- */
function setCase(kind, { quiet = false } = {}) {
  let variant;
  try { variant = S.makeVariant(state.L, kind, readStudent().studentId); }
  catch (error) { $('id-note').textContent = error.message; $('student-id').focus(); return false; }
  state.variant = variant;
  state.r = S.compare(state.L, variant.k);
  state.csv = S.toCsv(state.L, state.r);
  state.dailyRun = false; state.placeboRun = false; state.locked = false; state.enteredBefore = {}; state.ext = { w: null };
  for (const b of document.querySelectorAll('[data-case]')) b.setAttribute('aria-pressed', String(b.dataset.case === kind));
  if (!quiet) $('id-note').textContent = kind === 'student' ? 'Your own data set is loaded. Use it for the work you submit.' : '';
  const r = state.r;
  $('dataset-line').textContent = `${variant.label} · change on ${dm(r.day)} · ${dm(r.days[0])} to ${dm(r.days.at(-1))} · file: ${csvName()}`;
  for (const id of ['p-daily', 'p-rate']) $(id).disabled = false;
  shiftChart($('raw-chart'), r, { showDaily: false });
  const h = r.hourly;
  $('claim').textContent = `The consultant's result: mean benzene was ${Math.abs(h.diff).toFixed(2)} µg/m³ ${h.diff < 0 ? 'lower' : 'higher'} after the change (${h.nb + h.na} hourly values, Welch's t-test p = ${S.fmtP(h.p)}).`;
  renderNotebook();
  $('results').hidden = true; $('placebo-box').hidden = true;
  $('win-table').querySelector('tbody').innerHTML = '';
  for (const b of document.querySelectorAll('[data-w]')) b.setAttribute('aria-pressed', String(b.dataset.w === '14'));
  return true;
}
function csvName() { const v = state.variant; return v.kind === 'student' ? `benzene-hourly-${v.seedId}.csv` : `benzene-hourly-demo-${v.kind}.csv`; }

/* ---------- Step 5 ---------- */
function renderNotebook() {
  const ref = S.notebookReference(state.r);
  const keep = Object.fromEntries(ref.map((r) => [r.id, $(`nb-${r.id}`)?.value ?? '']));
  $('notebook-list').innerHTML = ref.map((r) => `<div class="notebook-item"><label for="nb-${r.id}">${esc(r.text)}</label><input id="nb-${r.id}" type="text" inputmode="decimal" autocomplete="off" value="${esc(keep[r.id])}"><p class="notebook-result" id="nb-${r.id}-result"></p></div>`).join('');
  for (const r of ref) $(`nb-${r.id}`).disabled = state.locked;
  $('locked-note').textContent = state.locked ? 'Locked when you tested the daily means. The submitted file records which numbers you entered before.' : 'Enter your numbers before you test the daily means. Doing so locks your numbers and your predictions.';
}
function notebookEntries() {
  return S.notebookReference(state.r).map((r) => {
    const text = ($(`nb-${r.id}`)?.value || '').trim(), value = num(`nb-${r.id}`);
    return { id: r.id, question: r.text, studentText: text, studentValue: value, reference: +r.value.toFixed(6), tolerance: r.tolerance,
      withinTolerance: value === null ? null : Math.abs(value - r.value) <= r.tolerance + 1e-9, enteredBeforeReveal: !!state.enteredBefore[r.id] };
  });
}
function showNotebookResults() {
  const ref = S.notebookReference(state.r);
  for (const n of notebookEntries()) {
    const r = ref.find((x) => x.id === n.id), out = $(`nb-${n.id}-result`), refText = r.value.toFixed(r.decimals).replace('-', '−');
    if (n.studentValue === null) { out.className = 'notebook-result'; out.textContent = `No number entered. The page gives ${refText}.`; }
    else if (n.withinTolerance) { out.className = 'notebook-result match'; out.textContent = `Matches the page (${refText}).`; }
    else { out.className = 'notebook-result miss'; out.textContent = `The page gives ${refText}. Find the line in your code that explains the difference.`; }
  }
}

/* ---------- Step 6 ---------- */
function runDaily() {
  for (const r of S.notebookReference(state.r)) state.enteredBefore[r.id] = ($(`nb-${r.id}`)?.value || '').trim() !== '';
  state.dailyRun = true; state.locked = true; $('p-daily').disabled = true; $('p-rate').disabled = true;
  renderNotebook(); showNotebookResults();
  const r = state.r, h = r.hourly, d = r.daily;
  shiftChart($('daily-chart'), r);
  $('results').hidden = false;
  $('test-table').querySelector('tbody').innerHTML =
    `<tr><td>Hourly values (the consultant)</td><td>${h.nb} + ${h.na}</td><td>${signed(h.diff)}</td><td>${ci(h.ci)}</td><td>${S.fmtP(h.p)}</td></tr>` +
    `<tr><td>Daily means</td><td>${d.nb} + ${d.na}</td><td>${signed(d.diff)}</td><td>${ci(d.ci)}</td><td>${S.fmtP(d.p)}</td></tr>`;
  const pred = $('p-daily').value;
  $('daily-readout').textContent = `With one value per day, p is ${S.fmtP(d.p)} (it was ${S.fmtP(h.p)}) and the 95 % interval is ${(d.ci[1] - d.ci[0]).toFixed(1)} µg/m³ wide instead of ${(h.ci[1] - h.ci[0]).toFixed(1)}. ` +
    `You predicted ${pred === '' ? 'nothing' : pred === 'yes' ? 'p below 0.05' : 'p of 0.05 or more'}. ` +
    (d.p < S.ALPHA ? 'The daily test also calls the change significant. Step 7 asks how often it does that when nothing changed.' : 'The daily means do not show a difference that the scatter between days cannot explain.');
  $('status').textContent = 'Step 6 done. Go on to the placebo dates in Step 7.';
}

/* ---------- Step 7 ---------- */
function runPlacebo() {
  state.placeboRun = true;
  const list = S.placebo(state.L), rt = S.rates(list), rk = S.rank(list, state.r.daily.diff), p = num('p-rate');
  placeboChart($('placebo-chart'), list, state.r.daily.diff);
  $('placebo-box').hidden = false;
  $('placebo-readout').textContent = `At ${rt.n} dates with no planned change, the hourly test gave p below 0.05 at ${S.pct(rt.hourly)} of them and the daily test at ${S.pct(rt.daily)}; a fair test would give about 5 %. You predicted ${p === null ? 'no value' : `${p} %`}. ` +
    `A difference as large as yours (${signed(state.r.daily.diff)} µg/m³) or larger occurred at ${rk.larger} of the ${rk.n} dates (${S.pct(rk.share)}).`;
  $('status').textContent = 'Step 7 done. Answer Step 8, then download your study.';
}

/* ---------- Step 9 ---------- */
function renderWindows(active) {
  state.ext.w = active;
  for (const b of document.querySelectorAll('[data-w]')) b.setAttribute('aria-pressed', String(Number(b.dataset.w) === active));
  const rows = S.WINDOWS.map((w) => {
    const list = S.placebo(state.L, w), rt = S.rates(list), mine = S.compare(state.L, state.r.k, w);
    const rk = mine ? S.rank(list, mine.daily.diff) : null;
    return `<tr${w === active ? ' class="chosen"' : ''}><td>${w}</td><td>${rt.n}</td><td>${S.pct(rt.hourly)}</td><td>${S.pct(rt.daily)}</td><td>${mine ? S.fmtP(mine.daily.p) : 'too few days'}</td><td>${rk ? S.pct(rk.share) : '–'}</td></tr>`;
  });
  $('win-table').querySelector('tbody').innerHTML = rows.join('');
}

/* ---------- Step 10 ---------- */
const answerIds = { 'p-doubt': 'question', 'ai-answer': 'aiCode', 'c-daily': 'dailyEager', 'c-claim': 'claim', 'e-window': 'extWindow' };
function questionText(id) { const box = $(id).closest('.concept-question'); return (box ? box.querySelector('h3') : document.querySelector(`label[for="${id}"]`))?.textContent.trim() ?? id; }

function makeRecord() {
  const r = state.r, list = state.placeboRun ? S.placebo(state.L) : null;
  return {
    schema: SCHEMA, course: '2105315', lab: 'Lab 06 · Did the change really shift the process?', pageVersion: PAGE_VERSION,
    savedAt: new Date().toISOString(), view: document.body.dataset.mode || 'core',
    dataset: { kind: state.variant.kind, seedId: state.variant.seedId, label: state.variant.label, changeDay: r.day,
      source: `UCI Air Quality, doi:${state.data.source.doi}, ${state.data.source.license}` },
    predictions: { dailyBelow05: $('p-daily').value, placeboRatePercent: ($('p-rate').value || '').trim() },
    results: state.dailyRun ? {
      hourly: { n: r.hourly.na + r.hourly.nb, diff: +r.hourly.diff.toFixed(6), p: r.hourly.p },
      daily: { n: r.daily.na + r.daily.nb, diff: +r.daily.diff.toFixed(6), ci95: r.daily.ci.map((v) => +v.toFixed(6)), p: r.daily.p },
    } : null,
    placebo: list ? { ...S.rates(list), rank: S.rank(list, r.daily.diff) } : null,
    notebook: notebookEntries().map((n) => (state.dailyRun ? n : { id: n.id, question: n.question, studentText: n.studentText })),
    answers: Object.fromEntries(Object.entries(answerIds).map(([id, key]) => [key, { question: questionText(id), answer: $(id).value }])),
    extension: state.ext,
  };
}

function exportStudy() {
  if (!state.r) return;
  const student = readStudent();
  downloadJson(withStudent(makeRecord()), studentFileName('2105315-lab06-shift.json'));
  const warn = state.variant.kind !== 'student' ? ' This file uses a demo data set; load My data set for the work you submit.'
    : student.studentId.replace(/\s+/g, '') !== state.variant.seedId ? ' The student ID in your details differs from the ID that chose this data set.' : '';
  $('status').textContent = `Study downloaded.${warn}`;
}

async function openStudy(file) {
  let rec;
  try { rec = await readJsonFile(file); } catch (error) { $('status').textContent = error.message; return; }
  if (rec?.schema !== SCHEMA) { $('status').textContent = 'This file is not a Lab 06 study. Choose the file this page downloaded.'; return; }
  if (rec.student) fillStudent(rec.student);
  const kind = rec.dataset?.kind;
  if (kind === 'student' && rec.dataset.seedId) $('student-id').value = rec.dataset.seedId;
  if (!setCase(kind, { quiet: true })) return;
  if (rec.student) fillStudent(rec.student);
  $('p-daily').value = rec.predictions?.dailyBelow05 ?? '';
  $('p-rate').value = rec.predictions?.placeboRatePercent ?? '';
  for (const n of rec.notebook || []) if ($(`nb-${n.id}`)) $(`nb-${n.id}`).value = n.studentText ?? '';
  for (const [id, key] of Object.entries(answerIds)) if (typeof rec.answers?.[key]?.answer === 'string') $(id).value = rec.answers[key].answer;
  if (rec.results) { runDaily(); for (const n of rec.notebook || []) state.enteredBefore[n.id] = !!n.enteredBeforeReveal; }
  if (rec.placebo) runPlacebo();
  if (S.WINDOWS.includes(rec.extension?.w)) renderWindows(rec.extension.w);
  $('status').textContent = `Study reopened: ${state.variant.label}.`;
}

/* ---------- wiring ---------- */
async function start() {
  try {
    const response = await fetch(new URL('./data/airquality.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.L = S.load(state.data);
  } catch (error) { $('dataset-line').textContent = `The station record did not load (${error.message}). Reload the page.`; return; }
  for (const b of document.querySelectorAll('[data-case]')) b.addEventListener('click', () => setCase(b.dataset.case));
  $('download-csv').addEventListener('click', () => downloadText(state.csv, csvName()));
  $('run-daily').addEventListener('click', runDaily);
  $('run-placebo').addEventListener('click', runPlacebo);
  for (const b of document.querySelectorAll('[data-w]')) b.addEventListener('click', () => renderWindows(Number(b.dataset.w)));
  $('export-study').addEventListener('click', exportStudy);
  $('import-study').addEventListener('change', (e) => { openStudy(e.target.files?.[0]); e.target.value = ''; });
  $('student-id').addEventListener('input', () => {
    if (state.variant?.kind === 'student') $('id-note').textContent = 'You changed your ID. Press My data set again to load the matching data set.';
  });
  setCase('a', { quiet: true });
  for (const id of ['run-daily', 'run-placebo', 'export-study']) $(id).disabled = false;
}
start();
