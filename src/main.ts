import './style.css';
import PrepareWorker from './model-set/prepare.worker?worker&inline';
import TrafficWorker from './traffic/traffic.worker?worker&inline';
import {StableLabels,type Label,type PlacedLabel} from './view/labels';
import freight from '../fixtures/model-sets/orison-freight.json';
import lunar from '../fixtures/model-sets/lunar-loop.json';
import seleneFreight from '../fixtures/model-sets/selene-freight.json';
import selenePowered from '../fixtures/model-sets/selene-powered.json';
import orisonPowered from '../fixtures/model-sets/orison-powered.json';
import surfaceAscent from '../fixtures/model-sets/selene-ascent.json';
import surfaceReturn from '../fixtures/model-sets/selene-return.json';
import trafficDefinition from '../fixtures/traffic/orison-service.json';
import surfaceService from '../fixtures/traffic/selene-service.json';
import {TrafficViewStore} from './traffic/view';
import type {TrafficDefinition} from './traffic/planner';
import type {TrafficDelta} from './traffic/engine';
import {bodyState} from './sim/dynamics';
import type {State} from './sim/schema';
import {displayPortState,portsOf, sampleVessel, setEvents, stockAt, type ModelSet, type SetEvent, type SceneView, type VesselView} from './model-set/model';
import {transform,transformDirection} from './model-set/frames';

const sets = [freight, lunar, seleneFreight,selenePowered,orisonPowered,surfaceAscent,surfaceReturn] as ModelSet[];
const trafficSets=[trafficDefinition,surfaceService] as unknown as TrafficDefinition[];
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
const number = (v: number) => v.toFixed(2);
document.body.innerHTML = `
<main>
  <header><h1>Orbital Logistics</h1><select id="set" aria-label="Model set">${[...sets,...trafficSets].map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><span id="load-status" role="status">Preparing scene…</span></header>
  <div class="workspace">
    <section class="scene" aria-label="Orbital viewer">
      <div class="view-tools"><label>Frame <select id="frame" aria-label="Reference frame"></select></label><button id="fit" title="Fit the scene (F)">Fit</button><button id="launch-view" hidden>Surface view</button><details id="layers"><summary>Layers</summary><div class="layer-options">${['orbits', 'trails', 'plan', 'labels'].map(id => `<label><input type="checkbox" id="layer-${id}" checked>${id === 'plan' ? 'Selected route' : id[0].toUpperCase() + id.slice(1)}</label>`).join('')}<button id="clear-view" aria-pressed="false">Clear view</button></div></details><span id="frame-name"></span></div>
      <div class="viewport"><canvas id="space" tabindex="0" aria-label="Orbital traffic. Drag to pan, scroll to zoom, click a ship or station to inspect."></canvas></div>
      <div id="timelines" aria-label="Ship activity timelines"></div>
      <div class="transport"><button id="restart" title="Rewind">↤</button><button id="play" disabled>Play</button><label class="speed-control"><input id="speed" type="range" min="-12" max="4" step="0.01" value="0" aria-label="Playback speed" aria-valuetext="1×"><output id="speed-value">1×</output></label><input id="time" type="range" min="0" max="64" value="0" step="0.001" aria-label="Simulation time"><output id="clock">0.00</output><button id="live" hidden>Live</button><label class="replay"><input type="checkbox" id="replay" title="Rewind the prepared scene at the end">Replay</label></div>
    </section>
    <aside><div class="section-heading"><h2>Traffic</h2><span id="traffic-count"></span></div><div id="fleet"></div><div class="section-heading" id="station-heading"><h2>Stations</h2></div><div id="stations"></div><section id="inspector"></section><details id="model-details"><summary>About this set</summary><p id="description"></p><p id="provenance"></p><p>Drag to pan · Scroll to zoom · Space to pause · F to fit</p></details></aside>
  </div>
</main><div id="hit-menu" hidden></div><pre id="state-json" hidden></pre>`;

