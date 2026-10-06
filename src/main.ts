import './style.css';
import circular from '../fixtures/m0-circular.json';
import impulse from '../fixtures/m0-impulse.json';
import { Runner, type Sample } from './sim/runner';
import { bodyState } from './sim/dynamics';
import { validateBundle, type Bundle } from './sim/schema';

document.body.innerHTML = `
  <main>
    <header><p class="eyebrow">ORBITAL LOGISTICS <span> / M0 · NUMERICAL SKETCH</span></p>
    <h1>A small orbit, running for real.</h1>
    <p class="intro">Follow one ship around a fixed primary. Coast, or execute a prepared impulse and watch the orbit open. Playback uses the same simulation as the predicted path.</p></header>
    <div class="workspace">
      <section class="scene" aria-label="Orbital viewport">
        <div class="scene-bar"><span>INERTIAL · NONROTATING</span><span id="scene-mode"></span></div>
        <canvas width="1000" height="650" aria-label="Live ship and predicted trajectory"></canvas>
        <div class="legend"><span><i class="key past"></i> Executed</span><span><i class="key future"></i> Predicted path</span><span>Body surface drawn to scale</span></div>
      </section>
      <aside>
        <p class="eyebrow">EXECUTABLE FIXTURE</p>
        <label>Program<select id="program"><option value="coast">Circular coast</option><option value="impulse">One transverse impulse</option></select></label>
        <p id="program-note" class="note"></p>
        <dl><div><dt>Execution epoch</dt><dd id="time"></dd></div><div><dt>Surface altitude</dt><dd id="altitude"></dd></div><div><dt>Speed</dt><dd id="speed"></dd></div><div><dt>Propellant remaining</dt><dd id="fuel"></dd></div><div><dt>Executed Δv</dt><dd id="dv"></dd></div></dl>
        <p id="status" role="status"></p>
        <div id="ledger" class="note"></div>
        <p id="units" class="note"></p>
      </aside>
    </div>
    <section class="transport" aria-label="Playback controls">
      <div class="buttons"><button id="play">Play</button><button id="step">Advance +0.25</button><button id="reset">Reset</button>
        <label>Playback<select id="warp"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="4">4×</option><option value="16">16×</option></select></label>
      </div>
      <label class="scrub">Replay / seek <input id="epoch" type="range" min="0" max="16" step="0.001" value="0"><output id="seek-time"></output></label>
      <p class="note">Seeking replays the saved program. Playback speed changes how much simulation time passes; the physics step stays fixed.</p>
    </section>
    <details><summary>Save / load scenario and program</summary>
      <p class="note">JSON includes model and unit metadata, the maneuver program, and a replay-validated execution snapshot. A failed import leaves the current run intact.</p>
      <div class="buttons"><button id="save">Save current run to JSON</button><button id="download">Download JSON</button><button id="load">Load JSON</button></div>
      <textarea id="json" aria-label="Scenario and program JSON" spellcheck="false"></textarea><p id="import-status" role="status"></p>
    </details>
    <details><summary>Numerical state</summary><pre id="state-json"></pre></details>
    <p class="boundary">M0 executable sketch · instantaneous impulses in a named radial / positive-CCW transverse basis · fuel charged from pre-burn mass. Near-surface propagation stops when clearance cannot be certified. Manual maneuver editing is the next milestone.</p>
  </main>`;

function element<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const canvas = document.querySelector('canvas')!, ctx = canvas.getContext('2d')!;
const program = element<HTMLSelectElement>('program'), slider = element<HTMLInputElement>('epoch');
const json = element<HTMLTextAreaElement>('json'), play = element<HTMLButtonElement>('play');
let runner: Runner, prediction: Sample[] = [], markers: { t: number; y: number[] }[] = [], playing = false;
let bundle: Bundle, center: [number, number] = [0, 0], scale = 180;
function setPlaying(value: boolean) { playing = value; play.textContent = value ? 'Pause' : 'Play'; }

