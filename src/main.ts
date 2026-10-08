import './style.css';
import {StableLabels,type Label,type PlacedLabel} from './view/labels';
import freight from '../fixtures/model-sets/orison-freight.json';
import lunar from '../fixtures/model-sets/lunar-loop.json';
import seleneFreight from '../fixtures/model-sets/selene-freight.json';
import {bodyState} from './sim/dynamics';
import type {State} from './sim/schema';
import {displayPortState,portsOf, sampleVessel, setEvents, stockAt, type ModelSet, type SetEvent, type SetRun, type VesselRun} from './model-set/model';
import {transform} from './model-set/frames';

const sets = [freight, lunar, seleneFreight] as ModelSet[];
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
const number = (v: number) => v.toFixed(2);
document.body.innerHTML = `
<main>
  <header><h1>Orbital Logistics</h1><select id="set" aria-label="Model set">${sets.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><span id="load-status" role="status">Preparing scene…</span></header>
  <div class="workspace">
    <section class="scene" aria-label="Orbital viewer">
      <div class="view-tools"><label>Frame <select id="frame" aria-label="Reference frame"></select></label><button id="fit" title="Fit the scene (F)">Fit</button><details id="layers"><summary>Layers</summary><div class="layer-options">${['orbits', 'trails', 'plan', 'labels'].map(id => `<label><input type="checkbox" id="layer-${id}" checked>${id === 'plan' ? 'Selected route' : id[0].toUpperCase() + id.slice(1)}</label>`).join('')}<button id="clear-view" aria-pressed="false">Clear view</button></div></details><span id="frame-name"></span></div>
      <div class="viewport"><canvas id="space" tabindex="0" aria-label="Orbital traffic. Drag to pan, scroll to zoom, click a ship or station to inspect."></canvas></div>
      <div id="timelines" aria-label="Ship activity timelines"></div>
      <div class="transport"><button id="restart" title="Rewind">↤</button><button id="play" disabled>Play</button><select id="speed" aria-label="Playback speed"><option value="0.25">¼×</option><option value="1" selected>1×</option><option value="4">4×</option><option value="16">16×</option></select><input id="time" type="range" min="0" max="64" value="0" step="0.001" aria-label="Simulation time"><output id="clock">0.00</output><label class="replay"><input type="checkbox" id="replay" title="Rewind the prepared scene at the end">Replay</label></div>
    </section>
    <aside><div class="section-heading"><h2>Traffic</h2><span id="traffic-count"></span></div><div id="fleet"></div><div class="section-heading" id="station-heading"><h2>Stations</h2></div><div id="stations"></div><section id="inspector"></section><details id="model-details"><summary>About this set</summary><p id="description"></p><p id="provenance"></p><p>Drag to pan · Scroll to zoom · Space to pause · F to fit</p></details></aside>
  </div>
</main><div id="hit-menu" hidden></div><pre id="state-json" hidden></pre>`;