const canvas = $<HTMLCanvasElement>('space'), ctx = canvas.getContext('2d')!;
let run: SceneView | undefined, worker: Worker | undefined, revision = 0;
let traffic:TrafficViewStore|undefined,pending=false,sequence=0,requestedTarget=0,desiredTarget=0,liveMode=true,liveError='';
let events: SetEvent[] = [], selected = '', frame = 'inertial', t = 0, playing = false;
let ready = false, width = 900, height = 600, scale = 100, center: [number, number] = [0, 0];
let lastFrame = performance.now(), lastPanel = 0, playbackRate = 1;
let layers = {orbits: true, trails: true, plan: true, labels: true};
let savedLayers = {...layers}, cleared = false;
let thrustWhiskers:{vessel:string;t:number;force:number;from:[number,number];to:[number,number]}[]=[];
let hits: {id: string; name: string; x: number; y: number}[] = [];
const labelLayout=new StableLabels();let placedLabels:PlacedLabel[]=[],hovered='';
const colors = {body: '#7893a4', station: '#c7d5de'};
function html(id: string, value: string) { if ($(id).innerHTML !== value) $(id).innerHTML = value; }
const end = () => run!.window.end;
const start = () => run!.window.start;
const cursorEnd=()=>traffic?.frontier??end();
function refreshTraffic(){if(!traffic)return;run=traffic.view(t);events=setEvents(run);const v=vessel(),chart=document.querySelector('.budget-chart');if(v && chart)chart.outerHTML=fuelGraph(v);buildTimeline();}
function requestTraffic(target:number){
 if(!traffic || !worker || pending || liveError || traffic.halt || !playing || !liveMode || document.hidden)return;
 pending=true;requestedTarget=Math.min(traffic.frontier+1,Math.max(traffic.frontier,target));
 worker.postMessage({generation:revision,sequence:++sequence,target:requestedTarget,after:traffic.frontier});
}
function goLive(){if(!traffic)return;traffic.release();t=traffic.frontier;desiredTarget=t;liveMode=true;playing=!liveError && !traffic.halt;lastFrame=performance.now();refreshTraffic();updatePanels();}
const vessel = () => run?.vessels.find(v => v.id === selected);
function project(y: State, time: number): [number, number] {
  let p:State;try{p=transform(run!,y,time,frame);}catch{return [NaN,NaN];}
  return [width / 2 + (p[0] - center[0]) * scale, height / 2 - (p[1] - center[1]) * scale];
}
function fit() {
  if (!run) return;
  center = [0, 0];
  scale = Math.min(width, height) / (2 * run.extent * (frame === 'inertial' || frame === 'rotating' ? 1 : 1.8));
}
function seek(time: number, pause = true) {
  if (!ready) return;
  t = Math.max(start(), Math.min(cursorEnd(), time));
  if (pause) {playing=false;if(traffic)liveMode=false;}
  refreshTraffic();
  draw();
  updatePanels();
}
function eventLabel(e: SetEvent): string {
  const port = e.portId ?? '';
  if(e.kind==='land')return `Touchdown · ${port}`;
  if (e.kind === 'dock') return `Dock ${port}`;
  if(e.kind==='launch')return `Lift off · ${port}`;
  if (e.kind === 'undock') return `Depart ${port}`;
  if (e.kind === 'transfer-start') return `Service ${port}`;
  if (e.kind === 'transfer') return `${e.cargoAfter! < e.cargoBefore! ? 'Unload' : 'Load'} freight · ${port}`;
  if(e.kind==='thrust-start')return 'Begin thrust';
  if(e.kind==='thrust-end')return 'End thrust';
  if(e.kind==='fuel-depleted')return 'Fuel depleted';
  if(e.kind==='planning-failed')return 'Waiting for transfer window';
  if(e.kind==='unavailable')return 'Transfer unavailable';
  if(e.kind==='fault')return 'Flight fault';
  return e.id.endsWith('capture') ? 'Arrival burn' : 'Departure burn';
}
function nextArrival(v: VesselView) { return events.find(e => e.vessel === v.id && e.t > t + 1e-9 && (e.kind === 'dock'||e.kind==='land')); }
function status(v: VesselView): string {
  const s = sampleVessel(v, t), l = s.logistics;
  if(s.activity?.kind==='fault')return `Fault · last seen ${number(s.activity.knownEpoch!)}`;
  if(s.activity?.kind==='unavailable')return 'Transfer unavailable';
  if(s.activity?.kind==='waiting' && s.activity.reason)return 'Waiting for transfer window';
  if (l?.service) return `${l.service.cargo < 0 ? 'Unloading' : 'Loading'} · ${l.service.portId}`;
  if (l?.dockedPortId) return `${v.ports.find(p=>p.id===l.dockedPortId)?.rail.kind==='surface'?'On pad':'Docked'} · ${l.dockedPortId}`;
  if((s.thrust?.force??0)>0)return `Powered flight · ${nextArrival(v)?.portId??''}`;
  const dock = nextArrival(v);
  return dock ? `En route · ${dock.portId}` : 'Free flight';
}
function select(id: string) { selected = id; $('hit-menu').hidden = true; draw();updatePanels(); }
function buildTimeline() {
  $('timelines').innerHTML = run!.vessels.map(v => {
    const times = [...new Set([start(), end(), ...v.ledger.map(e => e.t)])].sort((a, b) => a - b);
    const blocks = times.slice(0, -1).map((a, i) => {
      const b = times[i + 1], state = sampleVessel(v, (a + b) / 2), l = state.logistics, powered=(state.thrust?.force??0)>0;
      const fill = l?.service ? '#e9c485' : l?.dockedPortId ? '#35434d' : v.color;
      return `<rect x="${1000 * (a - start()) / (end() - start())}" y="${l?.service || powered ? 3 : 7}" width="${1000 * (b - a) / (end() - start())}" height="${l?.service || powered ? 14 : 6}" fill="${fill}" opacity="${powered?0.95:l?.dockedPortId && !l.service ? 0.8 : 0.65}"/>`;
    }).join('');
    const burns = v.ledger.filter(e => e.kind === 'burn').map(e => `<path d="M${1000 * (e.t - start()) / (end() - start())} 4v12" stroke="${v.color}" stroke-width="1"/>`).join('');
    return `<div class="timeline-row" data-vessel="${esc(v.name)}"><button class="timeline-name" data-select="${esc(v.id)}" style="color:${v.color}">${esc(v.name)}</button><div class="timeline-track"><svg viewBox="0 0 1000 20" preserveAspectRatio="none" aria-label="${esc(v.name)} activity; colored spans are flight, gold is cargo service">${blocks}${burns}</svg>${traffic?`<span class="future-region" style="left:${100*(traffic.frontier-start())/(end()-start())}%" title="Planned"></span><span class="frontier-cursor" style="left:${100*(traffic.frontier-start())/(end()-start())}%" title="Simulation head"></span>`:""}<span class="time-cursor"></span><button class="timeline-seek" aria-label="Scrub ${esc(v.name)} timeline"></button></div></div>`;
  }).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(b => b.onclick = () => select(b.dataset.select!));
  document.querySelectorAll<HTMLButtonElement>('.timeline-seek').forEach(b => b.onclick = e => {
    const rect = b.getBoundingClientRect(); seek(start() + (e.clientX - rect.left) / rect.width * (end() - start()));
  });
}
function fuelChart(v:VesselView):string {return `<div class="chart-key"><span>Fuel</span><span>Freight</span></div>${fuelGraph(v)}`;}
function fuelGraph(v: VesselView): string {
  const edges=new Map(v.boundaries.map(e=>[e.t,e.before]));
  const path = (get: (s: typeof v.samples[number]) => number, max: number) => {
    let last=-Infinity;
    const points = v.samples.filter((s, i) => {
      const keep=i===0 || i===v.samples.length-1 || edges.has(s.t) || (get(s)!==get(v.samples[i-1]) && (!v.continuousFuel || s.t-last>=(end()-start())/928));
      if(keep)last=s.t;return keep;
    });
    return points.map((s, i) => {
      const x = 4 + (s.t - start()) / (end() - start()) * 232, y = 64 - Math.min(1, get(s) / Math.max(max, 1e-12)) * 54;
      const before=edges.get(s.t);
      if(i && v.continuousFuel && before){const left=64-Math.min(1,get(before)/Math.max(max,1e-12))*54;return `L${x},${left}V${y}`;}
      return i ? v.continuousFuel?`L${x},${y}`:`H${x}V${y}` : `M${x},${y}`;
    }).join(' ');
  };
  return `<svg class="budget-chart" viewBox="0 0 240 72" role="img" aria-label="Fuel and freight over the scene"><path d="M4 64H236" stroke="#33414b"/><path d="${path(s => s.propellant, v.ship.tankCapacity)}" fill="none" stroke="#78c9c0" stroke-width="1.5"/><path d="${path(s => s.logistics?.cargoMass ?? v.ship.cargoMass, v.cargoCapacity ?? 1)}" fill="none" stroke="#efb878" stroke-width="1.5"/><path class="budget-cursor" d="M0 5V66" stroke="#c7d5de" stroke-opacity="0.6"/></svg>`;
}
let inspectorKey = '';
function updatePanels() {
  if (!run || !ready) return;
  $<HTMLButtonElement>('play').textContent = playing ? 'Pause' : 'Play';
  $<HTMLInputElement>('time').value = String(t);
  // Keep the HTML range step anchored to millisecond values as history slides.
  $<HTMLInputElement>('time').min=String(Math.floor(start()*1000)/1000);$<HTMLInputElement>('time').max=String(cursorEnd());
  $('clock').textContent=traffic?`${number(t)} · head ${number(traffic.frontier)}`:`${number(t)} / ${number(end())}`;
  $('live').textContent=liveMode?'Live':'Return to live';$('live').setAttribute('aria-pressed',String(liveMode));
  $('load-status').textContent = liveError || (traffic?.halt??(traffic?liveMode?'':playing?'Playing history':'History held':t===end()?'End of scene':''));
  if(traffic){const origin=run.vessels.find(v=>v.id===frame);if(origin && sampleVessel(origin,t).activity?.kind==='fault'){frame='inertial';$<HTMLSelectElement>('frame').value=frame;}
   for(const option of $<HTMLSelectElement>('frame').options){const v=run.vessels.find(v=>v.id===option.value);option.disabled=!!v && sampleVessel(v,t).activity?.kind==='fault';}}
  html('fleet', run.vessels.map(v => `<button class="object-row ${selected === v.id ? 'selected' : ''}" data-object="${esc(v.id)}"><i style="background:${v.color}"></i><span><strong>${esc(v.name)}</strong><small>${esc(status(v))}</small></span></button>`).join(''));
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
    const s = sampleVessel(v, t), cargo = s.logistics?.cargoMass ?? v.ship.cargoMass;
    $('object-status').textContent = status(v);
    const used = s.fuelUsed??v.ledger.filter(e => e.t <= t).reduce((sum, e) => sum + e.fuelUsed, 0);
    $('readouts').innerHTML = `<div><dt>${esc(v.cargo)}</dt><dd>${number(cargo)} / ${number(v.cargoCapacity ?? cargo)}</dd></div><div><dt>Propellant</dt><dd>${number(s.propellant)} / ${number(v.ship.tankCapacity)}</dd></div><div><dt>Fuel used</dt><dd>${number(used)}</dd></div>`;
    if(v.ship.engine)$('readouts').innerHTML+=`<div><dt>Thrust</dt><dd>${number(s.thrust?.force??0)} / ${number(v.ship.engine.maxThrust)}</dd></div><div><dt>Thrust acceleration</dt><dd>${number(s.thrust?.acceleration??0)}</dd></div>`;
    if(v.ports.some(p=>p.rail.kind==='surface')) {
      const body=run.world.bodies[0],b=bodyState(body,t),dx=s.y[0]-b[0],dy=s.y[1]-b[1],r=Math.hypot(dx,dy),vx=s.y[3]-b[3],vy=s.y[4]-b[4];
      const small=(x:number)=>Math.abs(x)<1e-12?'0.0000':Math.abs(x)<.001?x.toExponential(2):x.toFixed(4);
      const mass=v.ship.dryMass+cargo+s.propellant;
      $('readouts').innerHTML+=`<div><dt>Altitude · R</dt><dd>${small(r-body.radius)}</dd></div><div><dt>Radial speed</dt><dd>${small((dx*vx+dy*vy)/r)}</dd></div><div><dt>Tangential speed</dt><dd>${small((dx*vy-dy*vx)/r)}</dd></div><div><dt>Thrust / weight</dt><dd>${number((s.thrust?.force??0)/mass/(body.mu/r**2))}</dd></div>`;
    }
    $<HTMLButtonElement>('object-frame').disabled=s.activity?.kind==='fault';
    if(s.activity?.reason)$('readouts').innerHTML+=`<div class="fault-reason">${esc(s.activity.reason)}</div>`;
    if(s.activity?.retryAt!==undefined)$('readouts').innerHTML+=`<div><dt>Retry</dt><dd>${number(s.activity.retryAt)}</dd></div>`;
    const local=s.activity?.kind==='fault'?[0,0,0,0,0,0]:transform(run,s.y,t,frame);
    if(Math.abs(local[2])+Math.abs(local[5])>1e-9)$('readouts').innerHTML+=`<div><dt>Depth</dt><dd>${number(local[2])}</dd></div><div><dt>Vertical velocity</dt><dd>${number(local[5])}</dd></div>`;
    const cursor = document.querySelector<SVGPathElement>('.budget-cursor');
    cursor?.setAttribute('transform', `translate(${4 + (t - start()) / (end() - start()) * 232},0)`);
    upcoming = events.find(e => e.vessel === selected && e.t > t + 1e-9 && e.kind !== 'burn');
  } else {
    const station = run.stations.find(s => s.id === selected), stock = stocks.find(s => s.id === selected);
    const body = run.world.bodies.find(b => b.id === selected);
    $('object-status').textContent = station?.role ?? 'Gravity source';
    $('readouts').innerHTML = stock ? `<div><dt>Freight stock</dt><dd>${number(stock.cargo)}</dd></div><div><dt>Propellant stock</dt><dd>${number(stock.propellant)}</dd></div><div><dt>Berths</dt><dd>${stock.occupied} / ${station!.berths}</dd></div>` : `<div><dt>Gravitational μ</dt><dd>${number(body!.mu)}</dd></div>`;
    upcoming = events.find(e => e.portId === selected && e.t > t + 1e-9 && (e.kind === 'dock'||e.kind==='land'));
  }
  $('next-event').hidden = !upcoming;
  if (upcoming) {
    const e = upcoming;
    $('next-event').textContent = `${eventLabel(e)} · ${number(e.t)} →`;
    $<HTMLButtonElement>('next-event').disabled=!!traffic && e.t>traffic.frontier;
    $('next-event').title=traffic && e.t>traffic.frontier?'Planned · not flown yet':'';
    $('next-event').onclick = () => seek(e.t);
  }
  const relevant = events.filter(e => (v ? e.vessel === selected : e.portId === selected) && e.kind !== 'burn' && e.kind !== 'transfer-start');
  $('schedule').hidden = !relevant.length;
  html('event-list', relevant.map(e => `<button data-time="${e.t}" ${traffic && e.t>traffic.frontier?'disabled title="Planned · not flown yet"':''} class="event ${e.t <= t ? 'past' : ''}"><span>${number(e.t)}</span>${esc(eventLabel(e))}</button>`).join(''));
  document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(b => b.onclick = () => seek(Number(b.dataset.time)));
  const percent = (t - start()) / (end() - start()) * 100;
  document.querySelectorAll<HTMLElement>('.time-cursor').forEach(c => c.style.left = `${percent}%`);
  document.querySelectorAll<HTMLElement>('.timeline-row').forEach(r => r.classList.toggle('selected', r.dataset.vessel === v?.name));
  $('frame-name').textContent = $<HTMLSelectElement>('frame').selectedOptions[0]?.textContent ?? '';
  publishState();
}
function publishState() {
  $('state-json').textContent = JSON.stringify({ready, revision, set: run?.id, t, playing, playbackRate, frame, selected, layers, traffic:traffic?{frontier:traffic.frontier,oldest:traffic.oldest,pending,sequence,live:liveMode,stats:run?.traffic?.stats,halt:traffic.halt,error:liveError}:undefined,
    ships: run?.vessels.map(v => ({id: v.id, ...sampleVessel(v, t), screen: project(sampleVessel(v,t).y,sampleVessel(v,t).activity?.knownEpoch??t)})),
    labels:placedLabels.map(({id,anchor,alpha,left,top})=>({id,anchor,alpha,left,top})),
    stocks: run ? stockAt(run, t) : [], events, thrustWhiskers, camera: {center, scale}, hits});
}
function loadSet(id: string) {
  const continuous=trafficSets.find(d=>d.id===id);
  const set = sets.find(s => s.id === id)!;
  labelLayout.reset();placedLabels=[];hovered='';
  worker?.terminate();traffic=undefined;pending=false;sequence=0;desiredTarget=0;liveError='';liveMode=true;revision++; ready = false; playing = false; run = undefined; t = 0; inspectorKey = '';
  $('load-status').textContent = 'Preparing scene…';
  $<HTMLButtonElement>('play').disabled = true; $('fleet').innerHTML = ''; $('stations').innerHTML = ''; $('inspector').innerHTML = ''; $('timelines').innerHTML = '';
  $('state-json').textContent = JSON.stringify({ready, revision});
  $('launch-view').hidden=true;
  $('live').hidden=!continuous;document.querySelector<HTMLElement>('.replay')!.hidden=!!continuous;
  $('restart').title=continuous?'Restart run':'Rewind';
  if(continuous){loadTraffic(continuous);return;}
  worker = new PrepareWorker({name:'scene-prepare'});
  const currentRevision = revision;
  worker.onmessage = (e: MessageEvent<{revision: number; run?: SceneView; error?: string}>) => {
    if (e.data.revision !== revision || currentRevision !== revision) return;
    if (e.data.error) { $('load-status').textContent = e.data.error; return; }
    run = e.data.run!; events = setEvents(run); ready = true; selected = run.vessels[0].id;
    $('launch-view').hidden=!run.world.ports.some(p=>p.rail.kind==='surface');
    frame = 'inertial'; t = run.id === 'orison-freight' ? 2 : 0; playing = true;
    $<HTMLInputElement>('time').min = String(start()); $<HTMLInputElement>('time').max = String(end());
    $('frame').innerHTML = `<option value="inertial">Inertial</option><option value="rotating">${esc(run.rotating.name)}</option>` +
      [...run.world.bodies.map(b => [b.id, b.id]), ...run.stations.map(s => [s.id, s.id]), ...run.vessels.map(v => [v.id, v.name])].map(([id, name]) => `<option value="${esc(id)}">${esc(name)} centered</option>`).join('');
    $('description').textContent = run.description; $('provenance').textContent = run.provenance;
    $('traffic-count').textContent = String(run.vessels.length);
    $<HTMLButtonElement>('play').disabled = false; fit(); buildTimeline(); updatePanels();
    worker?.terminate(); worker = undefined;
  };
  worker.onerror=(event)=>{if(currentRevision===revision){playing=false;$('load-status').textContent=`Scene failed: ${event.message||'worker failed'}`;}};
  worker.postMessage({revision, set});
}

