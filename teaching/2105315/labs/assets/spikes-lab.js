/** Lab 03 · page controller. Calculations are in spikes-engine.js; charts in charts.js. */
import * as S from './spikes-engine.js';
import { spikeChart } from './charts.js';
import { initStudentFields, readStudent, fillStudent, withStudent, studentFileName, downloadJson, downloadText, readJsonFile } from '/teaching/shared/labs-kit/submission.js';

const SCHEMA = 'skh-2105315-lab03-spikes-v1';
const PAGE_VERSION = '2026.2';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const state = {
  data: null, starts: null, variant: null, s: null, cands: [], rules: null, csv: '',
  sensorOn: false, revealed: false, locked: false, enteredBeforeRun: {}, align: 'trail',
  smooth: null, ext: { hampelRun: false },
};

initStudentFields({ storeKey: 'skh-2105315-student' });

/* ---------- Step 1 ---------- */
function setCase(kind, { quiet = false } = {}) {
  let variant;
  try { variant = S.makeVariant(state.data, kind, readStudent().studentId, state.starts); }
  catch (error) { $('id-note').textContent = error.message; $('student-id').focus(); return false; }
  state.variant = variant;
  state.s = S.series(state.data, variant);
  state.rules = S.rules(state.s);
  state.cands = S.candidates(state.s);
  state.csv = S.toCsv(state.s);
  state.revealed = false; state.locked = false; state.enteredBeforeRun = {}; state.ext = { hampelRun: false }; state.smooth = null;
  for (const b of document.querySelectorAll('[data-case]')) b.setAttribute('aria-pressed', String(b.dataset.case === kind));
  if (!quiet) $('id-note').textContent = kind === 'student' ? 'Your own data set is loaded. Use it for the work you submit.' : '';
  const t = state.s.t;
  $('dataset-line').textContent = `${variant.label} · ${t[0].iso.replace('T', ' ')} to ${t[t.length - 1].iso.replace('T', ' ')} · ${S.WINDOW_HOURS} hours · file: ${csvName()}`;
  drawRecord();
  renderJudge();
  renderNotebook();
  $('results').hidden = true;
  $('hk-readout').textContent = '';
  drawSmooth();
  return true;
}

function csvName() {
  const v = state.variant;
  return v.kind === 'student' ? `benzene-sensor-${v.seedId}.csv` : `benzene-sensor-demo-${v.kind}.csv`;
}

const scaledSensor = () => state.s.sensor.map((v) => state.rules.fit.intercept + state.rules.fit.slope * v);

/* ---------- Step 2 ---------- */
function drawRecord() {
  spikeChart($('spike-chart'), state.s.t, state.s.y, { marks: state.cands, sensor: state.sensorOn ? scaledSensor() : null });
  for (const b of document.querySelectorAll('[data-sensor]')) b.setAttribute('aria-pressed', String((b.dataset.sensor === 'on') === state.sensorOn));
  $('spike-caption').textContent = state.sensorOn
    ? 'Teal: benzene as recorded. Dashed: the second sensor, converted to benzene units with a straight-line fit. Where the two part company, ask why.'
    : 'Teal: benzene as recorded. Numbered circles: the hours to judge in Step 3.';
}

/* ---------- Step 3 ---------- */
const stamp = (i) => { const t = state.s.t[i]; return `${t.day.slice(8, 10)}/${t.day.slice(5, 7)} ${String(t.hour).padStart(2, '0')}:00`; };

function renderJudge() {
  const keep = Object.fromEntries(state.cands.map((c) => [c.n, document.querySelector(`input[name="j-${c.n}"]:checked`)?.value || '']));
  $('judge-list').innerHTML = state.cands.map((c) => `<li><span class="jn">${c.n}</span>${stamp(c.i)} · ${S.fmt(state.s.y[c.i], 1)} ${S.UNIT}
    <fieldset><legend class="visually-hidden">Hour ${c.n}</legend>
    <label><input type="radio" name="j-${c.n}" value="fault" ${keep[c.n] === 'fault' ? 'checked' : ''} ${state.locked ? 'disabled' : ''}>Fault</label>
    <label><input type="radio" name="j-${c.n}" value="real" ${keep[c.n] === 'real' ? 'checked' : ''} ${state.locked ? 'disabled' : ''}>Real</label></fieldset></li>`).join('');
}
const judgements = () => state.cands.map((c) => ({ n: c.n, hour: c.i, time: state.s.t[c.i].iso, value: state.s.y[c.i], said: document.querySelector(`input[name="j-${c.n}"]:checked`)?.value || '' }));

