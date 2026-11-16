/** Lab 07 · page controller. Calculations are in decision-engine.js; charts in charts.js. */
import * as D from './decision-engine.js';
import { lagChart, alertChart } from './charts.js';
import { initStudentFields, readStudent, fillStudent, withStudent, studentFileName, downloadJson, downloadText, readJsonFile } from '/teaching/shared/labs-kit/submission.js';

const SCHEMA = 'skh-2105315-lab07-decision-v1';
const PAGE_VERSION = '2027.1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (id) => { const t = ($(id)?.value || '').trim().replace(',', '.').replace('−', '-').replace('%', '').replace('+', ''); const v = t === '' ? NaN : Number(t); return Number.isFinite(v) ? v : null; };
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

const state = { data: null, L: null, variant: null, files: {}, aligned: null, naive: null, alignRun: false, testRun: false, view: 2, locked: false, enteredBefore: {}, ext: { margin: null } };

initStudentFields({ storeKey: 'skh-2105315-student' });

/* ---------- Step 1 and 2 ---------- */
function headTable(csv, n = 5) {
  const lines = csv.trim().split('\n').slice(0, n + 1).map((l) => l.split(','));
  return `<thead><tr>${lines[0].map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${lines.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}<tr><td colspan="2">… ${csv.trim().split('\n').length - 1} rows</td></tr></tbody>`;
}

function setCase(kind, { quiet = false } = {}) {
  let variant;
  try { variant = D.makeVariant(state.L, kind, readStudent().studentId); }
  catch (error) { $('id-note').textContent = error.message; $('student-id').focus(); return false; }
  state.variant = variant;
  state.files = { sensor: D.sensorCsv(state.L, variant), analyzer: D.analyzerCsv(state.L, variant) };
  state.aligned = D.analyse(state.L, variant.k, D.UTC_OFFSET); state.naive = D.analyse(state.L, variant.k, 0);
  state.alignRun = false; state.testRun = false; state.view = 2; state.locked = false; state.enteredBefore = {}; state.ext = { margin: null };
  for (const b of document.querySelectorAll('[data-case]')) b.setAttribute('aria-pressed', String(b.dataset.case === kind));
  if (!quiet) $('id-note').textContent = kind === 'student' ? 'Your own data set is loaded. Use it for the work you submit.' : '';
  const days = state.L.cal.slice(variant.k, variant.k + D.DAYS);
  $('dataset-line').textContent = `${variant.label} · ${dm(days[0].day)} to ${dm(days.at(-1).day)} · calibration week ${dm(days[0].day)} to ${dm(days[6].day)} · files: ${fileName('sensor')}, ${fileName('analyzer')}`;
  $('head-sensor').innerHTML = headTable(state.files.sensor);
  $('head-analyzer').innerHTML = headTable(state.files.analyzer);
  for (const id of ['p-pass', 'p-hit']) $(id).disabled = false;
  renderNotebook();
  $('align-box').hidden = true; $('test-box').hidden = true;
  $('decision').value = ''; $('margin').value = '0'; $('margin-out').textContent = '0';
  renderMargins(false);
  return true;
}
function fileName(which) { const v = state.variant; return `${which}-${v.kind === 'student' ? v.seedId : `demo-${v.kind}`}.csv`; }

/* ---------- Step 5 ---------- */
function renderNotebook() {
  const ref = D.notebookReference(state.L, state.variant);
  const keep = Object.fromEntries(ref.map((r) => [r.id, $(`nb-${r.id}`)?.value ?? '']));
  $('notebook-list').innerHTML = ref.map((r) => `<div class="notebook-item"><label for="nb-${r.id}">${esc(r.text)}</label><input id="nb-${r.id}" type="text" inputmode="decimal" autocomplete="off" value="${esc(keep[r.id])}"><p class="notebook-result" id="nb-${r.id}-result"></p></div>`).join('');
  for (const r of ref) $(`nb-${r.id}`).disabled = state.locked;
  $('locked-note').textContent = state.locked ? 'Locked when you audited and aligned the files. The submitted file records which numbers you entered before.' : 'Enter your numbers before you audit and align. Doing so locks your numbers and your predictions.';
}
function notebookEntries() {
  return D.notebookReference(state.L, state.variant).map((r) => {
    const text = ($(`nb-${r.id}`)?.value || '').trim(), value = num(`nb-${r.id}`);
    return { id: r.id, question: r.text, studentText: text, studentValue: value, reference: +r.value.toFixed(6), tolerance: r.tolerance,
      withinTolerance: value === null ? null : Math.abs(value - r.value) <= r.tolerance + 1e-9, enteredBeforeReveal: !!state.enteredBefore[r.id] };
  });
}
function showNotebookResults() {
  const ref = D.notebookReference(state.L, state.variant);
  for (const n of notebookEntries()) {
    const r = ref.find((x) => x.id === n.id), out = $(`nb-${n.id}-result`), refText = r.value.toFixed(r.decimals).replace('-', '−');
    if (n.studentValue === null) { out.className = 'notebook-result'; out.textContent = `No number entered. The page gives ${refText}.`; }
    else if (n.withinTolerance) { out.className = 'notebook-result match'; out.textContent = `Matches the page (${refText}).`; }
    else { out.className = 'notebook-result miss'; out.textContent = `The page gives ${refText}. Find the line in your code that explains the difference.`; }
  }
}