const canvas = $<HTMLCanvasElement>('space'), ctx = canvas.getContext('2d')!;
let run: SetRun | undefined, worker: Worker | undefined, revision = 0;
let events: SetEvent[] = [], selected = '', frame = 'inertial', t = 0, playing = false;
let ready = false, width = 900, height = 600, scale = 100, center: [number, number] = [0, 0];
let lastFrame = performance.now(), lastPanel = 0;
let layers = {orbits: true, trails: true, plan: true, labels: true};
let savedLayers = {...layers}, cleared = false;
let hits: {id: string; name: string; x: number; y: number}[] = [];
const labelLayout=new StableLabels();let placedLabels:PlacedLabel[]=[],hovered='';
const colors = {body: '#7893a4', station: '#c7d5de'};
function html(id: string, value: string) { if ($(id).innerHTML !== value) $(id).innerHTML = value; }
const end = () => {const s = run!.vessels[0].bundle.scenario; return s.epoch + s.duration;};
const start = () => run!.vessels[0].bundle.scenario.epoch;
const vessel = () => run?.vessels.find(v => v.bundle.scenario.ship.id === selected);
function project(y: State, time: number): [number, number] {
  const p = transform(run!, y, time, frame);
  return [width / 2 + (p[0] - center[0]) * scale, height / 2 - (p[1] - center[1]) * scale];
}
function fit() {
  if (!run) return;
  center = [0, 0];
  scale = Math.min(width, height) / (2 * run.extent * (frame === 'inertial' || frame === 'rotating' ? 1 : 1.8));
}
function seek(time: number, pause = true) {
  if (!ready) return;
  t = Math.max(start(), Math.min(end(), time));
  if (pause) playing = false;
  draw();
  updatePanels();
}
function eventLabel(e: SetEvent): string {
  const port = e.portId ?? '';
  if (e.kind === 'dock') return `Dock ${port}`;
  if (e.kind === 'undock') return `Depart ${port}`;
  if (e.kind === 'transfer-start') return `Service ${port}`;
  if (e.kind === 'transfer') return `${e.cargoAfter! < e.cargoBefore! ? 'Unload' : 'Load'} freight · ${port}`;
  return e.id.endsWith('capture') ? 'Arrival burn' : 'Departure burn';
}
function nextDock(v: VesselRun) { return events.find(e => e.vessel === v.bundle.scenario.ship.id && e.t > t + 1e-9 && e.kind === 'dock'); }
function status(v: VesselRun): string {
  const s = sampleVessel(v, t), l = s.logistics;
  if (l?.service) return `${l.service.cargo < 0 ? 'Unloading' : 'Loading'} · ${l.service.portId}`;
  if (l?.dockedPortId) return `Docked · ${l.dockedPortId}`;
  const dock = nextDock(v);
  return dock ? `En route · ${dock.portId}` : 'Free flight';
}
function select(id: string) { selected = id; $('hit-menu').hidden = true; updatePanels(); }
function buildTimeline() {
  $('timelines').innerHTML = run!.vessels.map(v => {
    const times = [...new Set([start(), end(), ...v.ledger.map(e => e.t)])].sort((a, b) => a - b);
    const blocks = times.slice(0, -1).map((a, i) => {
      const b = times[i + 1], state = sampleVessel(v, (a + b) / 2), l = state.logistics;
      const fill = l?.service ? '#e9c485' : l?.dockedPortId ? '#35434d' : v.color;
      return `<rect x="${1000 * (a - start()) / (end() - start())}" y="${l?.service ? 3 : 7}" width="${1000 * (b - a) / (end() - start())}" height="${l?.service ? 14 : 6}" fill="${fill}" opacity="${l?.dockedPortId && !l.service ? 0.8 : 0.65}"/>`;
    }).join('');
    const burns = v.ledger.filter(e => e.kind === 'burn').map(e => `<path d="M${1000 * (e.t - start()) / (end() - start())} 4v12" stroke="${v.color}" stroke-width="1"/>`).join('');
    return `<div class="timeline-row" data-vessel="${esc(v.name)}"><button class="timeline-name" data-select="${esc(v.bundle.scenario.ship.id)}" style="color:${v.color}">${esc(v.name)}</button><div class="timeline-track"><svg viewBox="0 0 1000 20" preserveAspectRatio="none" aria-label="${esc(v.name)} activity; colored spans are flight, gold is cargo service">${blocks}${burns}</svg><span class="time-cursor"></span><button class="timeline-seek" aria-label="Scrub ${esc(v.name)} timeline"></button></div></div>`;
  }).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(b => b.onclick = () => select(b.dataset.select!));
  document.querySelectorAll<HTMLButtonElement>('.timeline-seek').forEach(b => b.onclick = e => {
    const rect = b.getBoundingClientRect(); seek(start() + (e.clientX - rect.left) / rect.width * (end() - start()));
  });
}
function fuelChart(v: VesselRun): string {
  const path = (get: (s: typeof v.samples[number]) => number, max: number) => {
    const points = v.samples.filter((s, i) => i === 0 || i === v.samples.length - 1 || get(s) !== get(v.samples[i - 1]));
    return points.map((s, i) => {
      const x = 4 + (s.t - start()) / (end() - start()) * 232, y = 64 - Math.min(1, get(s) / Math.max(max, 1e-12)) * 54;
      return i ? `H${x}V${y}` : `M${x},${y}`;
    }).join(' ');
  };
  return `<div class="chart-key"><span>Fuel</span><span>Freight</span></div><svg class="budget-chart" viewBox="0 0 240 72" role="img" aria-label="Fuel and freight over the scene"><path d="M4 64H236" stroke="#33414b"/><path d="${path(s => s.propellant, v.bundle.scenario.ship.tankCapacity)}" fill="none" stroke="#78c9c0" stroke-width="1.5"/><path d="${path(s => s.logistics?.cargoMass ?? v.bundle.scenario.ship.cargoMass, v.bundle.scenario.logistics?.cargoCapacity ?? 1)}" fill="none" stroke="#efb878" stroke-width="1.5"/><path class="budget-cursor" d="M0 5V66" stroke="#c7d5de" stroke-opacity="0.6"/></svg>`;
}
let inspectorKey = '';
function updatePanels() {
  if (!run || !ready) return;
  $<HTMLButtonElement>('play').textContent = playing ? 'Pause' : 'Play';
  $<HTMLInputElement>('time').value = String(t);
  $('clock').textContent = `${number(t)} / ${number(end())}`;
  $('load-status').textContent = t === end() ? 'End of scene' : '';
  html('fleet', run.vessels.map(v => `<button class="object-row ${selected === v.bundle.scenario.ship.id ? 'selected' : ''}" data-object="${esc(v.bundle.scenario.ship.id)}"><i style="background:${v.color}"></i><span><strong>${esc(v.name)}</strong><small>${esc(status(v))}</small></span></button>`).join(''));
  const stocks = stockAt(run, t);
  $('station-heading').hidden = !run.stations.length;
  $('stations').hidden = !run.stations.length;
  html('stations', run.stations.length ? run.stations.map(station => {
    const stock = stocks.find(s => s.id === station.id)!;
    return `<button class="object-row ${selected === station.id ? 'selected' : ''}" data-object="${esc(station.id)}"><i class="station-dot"></i><span><strong>${esc(station.id)}</strong></span><span class="berths">${stock.occupied}/${station.berths}</span></button>`;
  }).join('') : '');
  document.querySelectorAll<HTMLButtonElement>('[data-object]').forEach(b => b.onclick = () => select(b.dataset.object!));
  const v = vessel(), key = run.id + ':' + selected;
  if (key !== inspectorKey) {
    inspectorKey = key;
    const heading = v?.name ?? selected;
    $('inspector').innerHTML = `<div class="section-heading"><h2>${esc(heading)}</h2><button id="object-frame">View from here</button></div><p id="object-status"></p><dl id="readouts"></dl><button id="next-event" class="next-event"></button>${v ? fuelChart(v) : ''}<details id="schedule"><summary>Schedule</summary><div id="event-list"></div></details>`;
    $('object-frame').onclick = () => { frame = selected; $<HTMLSelectElement>('frame').value = frame; fit(); updatePanels(); };
  }
  let upcoming: SetEvent | undefined;
  if (v) {
    const s = sampleVessel(v, t), cargo = s.logistics?.cargoMass ?? v.bundle.scenario.ship.cargoMass;
    $('object-status').textContent = status(v);
    const used = v.ledger.filter(e => e.t <= t).reduce((sum, e) => sum + e.fuelUsed, 0);
    $('readouts').innerHTML = `<div><dt>${esc(v.cargo)}</dt><dd>${number(cargo)} / ${number(v.bundle.scenario.logistics?.cargoCapacity ?? cargo)}</dd></div><div><dt>Propellant</dt><dd>${number(s.propellant)} / ${number(v.bundle.scenario.ship.tankCapacity)}</dd></div><div><dt>Fuel used</dt><dd>${number(used)}</dd></div>`;
    const local=transform(run,s.y,t,frame);
    if(Math.abs(local[2])+Math.abs(local[5])>1e-9)$('readouts').innerHTML+=`<div><dt>Depth</dt><dd>${number(local[2])}</dd></div><div><dt>Vertical velocity</dt><dd>${number(local[5])}</dd></div>`;
    const cursor = document.querySelector<SVGPathElement>('.budget-cursor');
    cursor?.setAttribute('transform', `translate(${4 + (t - start()) / (end() - start()) * 232},0)`);
    upcoming = events.find(e => e.vessel === selected && e.t > t + 1e-9 && e.kind !== 'burn');
  } else {
    const station = run.stations.find(s => s.id === selected), stock = stocks.find(s => s.id === selected);
    const body = run.vessels[0].bundle.scenario.bodies.find(b => b.id === selected);
    $('object-status').textContent = station?.role ?? 'Gravity source';
    $('readouts').innerHTML = stock ? `<div><dt>Freight stock</dt><dd>${number(stock.cargo)}</dd></div><div><dt>Propellant stock</dt><dd>${number(stock.propellant)}</dd></div><div><dt>Berths</dt><dd>${stock.occupied} / ${station!.berths}</dd></div>` : `<div><dt>Gravitational μ</dt><dd>${number(body!.mu)}</dd></div>`;
    upcoming = events.find(e => e.portId === selected && e.t > t + 1e-9 && e.kind === 'dock');
  }
  $('next-event').hidden = !upcoming;
  if (upcoming) {
    const e = upcoming;
    $('next-event').textContent = `${eventLabel(e)} · ${number(e.t)} →`;
    $('next-event').onclick = () => seek(e.t);
  }
  const relevant = events.filter(e => (v ? e.vessel === selected : e.portId === selected) && e.kind !== 'burn' && e.kind !== 'transfer-start');
  $('schedule').hidden = !relevant.length;
  html('event-list', relevant.map(e => `<button data-time="${e.t}" class="event ${e.t <= t ? 'past' : ''}"><span>${number(e.t)}</span>${esc(eventLabel(e))}</button>`).join(''));
  document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(b => b.onclick = () => seek(Number(b.dataset.time)));
  const percent = (t - start()) / (end() - start()) * 100;
  document.querySelectorAll<HTMLElement>('.time-cursor').forEach(c => c.style.left = `${percent}%`);
  document.querySelectorAll<HTMLElement>('.timeline-row').forEach(r => r.classList.toggle('selected', r.dataset.vessel === v?.name));
  $('frame-name').textContent = $<HTMLSelectElement>('frame').selectedOptions[0]?.textContent ?? '';
  publishState();
}
function publishState() {
  $('state-json').textContent = JSON.stringify({ready, revision, set: run?.id, t, playing, frame, selected, layers,
    ships: run?.vessels.map(v => ({id: v.bundle.scenario.ship.id, ...sampleVessel(v, t), screen: project(sampleVessel(v, t).y, t)})),
    labels:placedLabels.map(({id,anchor,alpha,left,top})=>({id,anchor,alpha,left,top})),
    stocks: run ? stockAt(run, t) : [], events, camera: {center, scale}, hits});
}
function loadSet(id: string) {
  const set = sets.find(s => s.id === id)!;
  labelLayout.reset();placedLabels=[];hovered='';
  worker?.terminate(); revision++; ready = false; playing = false; run = undefined; t = 0; inspectorKey = '';
  $('load-status').textContent = 'Preparing scene…';
  $<HTMLButtonElement>('play').disabled = true; $('fleet').innerHTML = ''; $('stations').innerHTML = ''; $('inspector').innerHTML = ''; $('timelines').innerHTML = '';
  $('state-json').textContent = JSON.stringify({ready, revision});
  worker = new Worker(new URL('./model-set/prepare.worker.ts', import.meta.url), {type: 'module'});
  const currentRevision = revision;
  worker.onmessage = (e: MessageEvent<{revision: number; run?: SetRun; error?: string}>) => {
    if (e.data.revision !== revision || currentRevision !== revision) return;
    if (e.data.error) { $('load-status').textContent = e.data.error; return; }
    run = e.data.run!; events = setEvents(run); ready = true; selected = run.vessels[0].bundle.scenario.ship.id;
    frame = 'inertial'; t = run.id === 'orison-freight' ? 2 : 0; playing = true;
    $<HTMLInputElement>('time').min = String(start()); $<HTMLInputElement>('time').max = String(end());
    $('frame').innerHTML = `<option value="inertial">Inertial</option><option value="rotating">${esc(run.rotating.name)}</option>` +
      [...run.vessels[0].bundle.scenario.bodies.map(b => [b.id, b.id]), ...run.stations.map(s => [s.id, s.id]), ...run.vessels.map(v => [v.bundle.scenario.ship.id, v.name])].map(([id, name]) => `<option value="${esc(id)}">${esc(name)} centered</option>`).join('');
    $('description').textContent = run.description; $('provenance').textContent = run.provenance;
    $('traffic-count').textContent = String(run.vessels.length);
    $<HTMLButtonElement>('play').disabled = false; fit(); buildTimeline(); updatePanels();
    worker?.terminate(); worker = undefined;
  };
  worker.onerror = () => { if (currentRevision === revision) $('load-status').textContent = 'Could not prepare this scene'; };
  worker.postMessage({revision, set});
}