/* ---------- Step 5 ---------- */
function renderNotebook() {
  const ref = S.notebookReference(state.s);
  const keep = Object.fromEntries(ref.map((r) => [r.id, $(`nb-${r.id}`)?.value ?? '']));
  $('notebook-list').innerHTML = ref.map((r) => `<div class="notebook-item"><label for="nb-${r.id}">${esc(r.text)}</label><input id="nb-${r.id}" type="text" inputmode="decimal" autocomplete="off" value="${esc(keep[r.id])}"><p class="notebook-result" id="nb-${r.id}-result"></p></div>`).join('');
  for (const r of ref) $(`nb-${r.id}`).disabled = state.locked;
  $('locked-note').textContent = state.locked
    ? 'Locked when you ran the rules. The submitted file records which numbers you entered before.'
    : 'Enter your numbers before you run the rules. Running them locks your numbers and your judgements.';
}

function notebookEntries() {
  return S.notebookReference(state.s).map((r) => {
    const text = ($(`nb-${r.id}`)?.value || '').trim(), value = text === '' ? null : Number(text.replace(',', '.'));
    return { id: r.id, question: r.text, studentText: text, studentValue: Number.isFinite(value) ? value : null,
      reference: +r.value.toFixed(6), tolerance: r.tolerance,
      withinTolerance: Number.isFinite(value) ? Math.abs(value - r.value) <= r.tolerance + 1e-9 : null,
      enteredBeforeRun: !!state.enteredBeforeRun[r.id] };
  });
}

function showNotebookResults() {
  const ref = S.notebookReference(state.s);
  for (const n of notebookEntries()) {
    const r = ref.find((x) => x.id === n.id), out = $(`nb-${n.id}-result`), refText = r.value.toFixed(r.decimals);
    if (n.studentValue === null) { out.className = 'notebook-result'; out.textContent = `No number entered. The page gives ${refText}.`; }
    else if (n.withinTolerance) { out.className = 'notebook-result match'; out.textContent = `Matches the page (${refText}).`; }
    else { out.className = 'notebook-result miss'; out.textContent = `The page gives ${refText}. Find the line in your code that explains the difference.`; }
  }
}

/* ---------- Step 6 ---------- */
function runRules() {
  for (const r of S.notebookReference(state.s)) state.enteredBeforeRun[r.id] = ($(`nb-${r.id}`)?.value || '').trim() !== '';
  state.revealed = true; state.locked = true;
  renderNotebook(); showNotebookResults(); renderJudge();
  const sc = S.score(state.s, state.rules.flags);
  $('rule-body').innerHTML = S.RULES.map((r) => {
    const x = sc[r.id];
    return `<tr><td>${esc(r.label)}<br><span class="case-sub">${esc(r.detail)}</span></td><td class="${x.caught >= 6 ? 'good' : x.caught <= 3 ? 'bad' : ''}">${x.caught}</td><td class="${x.falseAlarms <= 2 ? 'good' : x.falseAlarms >= 5 ? 'bad' : ''}">${x.falseAlarms}</td></tr>`;
  }).join('');
  spikeChart($('reveal-chart'), state.s.t, state.s.y, { marks: state.cands, sensor: scaledSensor(), reveal: true });
  const js = judgements();
  let right = 0;
  $('judge-verdicts').innerHTML = state.cands.map((c, k) => {
    const said = js[k].said, ok = said === (c.fault ? 'fault' : 'real');
    right += ok;
    const f = state.s.faults.find((x) => x.i === c.i);
    const why = c.fault ? `Fault: recorded ${S.fmt(f.recorded, 1)}, true ${S.fmt(f.truth, 1)}. The sensor did not follow it.`
      : state.rules.flags.sensor[c.i] ? 'Real, although the sensor did not follow it closely: the sensor rule flags this hour by mistake.' : 'Real: the sensor moved with it.';
    return `<li class="${ok ? 'agree' : 'disagree'}"><span class="jn">${c.n}</span>${stamp(c.i)} · you said ${said || 'nothing'}<span class="jv">${esc(why)}</span></li>`;
  }).join('');
  state.judgedRight = right;
  $('result-lead').textContent = `You judged ${right} of ${S.CANDIDATES} hours correctly. Below: how the three rules did on the whole record, not only the 15 numbered hours.`;
  $('results').hidden = false;
  $('status').textContent = 'Rules run. Go on to Step 7, then download your study.';
}