/* ---------- Step 6 ---------- */
function runAlign() {
  for (const r of D.notebookReference(state.L, state.variant)) state.enteredBefore[r.id] = ($(`nb-${r.id}`)?.value || '').trim() !== '';
  state.alignRun = true; state.locked = true; $('p-pass').disabled = true; $('p-hit').disabled = true;
  renderNotebook(); showNotebookResults();
  const a = D.audit(state.L, state.variant), scan = D.lagScan(state.L, state.variant.k), best = scan.reduce((x, y) => (y.r > x.r ? y : x)), plain = scan.find((s) => s.shift === 0);
  $('audit-table').querySelector('tbody').innerHTML =
    `<tr><td>Sensor (local time)</td><td>${a.sensorRows}</td><td>${a.duplicates}</td><td>${a.sensorMissing}</td><td>${a.firstSensor}</td></tr>` +
    `<tr><td>Analyzer (UTC)</td><td>${a.analyzerRows}</td><td>0</td><td>${a.analyzerMissing}</td><td>${a.firstAnalyzer}</td></tr>`;
  lagChart($('lag-chart'), scan);
  $('align-box').hidden = false;
  $('align-readout').textContent = `The analyzer's first row is stamped 2 hours before the sensor's: it is in UTC. The plain merge gives r = ${plain.r.toFixed(2)}; adding ${best.shift} hours gives r = ${best.r.toFixed(2)}. Three repeated sensor rows were removed; missing hours stay missing.`;
  $('status').textContent = 'Step 6 done. Calibrate and test in Step 7.';
}

/* ---------- Step 7 ---------- */
function resultRow(label, r) {
  const t = r.test;
  return `<tr><td>${label}</td><td>${D.fmt(r.cal.slope, 4)}</td><td>${t.above}</td><td>${t.hits}</td><td>${t.missed}</td><td>${t.falseAlarms}</td><td>${D.pct(t.hitRate)}</td></tr>`;
}
function showView(m) {
  state.view = m;
  for (const b of document.querySelectorAll('[data-m]')) b.setAttribute('aria-pressed', String(Number(b.dataset.m) === m));
  alertChart($('alert-chart'), m === 2 ? state.aligned : state.naive);
}
function runTest() {
  if (!state.alignRun) runAlign();
  state.testRun = true;
  const al = state.aligned.test, nv = state.naive.test, p = num('p-hit');
  $('result-table').querySelector('tbody').innerHTML = resultRow('Aligned files', state.aligned) + resultRow('Plain merge', state.naive);
  $('test-box').hidden = false; showView(2);
  $('test-readout').textContent = `Aligned, the sensor flags ${al.hits} of the ${al.above} hours above 15 µg/m³ (${D.pct(al.hitRate)}), with ${al.falseAlarms} false alarms. The plain merge would have reported ${D.pct(nv.hitRate)}. ` +
    `You predicted ${p === null ? 'no share' : `${p} %`}. The rule asks for 80 %: the sensor ${al.hitRate >= D.TARGET ? 'meets' : 'does not meet'} it.`;
  $('status').textContent = 'Step 7 done. Choose your decision, answer Step 8, then download your study.';
}

/* ---------- Step 9 ---------- */
function renderMargins(fromUser = true) {
  const m = Number($('margin').value); if (fromUser) state.ext.margin = m; $('margin-out').textContent = String(m);
  $('margin-table').querySelector('tbody').innerHTML = D.MARGINS.map((g) => {
    const r = D.analyse(state.L, state.variant.k, D.UTC_OFFSET, g);
    return `<tr${g === m ? ' class="chosen"' : ''}><td>${g}</td><td>${D.LIMIT - g} µg/m³</td><td>${D.pct(r.test.hitRate)}</td><td>${r.test.falseAlarms}</td></tr>`;
  }).join('');
  if (state.testRun) alertChart($('alert-chart'), state.view === 2 ? D.analyse(state.L, state.variant.k, D.UTC_OFFSET, m) : state.naive, { margin: state.view === 2 ? m : 0 });
}

/* ---------- Step 10 ---------- */
const answerIds = { 'p-check': 'firstChecks', 'ai-answer': 'aiCode', 'c-slope': 'slope', 'c-memo': 'memo', 'e-margin': 'extMargin' };
function questionText(id) { const box = $(id).closest('.concept-question'); return (box ? box.querySelector('h3') : document.querySelector(`label[for="${id}"]`))?.textContent.trim() ?? id; }
const brief = (r) => ({ slope: +r.cal.slope.toFixed(6), calHours: r.cal.n, ...r.test, hitRate: +r.test.hitRate.toFixed(6), rmse: +r.test.rmse.toFixed(6) });

