import './style.css';
import orbit from '../fixtures/m1-orbit.json';
import binary from '../fixtures/m0-binary.json';
import { EditorSession } from './editor/session';
import { predict, type Prediction } from './planning/predict';
import { Runner, type Sample } from './sim/runner';
import { bodyState } from './sim/dynamics';
import { validateBundle, type Burn, type Bundle, type State } from './sim/schema';
import { frameState, hitPath, project, unproject, type Camera } from './view/coordinates';

document.body.innerHTML = `
<main>
  <header><h1>Orbital Logistics</h1><select id="scene" aria-label="Scenario"><option value="orbit">Orbit shaping</option><option value="moon">Moon encounter</option></select>
    <div class="header-actions"><button id="undo" title="Undo (Ctrl+Z)" aria-label="Undo">↶</button><button id="redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷</button><button id="files">Save / load</button></div></header>
  <div class="workspace">
    <section class="scene"><div class="view-tools"><label>Frame <select id="frame" aria-label="View frame"></select></label><button id="fit">Fit</button><button id="focus">Focus</button><span id="prediction-status" role="status"></span></div>
      <canvas width="1000" height="650" aria-label="Trajectory editor" tabindex="0"></canvas>
      <div class="scene-bottom"><div class="legend"><span class="baseline-key">Reference</span><span class="draft-key">Plan</span><span class="live-key">Execution</span></div><span id="hint"></span></div>
    </section>
    <aside><nav id="objects" aria-label="Objects"></nav><div class="section-title"><h2 id="selected-object">Ship</h2><button id="plan">Plan trajectory</button></div>
      <div id="goal"><span id="goal-label">Apoapsis in the band</span><strong id="goal-value">—</strong></div>
      <div class="section-title"><h2>Maneuvers</h2><button id="add" title="Add at preview epoch" aria-label="Add maneuver">+</button></div>
      <div id="burns" role="list"></div>
      <section id="inspector" hidden><div class="section-title"><strong id="node-name"></strong><div><button id="previous" aria-label="Previous maneuver">‹</button><button id="next" aria-label="Next maneuver">›</button><button id="delete" aria-label="Delete maneuver">×</button></div></div>
        <div class="node-cost">Δv <output id="node-dv"></output></div>
        <details id="precision"><summary>Precision</summary>
          <label>Epoch <input id="burn-time" type="number" step="0.001"></label><div class="nudges"><button data-nudge="-0.01" data-field="t">−0.01</button><button data-nudge="0.01" data-field="t">+0.01</button></div>
          <label>Reference <select id="burn-reference"></select></label>
          <label>Radial <input id="radial" type="number" step="0.001"></label><div class="nudges"><button data-nudge="-0.001" data-field="radial">−</button><button data-nudge="0.001" data-field="radial">+</button></div>
          <label>Transverse <input id="transverse" type="number" step="0.001"></label><div class="nudges"><button data-nudge="-0.001" data-field="transverse">−</button><button data-nudge="0.001" data-field="transverse">+</button></div>
        </details>
        <div class="snap-controls"><select id="apsis" aria-label="Apsis occurrence"></select><button id="snap">Snap</button></div><div id="snap-state"></div><button id="keep-epoch" hidden>Keep epoch</button>
      </section>
      <dl><div><dt>Total Δv</dt><dd id="total-dv"></dd></div><div><dt>Fuel remaining</dt><dd id="fuel"></dd></div></dl>
      <details id="encounter"><summary>Closest approach</summary><label>Body <select id="encounter-body"></select></label><div id="encounter-readout"></div></details>
      <p id="message" role="status"></p><button id="execute" class="primary">Execute plan</button>
    </aside>
  </div>
  <section class="transport"><div class="transport-row"><button id="play">Play</button><button id="step">+0.25</button><button id="reset">Reset</button><select id="warp" aria-label="Playback speed"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="4">4×</option><option value="16">16×</option></select><span id="status" role="status"></span><span class="live-time">Execution <output id="time"></output></span></div>
    <label class="scrub">Preview <input id="epoch" type="range" min="0" max="8" step="0.001" value="0"><output id="preview-time"></output><button id="live">Live</button></label>
  </section>
  <details id="file-panel"><summary>Scenario / program JSON</summary><div class="buttons"><button id="save">Save to JSON</button><button id="download">Download</button><button id="load">Load JSON</button></div><textarea id="json" aria-label="Scenario and program JSON" spellcheck="false"></textarea><p id="import-status" role="status"></p></details>
  <details><summary>Debug</summary><pre id="state-json"></pre></details>
</main>`;