function loadTraffic(definition:TrafficDefinition){
 traffic=new TrafficViewStore(definition);
 worker=new TrafficWorker({name:'continuous-traffic'});
 const generation=revision;pending=true;
 worker.onmessage=(e:MessageEvent<{generation:number;sequence:number;delta?:TrafficDelta;error?:string}>)=>{
  if(generation!==revision || e.data.generation!==revision || e.data.sequence!==sequence)return;
  pending=false;
  if(e.data.error){liveError=`Simulation paused: ${e.data.error}`;playing=false;$('load-status').textContent=liveError;updatePanels();return;}
  const first=!ready;traffic!.ingest(e.data.delta!,!liveMode || !playing && !first);
  if(first){ready=true;selected=traffic!.definition.vessels[0].id;frame='inertial';t=0;playing=true;}
  else if(liveMode && playing)t=traffic!.frontier;
  refreshTraffic();
  if(first){$('launch-view').hidden=!run!.world.ports.some(p=>p.rail.kind==='surface');$('frame').innerHTML=`<option value="inertial">Inertial</option><option value="rotating">${esc(run!.rotating.name)}</option>`+[...run!.world.bodies.map(b=>[b.id,b.id]),...run!.stations.map(s=>[s.id,s.id]),...run!.vessels.map(v=>[v.id,v.name])].map(([id,name])=>`<option value="${esc(id)}">${esc(name)} centered</option>`).join('');
   $('description').textContent=run!.description;$('provenance').textContent=run!.provenance;$('traffic-count').textContent=String(run!.vessels.length);$<HTMLButtonElement>('play').disabled=false;fit();}
  updatePanels();
 };
 worker.onerror=(event)=>{if(generation===revision){pending=false;liveError=`Simulation paused: ${event.message||'worker failed'}`;playing=false;$('load-status').textContent=liveError;updatePanels();}};
 worker.postMessage({generation,sequence,definition});
}

