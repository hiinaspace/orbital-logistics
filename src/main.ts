import './style.css';
import fixture from '../spikes/numerics/encounter-samples.json';

type Sample = typeof fixture.baseline[number];
type Frame = 'inertial' | 'planet' | 'moon';
document.body.innerHTML = `
  <main>
    <header><p class="eyebrow">ORBITAL LOGISTICS / PLANNING SPIKE</p>
    <h1>One encounter. One small burn.</h1>
    <p class="intro">Inspect a prepared numerical fixture in two forms: a coast and a small impulse before the moon pass. This read-only diagnostic precedes the CoaDE-inspired manual editor.</p></header>
    <div class="controls"><label>View frame <select id="frame"><option value="inertial">Inertial overview</option><option value="planet">Planet centered</option><option value="moon">Moon centered</option></select></label>
    <label class="scrub">Preview epoch <input id="epoch" type="range" min="0" max="600" value="250"><output id="time"></output></label></div>
    <section class="scene"><canvas width="960" height="560" aria-label="Numerical encounter fixture"></canvas></section>
    <footer><span><i class="key baseline"></i> Coast <i class="key edited"></i> Edited: Δv = 0.01803</span><span id="status" role="status">Checking browser worker…</span></footer>
    <p id="readout"></p>
    <p class="boundary">Retained RK4 samples · normalized units · nonrotating view frames. The impulse at t = 1.137 is a fixture-authoring experiment, not a player solution. This viewer does not propagate live, edit maneuvers, or demonstrate a beneficial gravity assist.</p>
  </main>`;
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
const frameSelect = document.querySelector<HTMLSelectElement>('#frame')!;
const epoch = document.querySelector<HTMLInputElement>('#epoch')!;
function origin(sample: Sample, frame: Frame) {
  return frame === 'inertial' ? [0, 0] : sample[frame];
}
function relative(sample: Sample, object: 'ship' | 'planet' | 'moon', frame: Frame) {
  const o = origin(sample, frame);
  return [sample[object][0] - o[0], sample[object][1] - o[1]];
}
function draw() {
  const frame = frameSelect.value as Frame;
  const index = Number(epoch.value);
  const base = fixture.baseline[index];
  const edited = fixture.edited[index];
  const points = [...fixture.baseline, ...fixture.edited].flatMap(sample =>
    (['ship', 'planet', 'moon'] as const).map(object => relative(sample, object, frame)));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const loX = Math.min(...xs), hiX = Math.max(...xs), loY = Math.min(...ys), hiY = Math.max(...ys);
  const scale = Math.min(840 / (hiX - loX || 1), 440 / (hiY - loY || 1));
  const map = (point: number[]) => [480 + (point[0] - (hiX + loX) / 2) * scale, 280 - (point[1] - (hiY + loY) / 2) * scale];
  ctx.fillStyle = '#111923'; ctx.fillRect(0, 0, 960, 560);
  ctx.strokeStyle = '#1b2a36'; ctx.lineWidth = 1;
  for (let x = 0; x < 960; x += 40) {ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 560); ctx.stroke();}
  for (let y = 0; y < 560; y += 40) {ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke();}
  function path(samples: Sample[], object: 'ship' | 'planet' | 'moon', color: string, width: number) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
    samples.forEach((sample, i) => {const p = map(relative(sample, object, frame)); if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);}); ctx.stroke();
  }
  path(fixture.baseline, 'moon', '#516779', 1);
  path(fixture.baseline, 'ship', '#8da7bc', 1.5);
  path(fixture.edited, 'ship', '#edbc74', 2);
  function dot(sample: Sample, object: 'ship' | 'planet' | 'moon', color: string, radius: number, label: string) {
    const p = map(relative(sample, object, frame)); ctx.beginPath();ctx.fillStyle = color;
    ctx.arc(p[0], p[1], radius, 0, 2 * Math.PI);ctx.fill();ctx.font = '12px system-ui';ctx.fillText(label, p[0]+radius+7, p[1]-7);
  }
  dot(base, 'planet', '#80c4c0', Math.max(3, fixture.meta.planetRadius*scale), 'Planet');
  dot(base, 'moon', '#c8d5df', Math.max(3, fixture.meta.moonRadius*scale), 'Moon');
  dot(base, 'ship', '#8da7bc', 4, 'Coast');dot(edited, 'ship', '#edbc74', 4, 'Edited');
  const burn = fixture.edited[Math.round(fixture.meta.burn.t*100)];
  const p = map(relative(burn, 'ship', frame));ctx.strokeStyle='#edbc74';ctx.lineWidth=1;
  ctx.strokeRect(p[0]-5, p[1]-5, 10, 10);
  ctx.fillStyle = '#91a8b8';ctx.fillText('Burn near t = 1.137', p[0]+12, p[1]+18);
  const miss = (sample: Sample) => Math.hypot(sample.ship[0]-sample.moon[0],sample.ship[1]-sample.moon[1]);
  document.querySelector('#time')!.textContent = `t = ${base.t.toFixed(2)}`;
  document.querySelector('#readout')!.textContent = `At preview epoch: moon-center distance ${miss(base).toFixed(4)} (coast) / ${miss(edited).toFixed(4)} (edited). Body radii have a 3 px visibility minimum.`;
}
frameSelect.addEventListener('change', draw);epoch.addEventListener('input', draw);draw();
const worker = new Worker(new URL('./probe.worker.ts', import.meta.url), {type:'module'});
worker.onmessage = ({data}) => {document.querySelector('#status')!.textContent = data;worker.terminate();};
worker.onerror = () => {document.querySelector('#status')!.textContent = 'Worker failed';worker.terminate();};
worker.postMessage('probe');