/* ---------- Step 7 ---------- */
function drawSmooth() {
  if (!state.s) return;
  const w = Number($('win').value), centre = state.align === 'centre';
  const sm = S.smooth(state.s.truth, w, centre);
  spikeChart($('smooth-chart'), state.s.t, state.s.truth, { smoothed: sm, from: 0, to: 95 });
  for (const b of document.querySelectorAll('[data-align]')) b.setAttribute('aria-pressed', String(b.dataset.align === state.align));
  const raw = S.dailyPeak(state.s.t, state.s.truth), peak = S.dailyPeak(state.s.t, sm), lag = S.lagOf(w, centre);
  state.smooth = { window: w, centered: centre, dailyPeakRaw: +raw.toFixed(4), dailyPeakSmoothed: +peak.toFixed(4), lagHours: lag };
  const when = lag === 0 ? 'The smoothed line is not shifted in time.' : `The smoothed line runs ${lag} h late.`;
  $('smooth-readout').textContent = `${w} h ${centre ? 'centered' : 'trailing'} mean: typical daily peak ${S.fmt(peak)} instead of ${S.fmt(raw)} ${S.UNIT} (${String(Math.round((peak / raw - 1) * 100)).replace('-', '−')} %). ${when}`;
}

/* ---------- Step 9 ---------- */
function runHampel() {
  const k = Number($('hk').value), r = S.rules(state.s, k), sc = S.score(state.s, { hampel: r.flags.hampel }).hampel;
  state.ext = { hampelRun: true, hampel: { k, caught: sc.caught, falseAlarms: sc.falseAlarms } };
  $('hk-readout').textContent = `Threshold ${k.toFixed(1)} scaled MADs: ${sc.caught} of 8 faults caught, ${sc.falseAlarms} real hours flagged by mistake.`;
}

/* ---------- Step 10 ---------- */
const answerIds = { 'j-reason': 'judgeReason', 'ai-answer': 'aiCode', 's-choice': 'smoothChoice', 'c-sensor': 'sensorWhy', 'c-smooth': 'trailingLag', 'e-hk': 'extThreshold' };
function questionText(id) {
  const box = $(id).closest('.concept-question');
  return (box ? box.querySelector('h3') : document.querySelector(`label[for="${id}"]`))?.textContent.trim() ?? id;
}

function makeRecord() {
  const sc = S.score(state.s, state.rules.flags);
  return {
    schema: SCHEMA, course: '2105315', lab: 'Lab 03 · Spike or real process event?', pageVersion: PAGE_VERSION,
    savedAt: new Date().toISOString(), view: document.body.dataset.mode || 'core',
    dataset: { kind: state.variant.kind, seedId: state.variant.seedId, label: state.variant.label, startIndex: state.variant.startIndex,
      start: state.s.t[0].iso, hours: S.WINDOW_HOURS, columns: [S.COLUMN, S.SENSOR],
      source: `UCI Air Quality, doi:${state.data.source.doi}, ${state.data.source.license}` },
    judgements: judgements().map((j) => (state.revealed ? { ...j, fault: state.cands.find((c) => c.n === j.n).fault } : j)),
    revealed: state.revealed,
    rules: state.revealed ? { judgedRight: state.judgedRight, ...Object.fromEntries(S.RULES.map((r) => [r.id, { caught: sc[r.id].caught, falseAlarms: sc[r.id].falseAlarms }])) } : null,
    notebook: notebookEntries().map((n) => (state.revealed ? n : { id: n.id, question: n.question, studentText: n.studentText })),
    smoothing: state.smooth,
    answers: Object.fromEntries(Object.entries(answerIds).map(([id, key]) => [key, { question: questionText(id), answer: $(id).value }])),
    extension: { ...state.ext, hampelSetting: Number($('hk').value) },
  };
}