function path(points: [number, number][], color: string, lineWidth = 1, alpha = 1, dash: number[] = []) {
  points=points.filter(p=>p.every(Number.isFinite));
  if (!points.length) return;
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.globalAlpha = alpha; ctx.setLineDash(dash);
  ctx.moveTo(...points[0]);let last=points[0];
  for(let i=1;i<points.length;i++)if(i===points.length-1 || Math.hypot(points[i][0]-last[0],points[i][1]-last[1])>=.1){ctx.lineTo(...points[i]);last=points[i];}
  ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
}
function draw() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0c141d'; ctx.fillRect(0, 0, width, height);
  // Quiet schematic background; no decorative planetary rendering.
  ctx.fillStyle = '#7e98aa';
  for (let i = 0; i < 65; i++) { ctx.globalAlpha = 0.12 + (i % 4) * 0.035; ctx.fillRect((i * 313.47) % width, (i * 137.33) % height, 1, 1); }
  ctx.globalAlpha = 1;
  if (!run || !ready) return;
  const reference=run.vessels.find(v=>v.id===frame);if(reference && sampleVessel(reference,t).activity?.kind==='fault'){frame='inertial';$<HTMLSelectElement>('frame').value=frame;}
  hits = [];thrustWhiskers=[];
  const scenario = run.world;
  const labelRequests:Label[]=[];
  if (layers.orbits) {
    const orbitEpochs = (period: number) => {
      const duration = Math.min(period, end() - start());
      const first = Math.max(start(), Math.min(t - duration / 2, end() - duration));
      return Array.from({length: 161}, (_, i) => first + duration * i / 160);
    };
    for (const port of portsOf(run)) {
      if(port.rail.kind==='surface')continue;
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
    const id = v.id, isSelected = id === selected;
    if (layers.trails) {
      const trailStart = Math.max(start(), t - (run.id === 'lunar-loop' ? 9 : 12));
      let prev: [number, number] | undefined,chunk:[number,number][]=[],shade=-1;
      for (const sample of v.samples) {
        if (sample.t < trailStart || sample.t > t || sample.activity?.kind==='fault') continue;
        const p = project(sample.y, sample.t);
        const alpha=Math.round(32*(isSelected ? 0.7 : 0.4)*Math.exp(-(t-sample.t)/4));
        if(alpha!==shade && chunk.length){path(chunk,v.color,isSelected?1.7:1.1,shade/32);chunk=prev?[prev]:[];}
        chunk.push(p);shade=alpha;
        prev = p;
      }
      if(chunk.length)path(chunk,v.color,isSelected?1.7:1.1,shade/32);
      if (prev && sampleVessel(v,t).activity?.kind!=='fault') path([prev, project(sampleVessel(v, t).y, t)], v.color, 1.5, 0.75);
    }
    if (layers.plan && isSelected && sampleVessel(v,t).activity?.kind!=='fault') {
      const stop = nextArrival(v)?.t ?? Math.min(end(), t + (run.id === 'lunar-loop' ? 5.58 : 8));
      path([project(sampleVessel(v, t).y, t), ...v.samples.filter(s => s.t > t && s.t <= stop).map(s => project(s.y, s.t))], '#b5bdc7', 1, 0.28, [3, 5]);
    }
    if(layers.plan && isSelected)for(const arc of v.arcs) {
      const stop=nextArrival(v)?.t??end();
      if(arc.throttle===0 || arc.end<=t || arc.start>=stop || arc.end>end() || sampleVessel(v,t).activity?.kind==='fault')continue;
      const curve=[project(sampleVessel(v,Math.max(start(),arc.start)).y,Math.max(start(),arc.start)),...v.samples.filter(s=>s.t>arc.start && s.t<arc.end).map(s=>project(s.y,s.t)),project(sampleVessel(v,arc.end).y,arc.end)];
      const length=curve.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-curve[i][0],p[1]-curve[i][1]),0);
      const count=Math.max(2,Math.min(40,Math.ceil(length/14)));
      // Samples stay anchored to the whole arc, so whiskers disappear as flown
      // rather than crawling along the remaining portion during playback.
      for(let i=0;i<count;i++) {
        const epoch=arc.start+(i+.5)/count*(arc.end-arc.start);
        if(epoch<t || epoch>stop)continue;
        const sample=sampleVessel(v,epoch),force=sample.thrust?.force??0;
        const point=project(sample.y,epoch),d=transformDirection(run,arc.direction,epoch,frame),n=Math.hypot(d[0],d[1]);
        if(n<1e-10 || force<=0)continue;
        // Exhaust-side whiskers share the ship's burn schematic convention.
        // A visibility floor and square-root scale show small burns without
        // letting large engines dominate the drawing. Force includes cap taper.
        const pixels=3+15*Math.sqrt(Math.min(1,force/v.ship.engine!.maxThrust));
        const tip:[number,number]=[point[0]-d[0]/n*pixels,point[1]+d[1]/n*pixels];
        path([point,tip],'#f0cf8f',1,.75);
        thrustWhiskers.push({vessel:id,t:epoch,force,from:point,to:tip});
      }
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
    const state=displayPortState(port,run.portSamples,t);
    if(port.rail.kind==='surface'){const rail=port.rail,body=run.world.bodies.find(b=>b.id===rail.bodyId)!;for(let i=0;i<3;i++)state[i]=rail.center[i]+(state[i]-rail.center[i])*body.radius/rail.radius;}
    const p = project(state, t);
    if(port.rail.kind==='surface') {
      const rail=port.rail,theta=rail.phase+rail.rate*t;
      const outward=transformDirection(run,[Math.cos(theta),Math.sin(theta),0],t,frame);
      ctx.save();ctx.translate(...p);ctx.rotate(Math.atan2(-outward[1],outward[0]));
      path([[0,-7],[0,7]],colors.station,2);path([[0,-7],[4,-7]],colors.station,1);path([[0,7],[4,7]],colors.station,1);ctx.restore();
    } else {
    ctx.save(); ctx.translate(...p); ctx.rotate(Math.PI / 4); ctx.strokeStyle = colors.station; ctx.lineWidth = 1.2; ctx.strokeRect(-4, -4, 8, 8); ctx.restore();
    }
    if (selected === port.id) { ctx.beginPath(); ctx.arc(...p, 10, 0, Math.PI * 2); ctx.strokeStyle = '#c7d5de'; ctx.stroke(); }
    label(port.id, port.id, ...p, '#a7bac7'); hits.push({id: port.id, name: port.id, x: p[0], y: p[1]});
  }
  for (const v of run.vessels) {
    const state=sampleVessel(v,t),epoch=state.activity?.kind==='fault'?state.activity.knownEpoch!:t,p=project(state.y,epoch);
    if(!p.every(Number.isFinite))continue;
    const transformed=transform(run,state.y,epoch,frame);
    if(state.activity?.kind==='fault'){path([[p[0]-5,p[1]-5],[p[0]+5,p[1]+5]],'#ef8a81',2);path([[p[0]-5,p[1]+5],[p[0]+5,p[1]-5]],'#ef8a81',2);label(v.id,`${v.name} · fault`,...p,'#ef8a81');hits.push({id:v.id,name:v.name,x:p[0],y:p[1]});continue;}
    if(state.thrust && state.thrust.force>0) {
      const direction=transformDirection(run,state.thrust.direction,t,frame),dx=direction[0],dy=-direction[1],length=Math.hypot(dx,dy);
      if(length>1e-10)path([[p[0]-dx/length*5,p[1]-dy/length*5],[p[0]-dx/length*15,p[1]-dy/length*15]],'#ffe0a0',2,.9);
    }
    const angle = Math.hypot(transformed[3],transformed[4]) > 1e-10 ? Math.atan2(-transformed[4], transformed[3]) : 0;
    ctx.save(); ctx.translate(...p); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -3.5); ctx.lineTo(-2, 0); ctx.lineTo(-4, 3.5); ctx.closePath(); ctx.fillStyle = v.color; ctx.fill(); ctx.restore();
    if (selected === v.id) { ctx.beginPath(); ctx.arc(...p, 11, 0, Math.PI * 2); ctx.strokeStyle = v.color; ctx.globalAlpha = 0.65; ctx.stroke(); ctx.globalAlpha = 1; }
    if (!state.logistics?.dockedPortId || selected===v.id) label(v.id, v.name, ...p, v.color);
    hits.push({id: v.id, name: v.name, x: p[0], y: p[1]});
  }
  placedLabels=labelLayout.layout(labelRequests,performance.now());
  ctx.font='11px ui-sans-serif, system-ui';
  for(const l of placedLabels){ctx.globalAlpha=l.alpha;ctx.fillStyle=l.color;ctx.fillText(l.text,l.left,l.top);}
  ctx.globalAlpha=1;
  ctx.fillStyle = '#4c6477'; ctx.font = '10px ui-monospace, monospace';
  const unit = 10 ** Math.floor(Math.log10(80 / scale));
  const bar = unit * scale; ctx.fillRect(20, height - 22, bar, 1); ctx.fillText(`${Number(unit.toPrecision(2))} ${run.world.units.length}`, 20, height - 29);
}