function makeRecord() {
  const days = state.L.cal.slice(state.variant.k, state.variant.k + D.DAYS);
  return {
    schema: SCHEMA, course: '2105315', lab: 'Lab 07 · From raw file to a defended decision', pageVersion: PAGE_VERSION,
    savedAt: new Date().toISOString(), view: document.body.dataset.mode || 'core',
    dataset: { kind: state.variant.kind, seedId: state.variant.seedId, label: state.variant.label, firstDay: days[0].day, lastDay: days.at(-1).day,
      source: `UCI Air Quality, doi:${state.data.source.doi}, ${state.data.source.license}` },
    predictions: { meetsRule: $('p-pass').value, hitRatePercent: ($('p-hit').value || '').trim() },
    alignment: state.alignRun ? { audit: D.audit(state.L, state.variant), scan: D.lagScan(state.L, state.variant.k).map((s) => ({ shift: s.shift, r: +s.r.toFixed(6) })) } : null,
    results: state.testRun ? { aligned: brief(state.aligned), plainMerge: brief(state.naive), meetsRule: state.aligned.test.hitRate >= D.TARGET } : null,
    decision: $('decision').value,
    notebook: notebookEntries().map((n) => (state.alignRun ? n : { id: n.id, question: n.question, studentText: n.studentText })),
    answers: Object.fromEntries(Object.entries(answerIds).map(([id, key]) => [key, { question: questionText(id), answer: $(id).value }])),
    extension: state.ext,
  };
}

function exportStudy() {
  if (!state.variant) return;
  const student = readStudent();
  downloadJson(withStudent(makeRecord()), studentFileName('2105315-lab07-decision.json'));
  const warn = state.variant.kind !== 'student' ? ' This file uses a demo data set; load My data set for the work you submit.'
    : student.studentId.replace(/\s+/g, '') !== state.variant.seedId ? ' The student ID in your details differs from the ID that chose this data set.' : '';
  $('status').textContent = `Study downloaded.${warn}`;
}

async function openStudy(file) {
  let rec;
  try { rec = await readJsonFile(file); } catch (error) { $('status').textContent = error.message; return; }
  if (rec?.schema !== SCHEMA) { $('status').textContent = 'This file is not a Lab 07 study. Choose the file this page downloaded.'; return; }
  if (rec.student) fillStudent(rec.student);
  const kind = rec.dataset?.kind;
  if (kind === 'student' && rec.dataset.seedId) $('student-id').value = rec.dataset.seedId;
  if (!setCase(kind, { quiet: true })) return;
  if (rec.student) fillStudent(rec.student);
  $('p-pass').value = rec.predictions?.meetsRule ?? '';
  $('p-hit').value = rec.predictions?.hitRatePercent ?? '';
  for (const n of rec.notebook || []) if ($(`nb-${n.id}`)) $(`nb-${n.id}`).value = n.studentText ?? '';
  for (const [id, key] of Object.entries(answerIds)) if (typeof rec.answers?.[key]?.answer === 'string') $(id).value = rec.answers[key].answer;
  if (rec.alignment) { runAlign(); for (const n of rec.notebook || []) state.enteredBefore[n.id] = !!n.enteredBeforeReveal; }
  if (rec.results) runTest();
  $('decision').value = rec.decision ?? '';
  if (Number.isInteger(rec.extension?.margin)) { $('margin').value = String(rec.extension.margin); renderMargins(); }
  $('status').textContent = `Study reopened: ${state.variant.label}.`;
}

/* ---------- wiring ---------- */
async function start() {
  try {
    const response = await fetch(new URL('./data/airquality.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.L = D.load(state.data);
  } catch (error) { $('dataset-line').textContent = `The station record did not load (${error.message}). Reload the page.`; return; }
  for (const b of document.querySelectorAll('[data-case]')) b.addEventListener('click', () => setCase(b.dataset.case));
  $('download-sensor').addEventListener('click', () => downloadText(state.files.sensor, fileName('sensor')));
  $('download-analyzer').addEventListener('click', () => downloadText(state.files.analyzer, fileName('analyzer')));
  $('run-align').addEventListener('click', runAlign);
  $('run-test').addEventListener('click', runTest);
  for (const b of document.querySelectorAll('[data-m]')) b.addEventListener('click', () => { showView(Number(b.dataset.m)); if (state.ext.margin !== null) renderMargins(); });
  $('margin').addEventListener('input', () => renderMargins());
  $('export-study').addEventListener('click', exportStudy);
  $('import-study').addEventListener('change', (e) => { openStudy(e.target.files?.[0]); e.target.value = ''; });
  $('student-id').addEventListener('input', () => {
    if (state.variant?.kind === 'student' && $('student-id').value.replace(/\s+/g, '') !== state.variant.seedId) $('id-note').textContent = 'Your ID changed. Press My data set to load the data set for this ID.';
  });
  setCase('a', { quiet: true });
  for (const id of ['run-align', 'run-test', 'export-study']) $(id).disabled = false;
}
start();