function path(points: [number, number][], color: string, lineWidth = 1, alpha = 1, dash: number[] = []) {
  if (!points.length) return;
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.globalAlpha = alpha; ctx.setLineDash(dash);
  points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
}
function draw() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0c141d'; ctx.fillRect(0, 0, width, height);
  // Quiet schematic background; no decorative planetary rendering.
  ctx.fillStyle = '#7e98aa';
  for (let i = 0; i < 65; i++) { ctx.globalAlpha = 0.12 + (i % 4) * 0.035; ctx.fillRect((i * 313.47) % width, (i * 137.33) % height, 1, 1); }
  ctx.globalAlpha = 1;
  if (!run || !ready) return;
  hits = [];
  const scenario = run.vessels[0].bundle.scenario;
  const labelRequests:Label[]=[];
  if (layers.orbits) {
    const orbitEpochs = (period: number) => {
      const duration = Math.min(period, end() - start());
      const first = Math.max(start(), Math.min(t - duration / 2, end() - duration));
      return Array.from({length: 161}, (_, i) => first + duration * i / 160);
    };
    for (const port of portsOf(run)) {
      if(port.rail.kind==='ballistic'){path(run.portSamples[port.id].filter(s=>Math.abs(s.t-t)<3).map(s=>project(s.y,s.t)),'#647c8d',.8,.3);continue;}
      const period = 2 * Math.PI / port.rail.rate;
      path(orbitEpochs(period).map(epoch => project(displayPortState(port,run!.portSamples,epoch), epoch)), '#647c8d', 0.8, 0.3);
    }
    for (const body of scenario.bodies.filter(b => b.rail.kind === 'circular')) {
      const rail = body.rail as Extract<typeof body.rail, {kind: 'circular'}>, period = 2 * Math.PI / Math.abs(rail.rate);
      path(orbitEpochs(period).map(epoch => project(bodyState(body, epoch), epoch)), '#647c8d', 0.8, 0.2);
    }
  }
  for (const v of run.vessels) {
    const id = v.bundle.scenario.ship.id, isSelected = id === selected;
    if (layers.trails) {
      const trailStart = Math.max(start(), t - (run.id === 'lunar-loop' ? 9 : 12));
      let prev: [number, number] | undefined;
      for (const sample of v.samples) {
        if (sample.t < trailStart || sample.t > t) continue;
        const p = project(sample.y, sample.t);
        if (prev) path([prev, p], v.color, isSelected ? 1.7 : 1.1, (isSelected ? 0.7 : 0.4) * Math.exp(-(t - sample.t) / 4));
        prev = p;
      }
      if (prev) path([prev, project(sampleVessel(v, t).y, t)], v.color, 1.5, 0.75);
    }
    if (layers.plan && isSelected) {
      const stop = nextDock(v)?.t ?? Math.min(end(), t + (run.id === 'lunar-loop' ? 5.58 : 8));
      path([project(sampleVessel(v, t).y, t), ...v.samples.filter(s => s.t > t && s.t <= stop).map(s => project(s.y, s.t))], '#b5bdc7', 1, 0.28, [3, 5]);
    }
  }
  function label(id: string, text: string, x: number, y: number, color: string) {
    if (!layers.labels) return;
    ctx.font='11px ui-sans-serif, system-ui';
    labelRequests.push({id,text,x,y,color,width:ctx.measureText(text).width,priority:id===selected?100:id===hovered?90:0});
  }
  for (const body of scenario.bodies) {
    const p = project(bodyState(body, t), t), r = Math.max(7, body.radius * scale);
    ctx.beginPath(); ctx.arc(...p, r, 0, Math.PI * 2); ctx.fillStyle = '#192a37'; ctx.fill(); ctx.strokeStyle = '#445c6e'; ctx.lineWidth = 1; ctx.stroke();
    if (selected === body.id) { ctx.beginPath(); ctx.arc(...p, r + 5, 0, Math.PI * 2); ctx.strokeStyle = '#b2c6d2'; ctx.stroke(); }
    label(body.id, body.id === 'primary' ? 'Planet' : body.id === 'moon' ? 'Selene' : body.id, p[0] + r, p[1], colors.body);
    hits.push({id: body.id, name: body.id, x: p[0], y: p[1]});
  }
  for (const port of portsOf(run)) {
    const p = project(displayPortState(port,run.portSamples,t), t);
    ctx.save(); ctx.translate(...p); ctx.rotate(Math.PI / 4); ctx.strokeStyle = colors.station; ctx.lineWidth = 1.2; ctx.strokeRect(-4, -4, 8, 8); ctx.restore();
    if (selected === port.id) { ctx.beginPath(); ctx.arc(...p, 10, 0, Math.PI * 2); ctx.strokeStyle = '#c7d5de'; ctx.stroke(); }
    label(port.id, port.id, ...p, '#a7bac7'); hits.push({id: port.id, name: port.id, x: p[0], y: p[1]});
  }
  for (const v of run.vessels) {
    const state = sampleVessel(v, t), p = project(state.y, t), transformed = transform(run, state.y, t, frame);
    const angle = Math.hypot(transformed[3],transformed[4]) > 1e-10 ? Math.atan2(-transformed[4], transformed[3]) : 0;
    ctx.save(); ctx.translate(...p); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -3.5); ctx.lineTo(-2, 0); ctx.lineTo(-4, 3.5); ctx.closePath(); ctx.fillStyle = v.color; ctx.fill(); ctx.restore();
    if (selected === v.bundle.scenario.ship.id) { ctx.beginPath(); ctx.arc(...p, 11, 0, Math.PI * 2); ctx.strokeStyle = v.color; ctx.globalAlpha = 0.65; ctx.stroke(); ctx.globalAlpha = 1; }
    if (!state.logistics?.dockedPortId || selected===v.bundle.scenario.ship.id) label(v.bundle.scenario.ship.id, v.name, ...p, v.color);
    hits.push({id: v.bundle.scenario.ship.id, name: v.name, x: p[0], y: p[1]});
  }
  placedLabels=labelLayout.layout(labelRequests,performance.now());
  ctx.font='11px ui-sans-serif, system-ui';
  for(const l of placedLabels){ctx.globalAlpha=l.alpha;ctx.fillStyle=l.color;ctx.fillText(l.text,l.left,l.top);}
  ctx.globalAlpha=1;
  ctx.fillStyle = '#4c6477'; ctx.font = '10px ui-monospace, monospace';
  const unit = 10 ** Math.floor(Math.log10(80 / scale));
  const bar = unit * scale; ctx.fillRect(20, height - 22, bar, 1); ctx.fillText(`${unit} u`, 20, height - 29);
}

