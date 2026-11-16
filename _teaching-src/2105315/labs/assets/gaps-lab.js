/** Lab 02 · page controller. Calculations are in gaps-engine.js; charts in charts.js. */
import * as G from './gaps-engine.js';
import { gapChart } from './charts.js';
import { initStudentFields, readStudent, fillStudent, withStudent, studentFileName, downloadJson, downloadText, readJsonFile } from '/teaching/shared/labs-kit/submission.js';

const SCHEMA = 'skh-2105315-lab02-gaps-v1';
const PAGE_VERSION = '2026.2';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PRED = ['scattered', 'daily', 'outage'];

const state = {
  data: null, starts: null, variant: null, s: null, gaps: null, csv: '',
  view: 'combined', cmp: 'outage', method: 'linear', revealed: false,
  notebookLocked: false, enteredBeforeReveal: {}, predictLocked: false,
  ext: { byvalueRun: false, maxGapRun: false },
};

initStudentFields({ storeKey: 'skh-2105315-student' });

/* ---------- Step 1 ---------- */
function setCase(kind, { quiet = false } = {}) {
  let variant;
  try { variant = G.makeVariant(state.data, kind, readStudent().studentId, state.starts); }
  catch (error) { $('id-note').textContent = error.message; $('student-id').focus(); return false; }
  state.variant = variant;
  state.s = G.series(state.data, variant);
  state.gaps = G.gapPatterns(variant, state.s);
  state.csv = G.toCsv(state.s, state.gaps.combined);
  state.revealed = false; state.notebookLocked = false; state.predictLocked = false; state.enteredBeforeReveal = {};
  state.ext = { byvalueRun: false, maxGapRun: false };
  for (const b of document.querySelectorAll('[data-case]')) b.setAttribute('aria-pressed', String(b.dataset.case === kind));
  if (!quiet) $('id-note').textContent = kind === 'student' ? 'Your own data set is loaded. Use it for the work you submit.' : '';
  const t = state.s.t;
  $('dataset-line').textContent = `${variant.label} · ${t[0].iso.replace('T', ' ')} to ${t[t.length - 1].iso.replace('T', ' ')} · ${G.WINDOW_HOURS} hours · ${state.gaps.combined.length} missing in your file · file: ${csvName()}`;
  renderPredict();
  renderNotebook();
  drawGaps();
  $('results').hidden = true;
  $('byvalue-box').hidden = true; $('byvalue-readout').textContent = ''; $('maxgap-readout').textContent = '';
  return true;
}

function csvName() {
  const v = state.variant;
  return v.kind === 'student' ? `benzene-${v.seedId}.csv` : `benzene-demo-${v.kind}.csv`;
}

/* ---------- Step 2 ---------- */
function drawGaps() {
  const g = state.gaps[state.view];
  gapChart($('gap-chart'), state.s.t, G.withGaps(state.s.y, g), g);
  for (const b of document.querySelectorAll('[data-pattern]')) b.setAttribute('aria-pressed', String(b.dataset.pattern === state.view));
  const p = G.PATTERNS.find((x) => x.id === state.view);
  $('gap-caption').textContent = state.view === 'combined'
    ? `All three kinds of gap together: ${g.length} missing hours. This is the file you download in Step 5.`
    : `${p.label}: ${p.note}${state.view === 'outage' ? '' : `, ${g.length} missing hours`}. Shaded bands mark the gaps.`;
}

/* ---------- Step 3 ---------- */
function renderPredict() {
  const keep = Object.fromEntries(PRED.map((p) => [p, $(`pr-${p}`)?.value ?? '']));
  const opts = ['<option value="">Choose a method</option>', ...G.METHODS.map((m) => `<option value="${m.id}">${esc(m.label)}</option>`)].join('');
  $('predict-list').innerHTML = PRED.map((p) => {
    const pat = G.PATTERNS.find((x) => x.id === p);
    return `<div class="notebook-item"><label for="pr-${p}">${esc(pat.label)} <span class="case-sub">${esc(pat.note)}</span></label><select id="pr-${p}">${opts}</select></div>`;
  }).join('');
  for (const p of PRED) { $(`pr-${p}`).value = keep[p]; $(`pr-${p}`).disabled = state.predictLocked; }
}

const predictions = () => Object.fromEntries(PRED.map((p) => [p, $(`pr-${p}`)?.value || '']));