function exportStudy() {
  if (!state.s) return;
  const student = readStudent();
  downloadJson(withStudent(makeRecord()), studentFileName('2105315-lab03-spikes.json'));
  const warn = state.variant.kind !== 'student' ? ' This file uses a demo data set; load My data set for the work you submit.'
    : student.studentId.replace(/\s+/g, '') !== state.variant.seedId ? ' The student ID in your details differs from the ID that chose this data set.' : '';
  $('status').textContent = `Study downloaded.${warn}`;
}

async function openStudy(file) {
  let rec;
  try { rec = await readJsonFile(file); }
  catch (error) { $('status').textContent = error.message; return; }
  if (rec?.schema !== SCHEMA) { $('status').textContent = 'This file is not a Lab 03 study. Choose the file this page downloaded.'; return; }
  if (rec.student) fillStudent(rec.student);
  const kind = rec.dataset?.kind;
  if (kind === 'student' && rec.dataset.seedId) $('student-id').value = rec.dataset.seedId;
  if (!setCase(kind, { quiet: true })) return;
  if (rec.student) fillStudent(rec.student);
  for (const j of rec.judgements || []) { const el = document.querySelector(`input[name="j-${j.n}"][value="${j.said}"]`); if (el) el.checked = true; }
  for (const n of rec.notebook || []) if ($(`nb-${n.id}`)) $(`nb-${n.id}`).value = n.studentText ?? '';
  for (const [id, key] of Object.entries(answerIds)) if (typeof rec.answers?.[key]?.answer === 'string') $(id).value = rec.answers[key].answer;
  if (rec.smoothing) { $('win').value = rec.smoothing.window; $('win-out').textContent = `${rec.smoothing.window} h`; state.align = rec.smoothing.centered ? 'centre' : 'trail'; drawSmooth(); }
  if (Number.isFinite(rec.extension?.hampelSetting)) { $('hk').value = rec.extension.hampelSetting; $('hk-out').textContent = Number(rec.extension.hampelSetting).toFixed(1); }
  if (rec.revealed) {
    runRules();
    for (const n of rec.notebook || []) state.enteredBeforeRun[n.id] = !!n.enteredBeforeRun;
  }
  if (rec.extension?.hampelRun) runHampel();
  $('status').textContent = `Study reopened: ${state.variant.label}${rec.revealed ? ', rules restored' : ''}.`;
}

/* ---------- wiring ---------- */
async function start() {
  try {
    const response = await fetch(new URL('./data/airquality.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.starts = S.completeStarts(state.data);
  } catch (error) {
    $('dataset-line').textContent = `The station record did not load (${error.message}). Reload the page.`;
    return;
  }
  for (const b of document.querySelectorAll('[data-case]')) b.addEventListener('click', () => setCase(b.dataset.case));
  for (const b of document.querySelectorAll('[data-sensor]')) b.addEventListener('click', () => { state.sensorOn = b.dataset.sensor === 'on'; drawRecord(); });
  for (const b of document.querySelectorAll('[data-align]')) b.addEventListener('click', () => { state.align = b.dataset.align; drawSmooth(); });
  $('win').addEventListener('input', () => { $('win-out').textContent = `${$('win').value} h`; drawSmooth(); });
  $('hk').addEventListener('input', () => { $('hk-out').textContent = Number($('hk').value).toFixed(1); if (state.ext.hampelRun) runHampel(); });
  $('download-csv').addEventListener('click', () => downloadText(state.csv, csvName()));
  $('run-rules').addEventListener('click', runRules);
  $('run-hk').addEventListener('click', runHampel);
  $('export-study').addEventListener('click', exportStudy);
  $('import-study').addEventListener('change', (e) => { openStudy(e.target.files?.[0]); e.target.value = ''; });
  $('student-id').addEventListener('input', () => {
    if (state.variant?.kind === 'student' && $('student-id').value.replace(/\s+/g, '') !== state.variant.seedId) $('id-note').textContent = 'Your ID changed. Press My data set to load the data set for this ID.';
  });
  setCase('spring');
  for (const id of ['run-rules', 'run-hk', 'export-study']) $(id).disabled = false;
}

start();