function el<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const canvas = document.querySelector('canvas')!, ctx = canvas.getContext('2d')!;
const frameSelect = el<HTMLSelectElement>('frame'), slider = el<HTMLInputElement>('epoch');
let session: EditorSession, baseline: Prediction, draft: Prediction, acceptedReference: Runner;
let camera: Camera = { center: [0, 0], scale: 150 }, selectedObject = 'ship', selectedBurn: string | undefined;
let planning = false, playing = false, previewTime: number | undefined, pinnedTime = 1.137;
let worker: Worker | undefined, generation = 0, pending = false, predictionError = '';
let lastEditAt = 0, latency: number[] = [], feedbackLatency: number[] = [], geometry: { t: number; p: number[] }[] = [];
let snapEvents: ReturnType<EditorSession['snapCandidates']> = [];
let handle: { axis: 'radial' | 'transverse'; origin: [number, number]; direction: [number, number]; start: number } | undefined;
let pan: { point: [number, number]; center: [number, number] } | undefined;
let handles: { axis: 'radial' | 'transverse'; p: [number, number]; direction: [number, number] }[] = [];
let nodePoints: { id: string; p: [number, number] }[] = [];
let objectPoints: { id: string; p: [number, number]; radius: number }[] = [];
const endTime = () => session.scenario.epoch + session.scenario.duration;
const currentBurn = () => session.draft.burns.find(b => b.id === selectedBurn);
const limit = () => session.scenario.bodies.length > 1 ? 0.03 : 0.25;
const gain = () => session.scenario.bodies.length > 1 ? 4000 : 600;
const statusLabel = (status: Sample['status']) => ({ running: 'Running', horizon: 'Complete', collision: 'Surface contact',
  'unsupported-approach': 'Approach unresolved', 'burn-rejected': 'Not enough fuel', 'work-limit': 'Prediction incomplete' })[status];