/* ---------- Step 5 ---------- */
function renderNotebook() {
  const ref = G.notebookReference(state.s, state.gaps.combined);
  const keep = Object.fromEntries(ref.map((r) => [r.id, $(`nb-${r.id}`)?.value ?? '']));
  $('notebook-list').innerHTML = ref.map((r) => `<div class="notebook-item"><label for="nb-${r.id}">${esc(r.text)}</label><input id="nb-${r.id}" type="text" inputmode="decimal" autocomplete="off" value="${esc(keep[r.id])}"><p class="notebook-result" id="nb-${r.id}-result"></p></div>`).join('');
  for (const r of ref) $(`nb-${r.id}`).disabled = state.notebookLocked;
  $('locked-note').textContent = state.notebookLocked
    ? 'Locked by the reveal. The submitted file records which numbers you entered before it.'
    : 'Enter your numbers before you reveal the truth. The reveal locks them and records whether you entered them first.';
}

function notebookEntries() {
  return G.notebookReference(state.s, state.gaps.combined).map((r) => {
    const text = ($(`nb-${r.id}`)?.value || '').trim(), raw = text.replace(',', '.');
    const value = raw === '' ? null : Number(raw);
    return { id: r.id, question: r.text, studentText: text, studentValue: Number.isFinite(value) ? value : null,
      reference: +r.value.toFixed(6), tolerance: r.tolerance,
      withinTolerance: Number.isFinite(value) ? Math.abs(value - r.value) <= r.tolerance + 1e-9 : null,
      enteredBeforeReveal: !!state.enteredBeforeReveal[r.id] };
  });
}

function showNotebookResults() {
  const ref = G.notebookReference(state.s, state.gaps.combined);
  for (const n of notebookEntries()) {
    const r = ref.find((x) => x.id === n.id), out = $(`nb-${n.id}-result`), refText = r.value.toFixed(r.decimals);
    if (n.studentValue === null) { out.className = 'notebook-result'; out.textContent = `No number entered. The page gives ${refText}.`; }
    else if (n.withinTolerance) { out.className = 'notebook-result match'; out.textContent = `Matches the page (${refText}).`; }
    else { out.className = 'notebook-result miss'; out.textContent = `The page gives ${refText}. Find the line in your code that explains the difference.`; }
  }
}

/* ---------- Step 6 ---------- */
function reveal() {
  for (const r of G.notebookReference(state.s, state.gaps.combined)) state.enteredBeforeReveal[r.id] = ($(`nb-${r.id}`)?.value || '').trim() !== '';
  state.revealed = true; state.notebookLocked = true; state.predictLocked = true;
  renderNotebook(); showNotebookResults(); renderPredict();
  const truth = G.answers(state.s.y, state.s.t.map((x) => x.day));
  $('result-lead').textContent = `True record: two-week mean ${G.fmt(truth.mean)} ${G.UNIT}, typical daily peak ${G.fmt(truth.dailyMax)} ${G.UNIT}. Compare each method with these numbers.`;
  drawCompare();
  showVerdicts();
  $('results').hidden = false;
  $('status').textContent = 'Truth revealed. Answer Step 7, then download your study.';
}

function methodRows(c, onClick) {
  return c.rows.map((r) => `<tr data-method="${r.id}" class="${onClick && r.id === state.method ? 'chosen' : ''}"${onClick ? ' tabindex="0"' : ''}>
    <td>${esc(r.label)}${r.unfilled ? `<br><span class="case-sub">${r.unfilled} hours left missing</span>` : ''}</td>
    <td>${G.fmt(r.mean)}</td><td class="${r.best_mean ? 'best' : ''}">${G.signed(r.err.mean)}</td>
    <td>${G.fmt(r.dailyMax)}</td><td class="${r.best_dailyMax ? 'best' : ''}">${G.signed(r.err.dailyMax)}</td></tr>`).join('');
}

function drawCompare() {
  const c = G.compare(state.s, state.gaps[state.cmp]);
  for (const b of document.querySelectorAll('[data-cmp]')) b.setAttribute('aria-pressed', String(b.dataset.cmp === state.cmp));
  $('method-body').innerHTML = methodRows(c, true);
  for (const tr of $('method-body').querySelectorAll('tr')) {
    const pick = () => { state.method = tr.dataset.method; drawCompare(); };
    tr.addEventListener('click', pick);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  }
  const row = c.rows.find((r) => r.id === state.method);
  gapChart($('fill-chart'), state.s.t, G.withGaps(state.s.y, state.gaps[state.cmp]), state.gaps[state.cmp], { truth: state.s.y, filled: row.filled });
  const pat = G.PATTERNS.find((x) => x.id === state.cmp);
  $('fill-caption').textContent = `${pat.label}, ${row.label.toLowerCase()}. Teal: the true record. Amber: what the method put into the gaps.${row.unfilled ? ` ${row.unfilled} hours could not be filled: no other day has a value at that hour.` : ''}`;
}