function install(next: Runner) {
  const nextBundle = next.bundle, forecast = new Runner(nextBundle), s = nextBundle.scenario;
  const nextPrediction: Sample[] = [];
  for (let i = 0; i <= 800; i++) {
    const sample = forecast.advanceTo(s.epoch + s.duration * i / 800);
    nextPrediction.push(sample); if (sample.status !== 'running') break;
  }
  const nextMarkers = nextBundle.program.burns.map(b => forecast.sample(b.t)).filter((p, i) => p.t === nextBundle.program.burns[i].t);
  // Build the replacement forecast before making the import authoritative.
  runner = next; bundle = nextBundle; prediction = nextPrediction; markers = nextMarkers; setPlaying(false);
  const xs = prediction.map(p => p.y[0]), ys = prediction.map(p => p.y[1]);
  for (const body of s.bodies) {
    const b = bodyState(body, s.epoch); xs.push(b[0] - body.radius, b[0] + body.radius); ys.push(b[1] - body.radius, b[1] + body.radius);
  }
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  center = [(minX + maxX) / 2, (minY + maxY) / 2];
  scale = Math.min(780 / Math.max(maxX - minX, 0.1), 470 / Math.max(maxY - minY, 0.1));
  slider.min = String(s.epoch); slider.max = String(s.epoch + s.duration);
  program.value = bundle.program.id === impulse.id ? 'impulse' : bundle.program.id === circular.program.id ? 'coast' : '';
  element('program-note').textContent = bundle.program.burns.length ? bundle.program.burns.map(b =>
    `${b.id}: t = ${b.t}, radial ${b.radial}, transverse ${b.transverse}; ${b.referenceBodyId} reference.`).join(' ') : 'No maneuvers. The initial fixture’s circular period is approximately 6.283 time units.';
  element('units').textContent = `Units: length = ${s.units.length}; time = ${s.units.time}; mass = ${s.units.mass}. Dry mass ${s.ship.dryMass}; cargo ${s.ship.cargoMass}; exhaust velocity ${s.ship.exhaustVelocity}. Physics step ${s.policy.step}.`;
  json.value = runner.serialize(); render();
}
function map(y: number[]): [number, number] { return [500 + (y[0] - center[0]) * scale, 325 - (y[1] - center[1]) * scale]; }
function render() {
  const current = runner.current, s = bundle.scenario;
  if (current.status !== 'running') setPlaying(false);
  const relative = bodyState(s.bodies[0], current.t);
  const altitude = Math.hypot(current.y[0] - relative[0], current.y[1] - relative[1]) - s.bodies[0].radius;
  element('time').textContent = current.t.toFixed(3); element('seek-time').textContent = current.t.toFixed(3); slider.value = String(current.t);
  element('altitude').textContent = altitude.toFixed(5);
  element('speed').textContent = Math.hypot(current.y[2], current.y[3]).toFixed(5);
  element('fuel').textContent = current.propellant.toFixed(6);
  const ledger = runner.ledger;
  element('dv').textContent = ledger.reduce((sum, e) => sum + (e.kind === 'burn' ? e.deltaV : 0), 0).toFixed(5);
  element('ledger').textContent = ledger.length ? ledger.map(e =>
    `${e.kind} · ${e.id} · t ${e.t.toFixed(3)} · fuel ${e.fuelUsed.toFixed(6)}`).join('\n') : 'No execution events yet.';
  element('status').textContent = `${current.status === 'running' ? (playing ? 'Running' : 'Paused') : current.status}${current.detail ? ` · ${current.detail}` : ''}`;
  element('scene-mode').textContent = playing ? 'LIVE EXECUTION' : 'PAUSED EXECUTION';
  element('state-json').textContent = JSON.stringify({ ...current, ledger }, null, 2);
  ctx.fillStyle = '#101923'; ctx.fillRect(0, 0, 1000, 650); ctx.strokeStyle = '#1b2935'; ctx.lineWidth = 1;
  for (let x = 20; x < 1000; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 650); ctx.stroke(); }
  for (let y = 25; y < 650; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1000, y); ctx.stroke(); }
  ctx.beginPath(); ctx.strokeStyle = '#617c90'; ctx.lineWidth = 2;
  prediction.forEach((sample, i) => { const p = map(sample.y); if (i === 0) ctx.moveTo(...p); else ctx.lineTo(...p); }); ctx.stroke();
  ctx.beginPath(); ctx.strokeStyle = '#edbc74'; ctx.lineWidth = 3;
  prediction.filter(p => p.t <= current.t).forEach((sample, i) => { const p = map(sample.y); if (i === 0) ctx.moveTo(...p); else ctx.lineTo(...p); });
  ctx.lineTo(...map(current.y)); ctx.stroke();
  for (const body of s.bodies) {
    const p = map(bodyState(body, current.t)); ctx.beginPath(); ctx.fillStyle = '#70aaa8'; ctx.arc(...p, body.radius * scale, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#94b7ba'; ctx.font = '14px system-ui'; ctx.fillText(body.id, p[0] + body.radius * scale + 10, p[1] + 5);
  }
  for (const marker of markers) {
    const p = map(marker.y); ctx.strokeStyle = '#edbc74'; ctx.lineWidth = 2;
    ctx.strokeRect(p[0] - 6, p[1] - 6, 12, 12); ctx.fillStyle = '#edbc74'; ctx.font = '13px system-ui'; ctx.fillText(`Impulse · t ${marker.t}`, p[0] + 14, p[1] - 12);
  }
  const ship = map(current.y); ctx.beginPath(); ctx.fillStyle = '#fff0d6'; ctx.arc(...ship, 5, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = '#fff0d6'; ctx.font = '14px system-ui'; ctx.fillText('Ship', ship[0] + 12, ship[1] + 5);
}
program.addEventListener('change', () => install(new Runner(validateBundle({ ...circular,
  program: program.value === 'impulse' ? impulse : circular.program }))));
play.addEventListener('click', () => { if (runner.current.status !== 'running') runner.reset(); setPlaying(!playing); render(); });
element('step').addEventListener('click', () => { setPlaying(false); runner.advance(0.25); render(); });
element('reset').addEventListener('click', () => { setPlaying(false); runner.reset(); render(); });
slider.addEventListener('input', () => { setPlaying(false); runner.seek(Number(slider.value)); render(); });
element('save').addEventListener('click', () => { json.value = runner.serialize(); element('import-status').textContent = 'Current execution saved to JSON.'; });
element('download').addEventListener('click', () => {
  const blob = new Blob([runner.serialize()], { type: 'application/json' }), url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'orbital-logistics-run.json'; a.click(); URL.revokeObjectURL(url);
});
element('load').addEventListener('click', () => {
  try { const next = Runner.deserialize(json.value); install(next); element('import-status').textContent = 'Loaded and replay-validated.'; }
  catch (error) { element('import-status').textContent = `Import rejected: ${(error as Error).message}`; }
});
install(new Runner(validateBundle(circular)));
let lastFrame = 0;
function tick(now: number) {
  if (playing && lastFrame) { runner.advance(Math.min((now - lastFrame) / 1000, 0.1) * Number(element<HTMLSelectElement>('warp').value)); render(); }
  lastFrame = now; requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