$<HTMLSelectElement>('set').onchange = e => loadSet((e.target as HTMLSelectElement).value);
$<HTMLSelectElement>('frame').onchange = e => { frame = (e.target as HTMLSelectElement).value; fit(); updatePanels(); };
$('fit').onclick = fit;
$('launch-view').onclick=()=>{
  const pad=run?.world.ports.find(p=>p.rail.kind==='surface');if(!pad)return;
  frame=pad.id;$<HTMLSelectElement>('frame').value=frame;
  const theta=pad.rail.kind==='surface'?pad.rail.phase+pad.rail.rate*t:0;
  center=[Math.cos(theta)*.075,Math.sin(theta)*.075];scale=Math.min(width,height)/.22;updatePanels();
};
$('play').onclick=()=>{if(!ready)return;if(!traffic && t>=end())t=start();playing=!playing;if(traffic && !playing)liveMode=false;lastFrame=performance.now();updatePanels();};
$('live').onclick=goLive;
$('restart').onclick=()=>{if(ready){if(traffic)loadSet(traffic.definition.id);else seek(start());}};
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
  scale = Math.max(20, Math.min(1_000_000, scale * Math.exp(-e.deltaY * 0.0015)));
  center = [before[0] - x / scale, before[1] - y / scale];
}, {passive: false});
document.addEventListener('pointerdown', e => { if (!canvas.contains(e.target as Node) && !$('hit-menu').contains(e.target as Node)) $('hit-menu').hidden = true; });
document.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).matches('input, select, button, summary')) return;
  if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
  if (e.key.toLowerCase() === 'f') fit();
  if (e.key === 'Escape') $('hit-menu').hidden = true;
});
$<HTMLInputElement>('speed').oninput = () => {
  playbackRate = 2 ** Number($<HTMLInputElement>('speed').value);
  const text = `${playbackRate < .01 ? Number(playbackRate.toPrecision(3)) : playbackRate<1 ? playbackRate.toFixed(2) : Number(playbackRate.toFixed(2))}×`;
  $('speed-value').textContent = text;
  $('speed').setAttribute('aria-valuetext', text);
  if (ready) updatePanels();
};
function animate(now: number) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  if(ready && playing && traffic && !document.hidden){
   if(liveMode){desiredTarget=Math.min(traffic.frontier+1,Math.max(traffic.frontier,desiredTarget)+dt*playbackRate);requestTraffic(desiredTarget);}
   else {t=Math.min(traffic.frontier,t+dt*playbackRate);if(t>=traffic.frontier){traffic.release();desiredTarget=traffic.frontier;liveMode=true;}if(now-lastPanel>100)refreshTraffic();}
  }
  if (ready && playing && !traffic) {
    t = Math.min(end(), t + dt * playbackRate);
    if (t >= end()) { if ($<HTMLInputElement>('replay').checked) t = start(); else playing = false; }
  }
  draw();
  if (ready && now - lastPanel > 100) { updatePanels(); lastPanel = now; }
  requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(document.hidden && traffic){playing=false;liveMode=false;updatePanels();}});
loadSet(sets[0].id); requestAnimationFrame(animate);