function showVerdicts() {
  const pred = predictions();
  $('predict-verdicts').innerHTML = PRED.map((p) => {
    const c = G.compare(state.s, state.gaps[p]), pat = G.PATTERNS.find((x) => x.id === p);
    const best = c.rows.filter((r) => r.best_overall).map((r) => r.label.toLowerCase());
    const chose = c.rows.find((r) => r.id === pred[p]);
    const ok = chose ? chose.best_overall : false;
    const errs = (r) => `mean ${G.signed(r.err.mean)}, daily peak ${G.signed(r.err.dailyMax)}`;
    const said = chose ? `You chose ${chose.label.toLowerCase()} (${errs(chose)}).` : 'You made no prediction.';
    return `<li class="${ok ? 'agree' : 'disagree'}"><p class="flag-verdict"><strong>${esc(pat.label)}:</strong> closest on both answers: ${esc(best.join(', '))}. ${esc(said)}</p></li>`;
  }).join('');
}

/* ---------- Step 8 ---------- */
function runByValue() {
  const c = G.compare(state.s, state.gaps.byvalue);
  $('byvalue-body').innerHTML = methodRows(c, false);
  $('byvalue-box').hidden = false;
  const best = c.rows.reduce((a, r) => (Math.abs(r.err.mean) < Math.abs(a.err.mean) ? r : a));
  state.ext.byvalueRun = true;
  state.ext.byvalue = { truthMean: +c.truth.mean.toFixed(4), smallestMeanError: +best.err.mean.toFixed(4), method: best.id };
  $('byvalue-readout').textContent = `Every method ends below the true mean of ${G.fmt(c.truth.mean)} ${G.UNIT}. The smallest error is ${G.signed(best.err.mean)} (${best.label.toLowerCase()}).`;
}

function runMaxGap() {
  const L = Number($('max-gap').value), days = state.s.t.map((x) => x.day);
  const a = G.answers(G.fillShortGaps(G.withGaps(state.s.y, state.gaps.combined), L), days), truth = G.answers(state.s.y, days);
  const filled = state.gaps.combined.length - a.unfilled;
  state.ext.maxGapRun = true;
  state.ext.maxGap = { maxGapHours: L, filledHours: filled, missingHours: a.unfilled, mean: +a.mean.toFixed(4), meanError: +(a.mean - truth.mean).toFixed(4), dailyMax: +a.dailyMax.toFixed(4), dailyMaxError: +(a.dailyMax - truth.dailyMax).toFixed(4) };
  $('maxgap-readout').textContent = `Gaps up to ${L} h filled: ${filled} hours filled, ${a.unfilled} left missing. Two-week mean ${G.fmt(a.mean)} (error ${G.signed(a.mean - truth.mean)}); typical daily peak ${G.fmt(a.dailyMax)} (error ${G.signed(a.dailyMax - truth.dailyMax)}).`;
}

/* ---------- Step 9 ---------- */
const answerIds = { 'p-reason': 'outageChoice', 'ai-answer': 'aiCode', 'c-mean': 'meanFill', 'c-linear': 'linearReach', 'e-byvalue': 'extByValue', 'e-maxgap': 'extMaxGap' };
function questionText(id) {
  const box = $(id).closest('.concept-question');
  return (box ? box.querySelector('h3') : document.querySelector(`label[for="${id}"]`))?.textContent.trim() ?? id;
}

function makeRecord() {
  const days = state.s.t.map((x) => x.day), truth = G.answers(state.s.y, days);
  const pred = predictions();
  return {
    schema: SCHEMA, course: '2105315', lab: 'Lab 02 · Which gap-filling method biases the answer least?', pageVersion: PAGE_VERSION,
    savedAt: new Date().toISOString(), view: document.body.dataset.mode || 'core',
    dataset: { kind: state.variant.kind, seedId: state.variant.seedId, label: state.variant.label, startIndex: state.variant.startIndex,
      start: state.s.t[0].iso, hours: G.WINDOW_HOURS, column: G.COLUMN, gapsInFile: state.gaps.combined.length,
      source: `UCI Air Quality, doi:${state.data.source.doi}, ${state.data.source.license}` },
    predictions: PRED.map((p) => {
      const out = { pattern: p, method: pred[p] };
      if (state.revealed) { const c = G.compare(state.s, state.gaps[p]); const r = c.rows.find((x) => x.id === pred[p]); out.closest = c.rows.filter((x) => x.best_overall).map((x) => x.id); out.correct = r ? !!r.best_overall : false; }
      return out;
    }),
    revealed: state.revealed,
    comparison: state.revealed ? {
      truth: { mean: +truth.mean.toFixed(6), dailyMax: +truth.dailyMax.toFixed(6) },
      patterns: Object.fromEntries(PRED.map((p) => [p, G.compare(state.s, state.gaps[p]).rows.map((r) => ({ method: r.id, mean: +r.mean.toFixed(6), meanError: +r.err.mean.toFixed(6), dailyMax: +r.dailyMax.toFixed(6), dailyMaxError: +r.err.dailyMax.toFixed(6), unfilled: r.unfilled }))])),
    } : null,
    notebook: notebookEntries().map((n) => (state.revealed ? n : { id: n.id, question: n.question, studentText: n.studentText })),
    answers: Object.fromEntries(Object.entries(answerIds).map(([id, key]) => [key, { question: questionText(id), answer: $(id).value }])),
    extension: { ...state.ext, maxGapSetting: Number($('max-gap').value) },
  };
}