function samplePrediction(prediction: Prediction, t: number): Sample {
  const rows = prediction.samples; t = Math.min(t, prediction.terminal.t);
  let lo = 0, hi = rows.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (rows[mid].t <= t) lo = mid; else hi = mid - 1; }
  const a = rows[lo], b = rows[lo + 1];
  if (!b || t === a.t) return a;
  const u = (t - a.t) / (b.t - a.t);
  // View-only interpolation. Burns and execution always use the Runner.
  return { ...a, t, y: a.y.map((v, i) => v + u * (b.y[i] - v)) as State };
}
function relative(y: State, t: number): State {
  return frameState(session.scenario, y, t, frameSelect.value,
    frameSelect.value === 'ship' ? acceptedReference.sample(t).y : [0, 0, 0, 0]);
}
function point(y: State, t: number): [number, number] { return project(relative(y, t), camera); }
function setPlaying(value: boolean) { playing = value; el('play').textContent = playing ? 'Pause' : 'Play'; }
function message(text = '') { el('message').textContent = text; }
function selectOptions(select: HTMLSelectElement, entries: [string, string][], value?: string) {
  select.replaceChildren(...entries.map(([id, label]) => { const option = document.createElement('option'); option.value = id; option.textContent = label; return option; }));
  if (value && entries.some(([id]) => id === value)) select.value = value;
}
function fit() {
  const positions = [...baseline.samples, ...draft.samples].map(p => relative(p.y, p.t));
  if (session.scenario.id === 'm1-orbit-v1') positions.push([-1.7, -1.7, 0, 0], [1.7, 1.7, 0, 0]);
  for (const body of session.scenario.bodies) for (const sample of baseline.samples) positions.push(relative(bodyState(body, sample.t), sample.t));
  const xs = positions.map(p => p[0]), ys = positions.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  camera = { center: [(minX + maxX) / 2, (minY + maxY) / 2], scale: Math.min(800 / Math.max(maxX - minX, 0.1), 480 / Math.max(maxY - minY, 0.1)) };
}
function install(next: EditorSession, preview = next.scenario.epoch) {
  worker?.terminate(); worker = undefined; pending = false; generation++; session = next;
  acceptedReference = new Runner({ scenario: session.scenario, program: session.accepted });
  baseline = predict({ scenario: session.scenario, program: session.baseline }, -1); draft = baseline;
  selectedObject = 'ship'; selectedBurn = undefined; planning = false; handle = undefined; previewTime = undefined;
  pinnedTime = preview; setPlaying(false); message(); latency = []; feedbackLatency = []; lastEditAt = 0;
  selectOptions(frameSelect, [['inertial', 'Inertial'], ...session.scenario.bodies.map(b => [b.id, b.id + ' centered'] as [string, string]), ['ship', 'Execution ship']]);
  const bodies = session.scenario.bodies.map(b => [b.id, b.id] as [string, string]);
  selectOptions(el('burn-reference'), bodies); selectOptions(el('encounter-body'), bodies, bodies.at(-1)?.[0]);
  el('objects').replaceChildren(...[['ship', 'Ship'], ...bodies].map(([id, label]) => {
    const button = document.createElement('button'); button.textContent = label; button.dataset.object = id;
    button.addEventListener('click', () => { selectedObject = id; planning = false; updateUI(); render(); }); return button;
  }));
  slider.min = String(session.scenario.epoch); slider.max = String(endTime());
  el<HTMLSelectElement>('scene').value = session.scenario.id === 'm1-orbit-v1' ? 'orbit' : session.scenario.id === binary.scenario.id ? 'moon' : '';
  el('goal').hidden = session.scenario.id !== 'm1-orbit-v1' && session.scenario.id !== binary.scenario.id;
  el('goal-label').textContent = session.scenario.id === binary.scenario.id ? 'Moon altitude · t 2.4–2.6' : 'Apoapsis in the band';
  el<HTMLTextAreaElement>('json').value = session.serialize(preview); fit(); refreshInspector(); schedulePrediction();
}
function refreshInspector() {
  const burn = currentBurn(); el('inspector').hidden = !burn;
  if (!burn) { snapEvents = []; return; }
  for (const [id, value] of [['burn-time', burn.t], ['radial', burn.radial], ['transverse', burn.transverse]] as const) el<HTMLInputElement>(id).value = String(value);
  el<HTMLInputElement>('burn-time').min = String(session.scenario.epoch); el<HTMLInputElement>('burn-time').max = String(endTime());
  for (const id of ['radial', 'transverse']) { el<HTMLInputElement>(id).min = String(-limit()); el<HTMLInputElement>(id).max = String(limit()); }
  el<HTMLSelectElement>('burn-reference').value = burn.referenceBodyId;
  snapEvents = session.snapCandidates(burn.id);
  selectOptions(el('apsis'), snapEvents.length ? snapEvents.map((e, i) => [String(i), `${e.kind} · ${e.bodyId} · ${e.t.toFixed(3)}`]) : [['', 'No unique apsis']]);
  el<HTMLButtonElement>('snap').disabled = snapEvents.length === 0;
  const snapState = session.snapState(burn.id);
  el('snap-state').textContent = snapState === 'current' ? `Snapped · ${burn.snap!.kind}` : snapState ? `Apsis ${snapState} · re-snap or keep epoch` : '';
  el('keep-epoch').hidden = !snapState || snapState === 'current';
}
function updateUI() {
  const program = session.draft, burn = currentBurn(), live = session.execution.current;
  el<HTMLButtonElement>('undo').disabled = !session.canUndo; el<HTMLButtonElement>('redo').disabled = !session.canRedo;
  el<HTMLButtonElement>('plan').disabled = selectedObject !== 'ship';
  el('plan').textContent = planning ? 'Inspect' : 'Plan trajectory';
  el('selected-object').textContent = selectedObject === 'ship' ? 'Ship' : selectedObject;
  document.querySelectorAll<HTMLButtonElement>('[data-object]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.object === selectedObject)));
  el<HTMLButtonElement>('add').disabled = !planning || pending || !!handle;
  el('burns').replaceChildren(...program.burns.map((b, index) => {
    const button = document.createElement('button'); button.className = 'burn-row'; button.dataset.burn = b.id;
    button.setAttribute('role', 'listitem'); button.setAttribute('aria-current', String(b.id === selectedBurn));
    button.textContent = `${index + 1}  ·  t ${b.t.toFixed(3)}     Δv ${Math.hypot(b.radial, b.transverse).toFixed(4)}`;
    button.addEventListener('click', () => selectBurn(b.id)); return button;
  }));
  if (!program.burns.length) { const empty = document.createElement('span'); empty.className = 'muted'; empty.textContent = 'No maneuvers'; el('burns').append(empty); }
  el('inspector').hidden = !burn;
  if (burn) { el('node-name').textContent = `Maneuver ${program.burns.findIndex(b => b.id === burn.id) + 1}`; el('node-dv').textContent = Math.hypot(burn.radial, burn.transverse).toFixed(5); }
  el('total-dv').textContent = program.burns.reduce((sum, b) => sum + Math.hypot(b.radial, b.transverse), 0).toFixed(5);
  el('fuel').textContent = (pending ? live.propellant : draft.terminal.propellant).toFixed(5);
  const staleSnap = program.burns.some(b => b.snap && session.snapState(b.id) !== 'current');
  el<HTMLButtonElement>('execute').disabled = pending || !!handle || !!predictionError || draft.revision !== session.revision || draft.terminal.status !== 'horizon' || draft.accuracy?.status !== 'converged' || staleSnap;
  el('prediction-status').textContent = predictionError ? 'Prediction failed' : pending ? 'Updating…' : draft.terminal.status !== 'horizon' ? statusLabel(draft.terminal.status) : draft.accuracy?.status !== 'converged' ? 'Path unresolved' : session.changed ? 'Draft' : '';
  el('prediction-status').classList.toggle('stale', pending);
  const moonGoal = session.scenario.id === binary.scenario.id;
  const goal = moonGoal ? draft.diagnostics.moon?.closest : draft.diagnostics.primary?.apsides.find(e => e.kind === 'apoapsis' && e.t > (program.burns[0]?.t ?? 0));
  const achieved = !!goal && (moonGoal ? goal.altitude >= 0.065 && goal.altitude <= 0.075 && goal.t >= 2.4 && goal.t <= 2.6 : goal.distance >= 1.4 && goal.distance <= 1.6);
  el('goal-value').textContent = pending ? '…' : goal ? `${(moonGoal ? goal.altitude : goal.distance).toFixed(3)}${achieved ? ' · In band' : ''}` : '—';
  el('goal').classList.toggle('achieved', !pending && draft.accuracy?.status === 'converged' && achieved);
  const encounter = draft.diagnostics[el<HTMLSelectElement>('encounter-body').value]?.closest;
  el('encounter-readout').textContent = pending ? 'Updating…' : encounter ? `t ${encounter.t.toFixed(5)}\nCenter ${encounter.distance.toFixed(6)}\nAltitude ${encounter.altitude.toFixed(6)}\nRelative speed ${encounter.relativeSpeed.toFixed(6)}` : '';
}
function schedulePrediction(inputAt?: number) {
  if (inputAt !== undefined) lastEditAt = inputAt;
  if (pending) { worker?.terminate(); worker = undefined; }
  pending = true; predictionError = '';
  const ticket = ++generation, revision = session.revision, bundle = session.bundle;
  worker ??= new Worker(new URL('./planning/prediction.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (ticket !== generation || revision !== session.revision) return;
    if (data.error) { pending = false; predictionError = data.error; message(data.error); updateUI(); render(); return; }
    const result = data.result as Prediction;
    if (result.scenarioId !== session.scenario.id || result.modelVersion !== session.scenario.modelVersion || result.revision !== revision || result.horizon !== endTime()) return;
    draft = result; pending = false; updateUI();
    requestAnimationFrame(() => {
      render();
      requestAnimationFrame(() => { if (ticket === generation && lastEditAt) { latency.push(performance.now() - lastEditAt); latency = latency.slice(-64); lastEditAt = 0; render(); } });
    });
  };
  worker.onerror = event => { if (ticket !== generation) return; pending = false; predictionError = event.message; worker?.terminate(); worker = undefined; message(event.message); updateUI(); render(); };
  worker.postMessage({ bundle, revision, horizon: endTime() }); updateUI(); render();
  if (inputAt !== undefined) requestAnimationFrame(() => { if (ticket === generation) { feedbackLatency.push(performance.now() - inputAt); feedbackLatency = feedbackLatency.slice(-64); } });
}
function selectBurn(id: string) {
  if (handle) finishHandle(true);
  selectedBurn = id; selectedObject = 'ship'; planning = true; setPlaying(false);
  pinnedTime = currentBurn()!.t; previewTime = pinnedTime; refreshInspector(); updateUI(); render();
}
function edited(change: () => void, inspector = true) {
  const inputAt = performance.now();
  try {
    const previous = session.revision; change(); setPlaying(false); message();
    if (inspector) refreshInspector();
    if (session.revision === previous) { updateUI(); render(); return; }
    schedulePrediction(inputAt);
  }
  catch (error) { message((error as Error).message); if (inspector) refreshInspector(); render(); }
}
function addBurn(t: number) {
  edited(() => { selectedBurn = session.addBurn(Math.round(t * 1e6) / 1e6, el<HTMLSelectElement>('burn-reference').value || session.scenario.bodies[0].id); pinnedTime = currentBurn()!.t; previewTime = pinnedTime; });
}
function finishHandle(commit: boolean) {
  if (!handle) return;
  const inputAt = performance.now();
  const previous = session.revision; handle = undefined; session.endGesture(commit); refreshInspector();
  if (session.revision !== previous) schedulePrediction(inputAt); else { updateUI(); render(); }
}
function render() {
  if (!session) return;
  const live = session.execution.current; if (live.status !== 'running') setPlaying(false);
  const t = previewTime ?? live.t, ghost = samplePrediction(draft, t), s = session.scenario;
  el('time').textContent = live.t.toFixed(3); el('preview-time').textContent = t.toFixed(3); slider.value = String(t);
  el('status').textContent = live.status === 'running' ? (playing ? 'Running' : 'Paused') : statusLabel(live.status);
  el('hint').textContent = handle ? 'Move · click to set · Esc to cancel' : planning && !selectedBurn ? 'Click the orbit to place a maneuver' : planning && selectedBurn ? 'Click R or T to adjust' : '';
  ctx.fillStyle = '#0f1821'; ctx.fillRect(0, 0, 1000, 650); ctx.strokeStyle = '#1b2a35'; ctx.lineWidth = 1;
  const spacing = 50;
  for (let x = 0; x <= 1000; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 650); ctx.stroke(); }
  for (let y = 0; y <= 650; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1000, y); ctx.stroke(); }
  if (s.id === 'm1-orbit-v1' && frameSelect.value !== 'ship') {
    const p = point(bodyState(s.bodies[0], t), t);
    ctx.beginPath(); ctx.arc(...p, 1.5 * camera.scale, 0, 2 * Math.PI); ctx.strokeStyle = '#7bb2a322'; ctx.lineWidth = 0.2 * camera.scale; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = '#7bb2a366'; ctx.setLineDash([4, 7]);
    for (const r of [1.4, 1.6]) { ctx.beginPath(); ctx.arc(...p, r * camera.scale, 0, 2 * Math.PI); ctx.stroke(); } ctx.setLineDash([]);
  }
  if (s.id === binary.scenario.id && frameSelect.value !== 'ship') {
    const p = point(bodyState(s.bodies[1], t), t);
    ctx.beginPath(); ctx.arc(...p, 0.095 * camera.scale, 0, 2 * Math.PI); ctx.strokeStyle = '#7bb2a344'; ctx.lineWidth = 0.01 * camera.scale; ctx.stroke();
  }
  function path(prediction: Prediction, color: string, dashed = false) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dashed ? [5, 6] : []);
    prediction.samples.forEach((sample, i) => { const p = point(sample.y, sample.t); if (i === 0) ctx.moveTo(...p); else ctx.lineTo(...p); }); ctx.stroke(); ctx.setLineDash([]);
  }
  path(baseline, '#5d798d88'); path(draft, pending ? '#c7a37488' : '#edbc74', pending);
  geometry = draft.samples.map(p => ({ t: p.t, p: point(p.y, p.t) }));
  // A body's trail and its preview marker use the reference origin at each
  // sample's epoch, never the current body's position for an entire trajectory.
  for (const body of s.bodies) if (body.rail.kind === 'circular') {
    ctx.beginPath(); ctx.strokeStyle = '#66848b55'; ctx.lineWidth = 1;
    baseline.samples.forEach((sample, i) => { const p = point(bodyState(body, sample.t), sample.t); if (i === 0) ctx.moveTo(...p); else ctx.lineTo(...p); }); ctx.stroke();
  }
  objectPoints = [];
  for (const body of s.bodies) {
    const p = point(bodyState(body, ghost.t), ghost.t), radius = Math.max(2, body.radius * camera.scale);
    objectPoints.push({ id: body.id, p, radius }); ctx.beginPath(); ctx.arc(...p, radius, 0, 2 * Math.PI); ctx.fillStyle = body.id === 'moon' ? '#c4ced3' : '#76afac'; ctx.fill();
    if (selectedObject === body.id) { ctx.beginPath(); ctx.arc(...p, radius + 6, 0, 2 * Math.PI); ctx.strokeStyle = '#e8eff3'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.font = '13px system-ui'; ctx.fillStyle = '#a8bbc6'; ctx.fillText(body.id, p[0] + radius + 8, p[1] + 4);
  }
  const livePoint = point(live.y, live.t); ctx.fillStyle = '#77c3d8'; ctx.beginPath(); ctx.arc(...livePoint, 5, 0, 2 * Math.PI); ctx.fill();
  objectPoints.push({ id: 'ship', p: livePoint, radius: 7 });
  if (selectedObject === 'ship') { ctx.strokeStyle = '#77c3d8'; ctx.lineWidth = 1; ctx.strokeRect(livePoint[0] - 10, livePoint[1] - 10, 20, 20); }
  if (previewTime !== undefined) { const p = point(ghost.y, ghost.t); ctx.strokeStyle = '#f3d3a2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(...p, 6, 0, 2 * Math.PI); ctx.stroke(); ctx.fillStyle = '#f3d3a2'; ctx.font = '12px system-ui'; ctx.fillText(`t ${ghost.t.toFixed(3)}`, p[0] + 12, p[1] - 12); }
  nodePoints = []; handles = [];
  for (const [index, burn] of session.draft.burns.entries()) {
    const state = draft.burnStates[burn.id]; if (!state || state.t !== burn.t) continue;
    const p = point(state.y, burn.t); nodePoints.push({ id: burn.id, p });
    ctx.strokeStyle = '#edbc74'; ctx.fillStyle = '#edbc74'; ctx.lineWidth = burn.id === selectedBurn ? 2 : 1;
    ctx.strokeRect(p[0] - 6, p[1] - 6, 12, 12); ctx.font = '12px system-ui'; ctx.fillText(String(index + 1), p[0] + 10, p[1] + 15);
    if (burn.id !== selectedBurn || !planning) continue;
    const ref = bodyState(s.bodies.find(b => b.id === burn.referenceBodyId)!, burn.t), dx = state.y[0] - ref[0], dy = state.y[1] - ref[1], r = Math.hypot(dx, dy);
    for (const [axis, direction, color] of [['radial', [dx / r, -dy / r], '#d68b91'], ['transverse', [-dy / r, -dx / r], '#80c8be']] as const) {
      const length = 70 + burn[axis] * gain(), tip: [number, number] = [p[0] + direction[0] * length, p[1] + direction[1] * length];
      handles.push({ axis, p: tip, direction: [...direction] }); ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.moveTo(...p); ctx.lineTo(...tip); ctx.stroke();
      ctx.beginPath(); ctx.fillStyle = color; ctx.arc(...tip, handle?.axis === axis ? 9 : 7, 0, 2 * Math.PI); ctx.fill();
      ctx.font = 'bold 12px system-ui'; ctx.fillStyle = '#111d27'; ctx.fillText(axis === 'radial' ? 'R' : 'T', tip[0] - 4, tip[1] + 4);
    }
  }
  el('state-json').textContent = JSON.stringify({ ...live, ledger: session.execution.ledger, draft: session.draft,
    accepted: session.accepted, baseline: session.baseline, revision: session.revision, readyRevision: draft.revision, pending,
    previewTime: previewTime ?? null, pinnedTime, mode: handle ? 'handle-edit' : selectedBurn ? 'epoch-pinned' : planning ? 'hover-preview' : 'inspect',
    selectedObject, selectedBurn, frame: frameSelect.value, camera, handles, nodePoints, objectPoints,
    terminal: draft.terminal, diagnostics: draft.diagnostics, accuracy: draft.accuracy, latency, feedbackLatency }, null, 2);
}

// Switching to another control cancels the latched edit before that control acts.
document.addEventListener('pointerdown', event => {
  if (handle && event.target !== canvas) finishHandle(false);
}, true);
canvas.addEventListener('pointerdown', event => {
  if (handle) return;
  if (event.button === 1 || event.button === 2 || (event.button === 0 && event.shiftKey)) {
    event.preventDefault(); pan = { point: pointer(event), center: [...camera.center] }; canvas.setPointerCapture(event.pointerId);
  }
});
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerup', event => { if (pan) { pan = undefined; canvas.releasePointerCapture(event.pointerId); } });
canvas.addEventListener('pointercancel', () => { pan = undefined; finishHandle(false); });
function pointer(event: MouseEvent): [number, number] {
  const rect = canvas.getBoundingClientRect(); return [(event.clientX - rect.left) * 1000 / rect.width, (event.clientY - rect.top) * 650 / rect.height];
}
canvas.addEventListener('pointermove', event => {
  const p = pointer(event);
  if (pan) { camera.center = [pan.center[0] - (p[0] - pan.point[0]) / camera.scale, pan.center[1] + (p[1] - pan.point[1]) / camera.scale]; render(); return; }
  if (handle && selectedBurn) {
    const value = Math.max(-limit(), Math.min(limit(), handle.start + ((p[0] - handle.origin[0]) * handle.direction[0] + (p[1] - handle.origin[1]) * handle.direction[1]) / gain()));
    edited(() => session.updateBurn(selectedBurn!, { [handle!.axis]: Math.round(value * 1e6) / 1e6 }), false); return;
  }
  if (planning && !selectedBurn && !pending) { const hit = hitPath(geometry, p, pinnedTime); if (hit) { previewTime = hit.t; render(); } }
  canvas.style.cursor = handles.some(h => Math.hypot(p[0] - h.p[0], p[1] - h.p[1]) < 14) ? 'crosshair' : planning ? 'crosshair' : 'default';
});
canvas.addEventListener('click', event => {
  if (event.shiftKey || event.button !== 0) return;
  const p = pointer(event); canvas.focus();
  if (handle) { finishHandle(true); return; }
  const hitHandle = handles.find(h => Math.hypot(p[0] - h.p[0], p[1] - h.p[1]) < 14);
  if (hitHandle && selectedBurn && !pending) { session.beginGesture(); handle = { axis: hitHandle.axis, origin: p, direction: hitHandle.direction, start: currentBurn()![hitHandle.axis] }; updateUI(); render(); return; }
  const node = nodePoints.find(n => Math.hypot(p[0] - n.p[0], p[1] - n.p[1]) < 12);
  if (node) { selectBurn(node.id); return; }
  if (planning && !pending) { const hit = hitPath(geometry, p, previewTime ?? pinnedTime); if (hit) { addBurn(hit.t); return; } }
  const object = objectPoints.find(o => Math.hypot(p[0] - o.p[0], p[1] - o.p[1]) < Math.max(12, o.radius));
  if (object) { selectedObject = object.id; selectedBurn = undefined; planning = false; refreshInspector(); updateUI(); render(); }
});
canvas.addEventListener('wheel', event => {
  event.preventDefault(); if (handle) return;
  const p = pointer(event), before = unproject(p, camera);
  camera.scale = Math.max(20, Math.min(10000, camera.scale * Math.exp(-event.deltaY * 0.001)));
  const after = unproject(p, camera); camera.center[0] += before[0] - after[0]; camera.center[1] += before[1] - after[1]; render();
}, { passive: false });
el('plan').addEventListener('click', () => { if (handle) finishHandle(false); planning = !planning; selectedBurn = undefined; setPlaying(false); previewTime = planning ? pinnedTime : undefined; refreshInspector(); updateUI(); render(); });
el('add').addEventListener('click', () => addBurn(previewTime ?? pinnedTime));
el('delete').addEventListener('click', () => edited(() => { session.removeBurn(selectedBurn!); selectedBurn = undefined; }));
for (const [id, field] of [['burn-time', 't'], ['radial', 'radial'], ['transverse', 'transverse']] as const) el<HTMLInputElement>(id).addEventListener('change', () => {
  const value = el<HTMLInputElement>(id).valueAsNumber;
  if (field !== 't' && Math.abs(value) > limit()) { message(`Range: ${-limit()} to ${limit()}`); refreshInspector(); return; }
  edited(() => { session.updateBurn(selectedBurn!, { [field]: value }); pinnedTime = currentBurn()!.t; previewTime = pinnedTime; });
});
document.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach(button => button.addEventListener('click', () => {
  const field = button.dataset.field as 't' | 'radial' | 'transverse', burn = currentBurn()!, value = Math.round((burn[field] + Number(button.dataset.nudge)) * 1e6) / 1e6;
  if (field !== 't' && Math.abs(value) > limit()) return;
  edited(() => { session.updateBurn(burn.id, { [field]: value }); previewTime = currentBurn()!.t; pinnedTime = previewTime; });
}));
el('burn-reference').addEventListener('change', () => edited(() => session.updateBurn(selectedBurn!, { referenceBodyId: el<HTMLSelectElement>('burn-reference').value })));
el('snap').addEventListener('click', () => {
  const event = snapEvents[Number(el<HTMLSelectElement>('apsis').value)]; if (!event) return;
  edited(() => { session.snap(selectedBurn!, event, [Math.max(session.scenario.epoch, event.t - 0.5), Math.min(endTime(), event.t + 0.5)]); pinnedTime = event.t; previewTime = event.t; });
});
el('keep-epoch').addEventListener('click', () => edited(() => session.updateBurn(selectedBurn!, { t: currentBurn()!.t })));
for (const [id, direction] of [['previous', -1], ['next', 1]] as const) el(id).addEventListener('click', () => { const burns = session.draft.burns, at = burns.findIndex(b => b.id === selectedBurn); if (burns.length) selectBurn(burns[(at + direction + burns.length) % burns.length].id); });
function history(redo = false) { if (handle) finishHandle(false); edited(() => { if (redo) session.redo(); else session.undo(); if (!currentBurn()) selectedBurn = undefined; }); }
el('undo').addEventListener('click', () => history()); el('redo').addEventListener('click', () => history(true));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { finishHandle(false); return; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); history(event.shiftKey); }
});
frameSelect.addEventListener('change', () => { if (handle) finishHandle(false); fit(); render(); });
el('fit').addEventListener('click', () => { if (!handle) { fit(); render(); } });
el('focus').addEventListener('click', () => { if (handle) return; const t = previewTime ?? session.execution.current.t, y = selectedObject === 'ship' ? samplePrediction(draft, t).y : bodyState(session.scenario.bodies.find(b => b.id === selectedObject)!, t); const r = relative(y, t); camera.center = [r[0], r[1]]; render(); });
el('encounter-body').addEventListener('change', () => updateUI());
el('execute').addEventListener('click', () => {
  try { session.execute(); acceptedReference = new Runner({ scenario: session.scenario, program: session.accepted }); previewTime = undefined; planning = false; selectedBurn = undefined; setPlaying(true); message(); refreshInspector(); updateUI(); render(); }
  catch (error) { message((error as Error).message); }
});
el('play').addEventListener('click', () => { if (session.execution.current.status !== 'running') session.execution.reset(); previewTime = undefined; setPlaying(!playing); render(); });
el('step').addEventListener('click', () => { setPlaying(false); previewTime = undefined; session.execution.advance(0.25); render(); });
el('reset').addEventListener('click', () => { setPlaying(false); previewTime = undefined; session.execution.reset(); render(); });
slider.addEventListener('input', () => { if (handle) finishHandle(false); previewTime = Number(slider.value); pinnedTime = previewTime; setPlaying(false); render(); });
el('live').addEventListener('click', () => { previewTime = undefined; render(); });
el('scene').addEventListener('change', () => install(new EditorSession(validateBundle(el<HTMLSelectElement>('scene').value === 'moon' ? binary : orbit))));
el('files').addEventListener('click', () => { const panel = el<HTMLDetailsElement>('file-panel'); panel.open = !panel.open; if (panel.open) panel.scrollIntoView({ behavior: 'smooth' }); });
el('save').addEventListener('click', () => { el<HTMLTextAreaElement>('json').value = session.serialize(previewTime ?? session.execution.current.t); el('import-status').textContent = 'Saved'; });
el('download').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([session.serialize(previewTime ?? session.execution.current.t)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'orbital-logistics-plan.json'; a.click(); URL.revokeObjectURL(url); });
el('load').addEventListener('click', () => { try { const { session: next, previewEpoch } = EditorSession.deserialize(el<HTMLTextAreaElement>('json').value); install(next, previewEpoch); previewTime = previewEpoch; el('import-status').textContent = 'Loaded'; } catch (error) { el('import-status').textContent = `Import rejected: ${(error as Error).message}`; } });
install(new EditorSession(validateBundle(orbit)));
let lastFrame = 0;
function tick(now: number) {
  if (playing && lastFrame) { session.execution.advance(Math.min((now - lastFrame) / 1000, 0.1) * Number(el<HTMLSelectElement>('warp').value)); render(); }
  lastFrame = now; requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