$<HTMLSelectElement>('set').onchange = e => loadSet((e.target as HTMLSelectElement).value);
$<HTMLSelectElement>('frame').onchange = e => { frame = (e.target as HTMLSelectElement).value; fit(); updatePanels(); };
$('fit').onclick = fit;
$('play').onclick = () => { if (!ready) return; if (t >= end()) t = start(); playing = !playing; updatePanels(); };
$('restart').onclick = () => { if (ready) seek(start()); };
$<HTMLInputElement>('time').oninput = e => seek(Number((e.target as HTMLInputElement).value));
for (const key of Object.keys(layers) as (keyof typeof layers)[]) {
  $<HTMLInputElement>(`layer-${key}`).onchange = e => { layers[key] = (e.target as HTMLInputElement).checked; cleared = false; $('clear-view').setAttribute('aria-pressed', 'false'); updatePanels(); };
}
$('clear-view').onclick = () => {
  if (!cleared) {savedLayers = {...layers}; layers = {orbits: false, trails: false, plan: false, labels: false};}
  else layers = {...savedLayers};
  cleared = !cleared; $('clear-view').setAttribute('aria-pressed', String(cleared));
  for (const key of Object.keys(layers) as (keyof typeof layers)[]) $<HTMLInputElement>(`layer-${key}`).checked = layers[key];
  updatePanels();
};
new ResizeObserver(() => {
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  width = rect.width; height = rect.height; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fit();
}).observe(canvas);
let drag: {x: number; y: number; center: [number, number]; moved: boolean} | undefined;
canvas.onpointerdown = e => { canvas.focus(); canvas.setPointerCapture(e.pointerId); drag = {x: e.clientX, y: e.clientY, center: [...center], moved: false}; $('hit-menu').hidden = true; };
canvas.onpointermove = e => {
  if (!drag) {
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    hovered=hits.find(h=>Math.hypot(h.x-x,h.y-y)<14)?.id??'';return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved ||= Math.hypot(dx, dy) > 4;
  if (drag.moved) center = [drag.center[0] - dx / scale, drag.center[1] + dy / scale];
};
canvas.onpointerup = e => {
  if (!drag) return;
  const moved = drag.moved; drag = undefined;
  if (moved) return;
  const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
  const found = hits.filter(h => Math.hypot(h.x - x, h.y - y) < 14);
  if (found.length === 1) select(found[0].id);
  else if (found.length > 1) {
    const menu = $('hit-menu'); menu.innerHTML = found.map(h => `<button data-hit="${esc(h.id)}">${esc(h.name)}</button>`).join(''); menu.hidden = false;
    menu.style.left = `${Math.max(8, Math.min(e.clientX, window.innerWidth - 180))}px`;
    menu.style.top = `${Math.max(8, Math.min(e.clientY, window.innerHeight - found.length * 40 - 16))}px`;
    menu.querySelectorAll<HTMLButtonElement>('[data-hit]').forEach(b => b.onclick = () => select(b.dataset.hit!));
  }
};
canvas.onpointerleave=()=>{hovered='';};
canvas.onpointercancel = () => {drag = undefined;};
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left - width / 2, y = height / 2 - (e.clientY - rect.top);
  const before: [number, number] = [center[0] + x / scale, center[1] + y / scale];
  scale = Math.max(20, Math.min(5000, scale * Math.exp(-e.deltaY * 0.0015)));
  center = [before[0] - x / scale, before[1] - y / scale];
}, {passive: false});
document.addEventListener('pointerdown', e => { if (!canvas.contains(e.target as Node) && !$('hit-menu').contains(e.target as Node)) $('hit-menu').hidden = true; });
document.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).matches('input, select, button, summary')) return;
  if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
  if (e.key.toLowerCase() === 'f') fit();
  if (e.key === 'Escape') $('hit-menu').hidden = true;
});
function animate(now: number) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  if (ready && playing) {
    t = Math.min(end(), t + dt * Number($<HTMLSelectElement>('speed').value));
    if (t >= end()) { if ($<HTMLInputElement>('replay').checked) t = start(); else playing = false; }
  }
  draw();
  if (ready && now - lastPanel > 100) { updatePanels(); lastPanel = now; }
  requestAnimationFrame(animate);
}
loadSet(sets[0].id); requestAnimationFrame(animate);