function exportStudy() {
  if (!state.s) return;
  const student = readStudent();
  downloadJson(withStudent(makeRecord()), studentFileName('2105315-lab02-gaps.json'));
  const warn = state.variant.kind !== 'student' ? ' This file uses a demo data set; load My data set for the work you submit.'
    : student.studentId.replace(/\s+/g, '') !== state.variant.seedId ? ' The student ID in your details differs from the ID that chose this data set.' : '';
  $('status').textContent = `Study downloaded.${warn}`;
}

async function openStudy(file) {
  let rec;
  try { rec = await readJsonFile(file); }
  catch (error) { $('status').textContent = error.message; return; }
  if (rec?.schema !== SCHEMA) { $('status').textContent = 'This file is not a Lab 02 study. Choose the file this page downloaded.'; return; }
  if (rec.student) fillStudent(rec.student);
  const kind = rec.dataset?.kind;
  if (kind === 'student' && rec.dataset.seedId) $('student-id').value = rec.dataset.seedId;
  if (!setCase(kind, { quiet: true })) return;
  if (rec.student) fillStudent(rec.student);
  for (const p of rec.predictions || []) if ($(`pr-${p.pattern}`)) $(`pr-${p.pattern}`).value = p.method || '';
  for (const n of rec.notebook || []) if ($(`nb-${n.id}`)) $(`nb-${n.id}`).value = n.studentText ?? '';
  for (const [id, key] of Object.entries(answerIds)) if (typeof rec.answers?.[key]?.answer === 'string') $(id).value = rec.answers[key].answer;
  if (Number.isFinite(rec.extension?.maxGapSetting)) { $('max-gap').value = rec.extension.maxGapSetting; $('max-gap-out').textContent = `${rec.extension.maxGapSetting} h`; }
  if (rec.revealed) {
    reveal();
    for (const n of rec.notebook || []) state.enteredBeforeReveal[n.id] = !!n.enteredBeforeReveal;
  }
  if (rec.extension?.byvalueRun) runByValue();
  if (rec.extension?.maxGapRun) runMaxGap();
  $('status').textContent = `Study reopened: ${state.variant.label}${rec.revealed ? ', comparison restored' : ''}.`;
}

/* ---------- wiring ---------- */
async function start() {
  try {
    const response = await fetch(new URL('./data/airquality.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.starts = G.completeStarts(state.data);
  } catch (error) {
    $('dataset-line').textContent = `The station record did not load (${error.message}). Reload the page.`;
    return;
  }
  for (const b of document.querySelectorAll('[data-case]')) b.addEventListener('click', () => setCase(b.dataset.case));
  for (const b of document.querySelectorAll('[data-pattern]')) b.addEventListener('click', () => { state.view = b.dataset.pattern; drawGaps(); });
  for (const b of document.querySelectorAll('[data-cmp]')) b.addEventListener('click', () => { state.cmp = b.dataset.cmp; drawCompare(); });
  $('download-csv').addEventListener('click', () => downloadText(state.csv, csvName()));
  $('run-reveal').addEventListener('click', reveal);
  $('run-byvalue').addEventListener('click', runByValue);
  $('run-maxgap').addEventListener('click', runMaxGap);
  $('max-gap').addEventListener('input', () => { $('max-gap-out').textContent = `${$('max-gap').value} h`; if (state.ext.maxGapRun) runMaxGap(); });
  $('export-study').addEventListener('click', exportStudy);
  $('import-study').addEventListener('change', (e) => { openStudy(e.target.files?.[0]); e.target.value = ''; });
  $('student-id').addEventListener('input', () => {
    if (state.variant?.kind === 'student' && $('student-id').value.replace(/\s+/g, '') !== state.variant.seedId) $('id-note').textContent = 'Your ID changed. Press My data set to load the data set for this ID.';
  });
  setCase('spring');
  for (const id of ['run-reveal', 'run-byvalue', 'run-maxgap', 'export-study']) $(id).disabled = false;
}

start();
