import atmosphericLaunch from '../fixtures/model-sets/aster-launch.json';
import type {AtmosphericMission} from './model-set/atmospheric-mission';
import atmosphericEntry from '../fixtures/model-sets/aster-entry.json';
import type {EntryFlight} from './model-set/entry';
import {densityAt} from './sim/atmosphere';
import './style.css';
import PrepareWorker from './model-set/prepare.worker?worker&inline';
import TrafficWorker from './traffic/traffic.worker?worker&inline';
import {adaptivePlaybackLead,bufferedEdge,maximumPlaybackRate} from './traffic/playback';
import {StableLabels,type Label,type PlacedLabel} from './view/labels';
import freight from '../fixtures/model-sets/orison-freight.json';
import lunar from '../fixtures/model-sets/lunar-loop.json';
import seleneFreight from '../fixtures/model-sets/selene-freight.json';
import selenePowered from '../fixtures/model-sets/selene-powered.json';
import orisonPowered from '../fixtures/model-sets/orison-powered.json';
import surfaceAscent from '../fixtures/model-sets/selene-ascent.json';
import stagedFlight from '../fixtures/model-sets/selene-staging.json';
import type {StagedFlight} from './model-set/staging';
import surfaceReturn from '../fixtures/model-sets/selene-return.json';
import trafficDefinition from '../fixtures/traffic/orison-service.json';
import surfaceService from '../fixtures/traffic/selene-service.json';
import flexibleService from '../fixtures/traffic/orison-flexible-service.json';
import networkService from '../fixtures/traffic/orison-relay-network.json';
import {NetworkViewStore} from './network/view';
import {isNetwork,type NetworkDefinition} from './network/model';
import type {NetworkDelta} from './network/engine';
import {AdaptiveViewStore} from './adaptive/view';
import {isAdaptive,type AdaptiveDefinition} from './adaptive/world';
import type {AdaptiveDelta} from './adaptive/engine';
import maintainedService from '../fixtures/traffic/orison-maintained-service.json';
import {MaintainedViewStore} from './maintained/view';
import {isMaintained,type MaintainedDefinition} from './maintained/world';
import type {MaintainedDelta} from './maintained/engine';
import maintainedSet from '../fixtures/model-sets/orison-maintained.json';
import steered from '../fixtures/model-sets/orison-steered.json';
import crossingPlanes from '../fixtures/model-sets/crossing-planes.json';
import {directionAt} from './sim/steering';
import {rocketAxis,drawRocket} from './view/rocket';
import {cameraPoint,cameraVector,orient,pan,zoom,chaseRig,orbitAround,occluder,visibleSegment,type Camera,type CameraPreset,type ScreenPoint,type Sphere} from './model-set/camera';
import {TrafficViewStore} from './traffic/view';
import type {TrafficDefinition} from './traffic/planner';
import type {TrafficDelta} from './traffic/engine';
import {bodyState} from './sim/dynamics';
import type {State,Vec3} from './sim/schema';
import {orbitError,displayPortState,portsOf, sampleVessel as uncachedSampleVessel, setEvents, stockAt, isPresent,presenceLabel,type ModelSet, type SetEvent, type SceneView, type VesselView} from './model-set/model';
import {transform,transformDirection} from './model-set/frames';

const sets = [freight, lunar, seleneFreight,selenePowered,orisonPowered,surfaceAscent,surfaceReturn,stagedFlight,atmosphericEntry,atmosphericLaunch,crossingPlanes,steered,maintainedSet] as (ModelSet|StagedFlight|EntryFlight|AtmosphericMission)[];
const trafficSets=[trafficDefinition,surfaceService,maintainedService,flexibleService,networkService] as unknown as (TrafficDefinition|MaintainedDefinition|AdaptiveDefinition|NetworkDefinition)[];
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
const number = (v: number) => v.toFixed(2);
document.body.innerHTML = `
<main>
  <header><h1>Orbital Logistics</h1><select id="set" aria-label="Model set">${[...sets,...trafficSets].map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><span id="load-status" role="status">Preparing scene…</span></header>
  <div class="workspace">
    <section class="scene" aria-label="Orbital viewer">
      <div class="view-tools"><label>Frame <select id="frame" aria-label="Reference frame"></select></label><label>View <select id="camera-view" aria-label="Camera view"><option value="top">Top</option><option value="oblique">3D</option><option value="front">Front</option><option value="side">Side</option><option value="custom" hidden>Custom</option></select></label><label>Track <select id="tracking" aria-label="Camera tracking"><option value="off">Off</option><option value="follow">Follow</option><option value="chase">Chase</option></select></label><button id="drag-mode" title="Drag to orbit · Shift-drag to pan" aria-pressed="false">Orbit</button><button id="fit" title="Fit the scene (F)">Fit</button><button id="launch-view" hidden>Surface view</button><details id="layers"><summary>Layers</summary><div class="layer-options">${['orbits', 'trails', 'plan', 'labels'].map(id => `<label><input type="checkbox" id="layer-${id}" checked>${id === 'plan' ? 'Selected route' : id[0].toUpperCase() + id.slice(1)}</label>`).join('')}<label class="entry-layer" hidden><input type="checkbox" id="layer-atmosphere" checked>Atmosphere</label><label class="entry-layer" hidden><input type="checkbox" id="layer-aero">Aerodynamic forces <span style="color:#80c6ed">D</span> / <span style="color:#bb9fee">L</span></label><label class="entry-layer" hidden><input type="checkbox" id="layer-glow" checked>Entry glow</label><label><input type="checkbox" id="see-through">See-through bodies</label><button id="clear-view" aria-pressed="false">Clear view</button></div></details><span id="frame-name"></span></div>
      <div class="viewport"><canvas id="space" tabindex="0" aria-label="Orbital traffic. Drag to pan, scroll to zoom, click a ship or station to inspect."></canvas></div>
      <div id="timelines" aria-label="Ship activity timelines"></div>
      <div class="transport"><button id="restart" title="Rewind">↤</button><button id="play" disabled>Play</button><label class="speed-control"><input id="speed" type="range" min="-12" max="4" step="0.01" value="0" aria-label="Playback speed" aria-valuetext="1×"><output id="speed-value">1×</output></label><input id="time" type="range" min="0" max="64" value="0" step="0.001" aria-label="Simulation time"><output id="clock">0.00</output><button id="live" hidden>Live</button><label class="replay"><input type="checkbox" id="replay" title="Rewind the prepared scene at the end">Replay</label></div>
    </section>
    <aside><div class="section-heading"><h2>Traffic</h2><span id="traffic-count"></span></div><div id="fleet"></div><div class="section-heading" id="station-heading"><h2>Stations</h2></div><div id="stations"></div><section id="inspector"></section><details id="model-details"><summary>About this set</summary><p id="description"></p><p id="provenance"></p><p>Drag to orbit in 3D · Shift-drag or Pan to move · Scroll to zoom · Arrow keys to orbit · Shift-arrows to pan · T for top · F to fit · Space to pause</p></details></aside>
  </div>
</main><div id="hit-menu" hidden></div><pre id="state-json" hidden></pre>`;

const canvas = $<HTMLCanvasElement>('space'), ctx = canvas.getContext('2d')!;
let run: SceneView | undefined, worker: Worker | undefined, revision = 0;
let traffic:TrafficViewStore|MaintainedViewStore|AdaptiveViewStore|NetworkViewStore|undefined,pending=false,sequence=0,requestedTarget=0,desiredTarget=0,liveMode=true,liveError='',trafficDirty=false;
let events: SetEvent[] = [], selected = '', frame = 'inertial', t = 0, playing = false;
let ready = false, width = 900, height = 600;
const camera:Camera={yaw:0,pitch:Math.PI/2,center:[0,0,0],scale:100};
let cameraPreset:CameraPreset|'custom'='top',panMode=false,spheres:Sphere[]=[],seeThroughBodies=false;
let tracking:'off'|'follow'|'chase'='off',trackingOffset:Vec3=[0,0,0];
const setSpeeds=new Map<string,number>();let currentSet='';
let lastFrame = performance.now(), lastPanel = 0, playbackRate = 1;
let layers = {orbits: true, trails: true, plan: true, labels: true,atmosphere:true,aero:false,glow:true};
let savedLayers = {...layers}, cleared = false;
let aeroVectors:{vessel:string;kind:'drag'|'lift';force:number;from:[number,number];to:[number,number]}[]=[];
let thrustWhiskers:{vessel:string;t:number;force:number;from:[number,number];to:[number,number]}[]=[];
let hits: {id: string; name: string; x: number; y: number;depth:number;radius?:number}[] = [];
const labelLayout=new StableLabels();let placedLabels:PlacedLabel[]=[],hovered='';
const colors = {body: '#7893a4', station: '#c7d5de'};
// Scene descriptors are immutable between replies. Cache drawing queries only;
// propagation, target providers, and worker execution never use this cache.
const drawingSamples=new WeakMap<VesselView,Map<number,ReturnType<typeof uncachedSampleVessel>>>();
function sampleVessel(v:VesselView,epoch:number){
 let samples=drawingSamples.get(v);if(!samples){samples=new Map();drawingSamples.set(v,samples);}
 const known=samples.get(epoch);if(known)return known;
 const result=uncachedSampleVessel(v,epoch);if(samples.size>=256)samples.clear();samples.set(epoch,result);return result;
}
function html(id: string, value: string) { if ($(id).innerHTML !== value) $(id).innerHTML = value; }
const end = () => run!.window.end;
const start = () => run!.window.start;
const cursorEnd=()=>traffic?.frontier??end();
function refreshTraffic(){if(!traffic)return;trafficDirty=false;run=traffic.view(t);events=setEvents(run);const v=vessel(),chart=document.querySelector('.budget-chart');if(v && chart)chart.outerHTML=fuelGraph(v);buildTimeline();}
function requestTraffic(target:number){
 if(!traffic || !worker || pending || liveError || traffic.halt || !playing || !liveMode || document.hidden || target<=traffic.frontier)return;
 pending=true;requestedTarget=Math.min(traffic.frontier+1,Math.max(traffic.frontier,target));
 worker.postMessage({generation:revision,sequence:++sequence,target:requestedTarget,after:traffic.frontier});
}
const playbackLead=()=>(traffic instanceof AdaptiveViewStore||traffic instanceof NetworkViewStore)?adaptivePlaybackLead:0;
const liveEdge=()=>traffic?bufferedEdge(traffic.frontier,traffic.oldest,playbackLead()):0;
function goLive(){if(!traffic)return;traffic.release();if(!liveMode)t=Math.max(t,liveEdge());desiredTarget=t+playbackLead();liveMode=!!playbackLead()||!liveError&&!traffic.halt;playing=(!liveError&&!traffic.halt)||t<traffic.frontier;lastFrame=performance.now();refreshTraffic();updatePanels();}
const vessel = () => run?.vessels.find(v => v.id === selected)??run?.maintained?.[selected];
function project3(y:State,time:number):ScreenPoint {
  const ref=run?.vessels.find(v=>v.id===frame);if(ref&&!isPresent(ref,time))return [NaN,NaN,NaN];
  try{return cameraPoint(camera,transform(run!,y,time,frame),width,height);}catch{return [NaN,NaN,NaN];}
}
function project(y:State,time:number):[number,number] {const p=project3(y,time);return [p[0],p[1]];}
function selectedState():State|undefined {
 if(!run)return;
 const v=vessel();if(v){if(!isPresent(v,t))return;const sample=sampleVessel(v,t);if(sample.activity?.kind==='fault'||sample.activity?.kind==='unavailable')return;return sample.y;}
 const port=portsOf(run).find(p=>p.id===selected);if(port)return displayPortState(port,run.portSamples,t);
 const body=run.world.bodies.find(b=>b.id===selected);if(body)return bodyState(body,t);
}
function pivot():Vec3|undefined {const state=selectedState();return state?transform(run!,state,t,frame).slice(0,3) as Vec3:undefined;}
function syncTracking() {
 if(tracking==='off')return;
 const state=selectedState();
 if(!state){tracking='off';cameraControls();return;}
 const target=transform(run!,state,t,frame);
 camera.center=target.slice(0,3).map((x,i)=>x+trackingOffset[i]) as Vec3;
 if(tracking==='chase') {
  const primary=bodyState(run!.world.bodies[0],t),r=state.slice(0,3).map((x,i)=>x-primary[i]),v=state.slice(3).map((x,i)=>x-primary[i+3]);
  camera.rig=chaseRig(transformDirection(run!,r as Vec3,t,frame),transformDirection(run!,v as Vec3,t,frame));
 }
}
function captureTrackingOffset(){const p=pivot();if(tracking!=='off' && p)trackingOffset=camera.center.map((x,i)=>x-p[i]) as Vec3;}
function track(mode:typeof tracking) {
 tracking=mode;trackingOffset=[0,0,0];
 if(mode==='chase'){camera.yaw=0;camera.pitch=.35;cameraPreset='custom';panMode=false;}
 syncTracking();cameraControls();draw();if(ready)updatePanels();
}
function cameraControls() {
  $<HTMLSelectElement>('tracking').value=tracking;
  $<HTMLSelectElement>('camera-view').value=cameraPreset;
  $('drag-mode').textContent=cameraPreset==='top'||panMode?'Pan':'Orbit';
  $<HTMLButtonElement>('drag-mode').disabled=cameraPreset==='top';
  $('drag-mode').setAttribute('aria-pressed',String(panMode));
  canvas.setAttribute('aria-label',cameraPreset==='top'||panMode?'Orbital traffic. Drag to pan, scroll to zoom, click a ship or station to inspect.':'Orbital traffic. Drag to orbit, Shift-drag to pan, scroll to zoom, click a ship or station to inspect.');
}
function setCamera(preset:CameraPreset) {if(tracking==='chase')tracking='follow';orient(camera,preset);cameraPreset=preset;panMode=false;cameraControls();draw();if(ready)updatePanels();}
function fit() {
  if (!run) return;
  camera.center = [0, 0, 0];
  camera.scale = Math.min(width, height) / (2 * run.extent * (frame === 'inertial' || frame === 'rotating' ? 1 : 1.8));
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
  if(e.kind==='burn' && e.id.includes('plane-change'))return 'Plane change';
  if(e.kind==='separation')return 'Stage separation';
  if(e.kind==='entry')return 'Atmospheric entry';
  if(e.kind==='splashdown')return 'Ocean recovery';
  if(e.kind==='land')return `Touchdown · ${port}`;
  if (e.kind === 'dock') return `Dock ${port}`;
  if(e.kind==='launch')return `Lift off · ${port}`;
  if (e.kind === 'undock') return `Depart ${port}`;
  if (e.kind === 'transfer-start') return `Service ${port}`;
  if(e.kind==='transfer'&&e.cargoAfter===e.cargoBefore)return `${e.propellantAfter<e.propellantBefore?'Deliver fuel':'Refuel'} · ${port}`;
  if (e.kind === 'transfer') return `${e.cargoAfter! < e.cargoBefore! ? 'Unload' : 'Load'} freight · ${port}`;
  if(e.kind==='thrust-start')return 'Begin thrust';
  if(e.kind==='thrust-end')return 'End thrust';
  if(e.kind==='fuel-depleted')return 'Fuel depleted';
  if(e.kind==='planning-failed')return 'Waiting for transfer window';
  if(e.kind==='unavailable')return 'Transfer unavailable';
  if(e.kind==='fault')return 'Flight fault';
  return e.id.endsWith('capture') ? 'Arrival burn' : 'Departure burn';
}
function nextArrival(v: VesselView) { return events.find(e => e.vessel === v.id && e.t > t + 1e-9 && (e.kind === 'dock'||e.kind==='land'||e.kind==='splashdown')); }
function status(v: VesselView): string {
  if(!isPresent(v,t))return presenceLabel(v,t);
  const s = sampleVessel(v, t), l = s.logistics;
  if(s.entryPhase)return ({coast:'Approaching atmosphere',entry:'Atmospheric braking',braking:'Terminal braking',recovered:'Recovered · Ocean'} as const)[s.entryPhase];
  if(s.activity?.kind==='fault')return `Fault · last seen ${number(s.activity.knownEpoch!)}`;
  if(run?.maintained?.[v.id])return s.thrust?.force?'Stationkeeping':'Coasting';
  if(s.activity?.kind==='unavailable')return 'Transfer unavailable';
  if(s.activity?.kind==='waiting' && s.activity.reason)return 'Waiting for transfer window';
  if(l?.service&&l.service.cargo===0&&l.service.propellant!==0)return `${l.service.propellant<0?'Delivering fuel':'Refueling'} · ${l.service.portId}`;
  if (l?.service) return `${l.service.cargo < 0 ? 'Unloading' : 'Loading'} · ${l.service.portId}`;
  if (l?.dockedPortId) return `${v.ports.find(p=>p.id===l.dockedPortId)?.rail.kind==='surface'?'On pad':'Docked'} · ${l.dockedPortId}`;
  if((s.thrust?.force??0)>0)return 'Powered flight'+(nextArrival(v)?.portId?' · '+nextArrival(v)!.portId:'');
  const dock = nextArrival(v);
  return dock ? `En route · ${dock.portId}` : 'Free flight';
}
function select(id: string) { selected = id;if(tracking!=='off')trackingOffset=[0,0,0]; $('hit-menu').hidden = true; draw();updatePanels(); }
function buildTimeline() {
  const template=document.createElement('template');
  template.innerHTML = [...Object.values(run!.maintained??{}),...run!.vessels].map(v => {
    const maintenance=!!run!.maintained?.[v.id];
    const times = [...new Set([start(), end(), ...v.ledger.map(e => e.t)])].sort((a, b) => a - b);
    const blocks = times.slice(0, -1).map((a, i) => {
      const b = times[i + 1];if(!isPresent(v,(a+b)/2))return '';const state = sampleVessel(v, (a + b) / 2), l = state.logistics, powered=(state.thrust?.force??0)>0;
      const fill = state.entryPhase?(state.entryPhase==='recovered'?'#35434d':powered?'#e9c485':state.entryPhase==='entry'?'#80c6ed':v.color):maintenance?(powered?'#85c9c0':'#35434d'):l?.service ? '#e9c485' : l?.dockedPortId ? '#35434d' : v.color;
      return `<rect x="${1000 * (a - start()) / (end() - start())}" y="${maintenance?(powered?7:9):l?.service || powered ? 3 : 7}" width="${1000 * (b - a) / (end() - start())}" height="${maintenance?(powered?6:2):l?.service || powered ? 14 : 6}" fill="${fill}" opacity="${maintenance?(powered ? .55 : .4):powered?0.95:l?.dockedPortId && !l.service ? 0.8 : 0.65}"/>`;
    }).join('');
    const burns = v.ledger.filter(e => e.kind === 'burn'||e.kind==='separation').map(e => `<path d="M${1000 * (e.t - start()) / (end() - start())} 4v12" stroke="${v.color}" stroke-width="1"/>`).join('');
    return `<div class="timeline-row ${selected===v.id?'selected':''}" data-vessel="${esc(v.id)}"><button class="timeline-name" data-select="${esc(v.id)}" style="color:${v.color}">${esc(v.name)}</button><div class="timeline-track"><svg viewBox="0 0 1000 20" preserveAspectRatio="none" aria-label="${esc(v.name)} ${maintenance?'stationkeeping; small teal spans are corrections':'activity; colored spans are flight, gold is cargo service'}">${blocks}${burns}</svg>${traffic?`<span class="future-region" style="left:${Math.min(100,100*(traffic.frontier-start())/(end()-start()))}%" title="Planned"></span><span class="frontier-cursor" style="left:${Math.min(100,100*(traffic.frontier-start())/(end()-start()))}%" title="Simulation head"></span>`:""}<span class="time-cursor"></span><button class="timeline-seek" aria-label="Scrub ${esc(v.name)} timeline"></button></div></div>`;
  }).join('');
  // Keep interactive rows/buttons alive while forecast spans change. Replacing
  // the whole lane between pointer-down and click loses focus and hover state.
  const lanes=$('timelines'),existing=new Map(Array.from(lanes.querySelectorAll<HTMLElement>('.timeline-row')).map(r=>[r.dataset.vessel!,r]));
  for(const incoming of template.content.querySelectorAll<HTMLElement>('.timeline-row')){
   const row=existing.get(incoming.dataset.vessel!);existing.delete(incoming.dataset.vessel!);
   if(!row){lanes.append(incoming);continue;}
   row.className=incoming.className;
   const name=row.querySelector<HTMLElement>('.timeline-name')!,newName=incoming.querySelector<HTMLElement>('.timeline-name')!;name.textContent=newName.textContent;name.style.cssText=newName.style.cssText;
   const svg=row.querySelector('svg')!,next=incoming.querySelector('svg')!;if(svg.innerHTML!==next.innerHTML)svg.innerHTML=next.innerHTML;
   for(const kind of ['future-region','frontier-cursor']){const marker=row.querySelector<HTMLElement>(`.${kind}`),replacement=incoming.querySelector<HTMLElement>(`.${kind}`);if(marker&&replacement)marker.style.cssText=replacement.style.cssText;else if(replacement)row.querySelector('.timeline-track')!.append(replacement);else marker?.remove();}
  }
  for(const row of existing.values())row.remove();
  document.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(b => b.onclick = () => select(b.dataset.select!));
  document.querySelectorAll<HTMLButtonElement>('.timeline-seek').forEach(b => b.onclick = e => {
    const rect = b.getBoundingClientRect(); seek(start() + (e.clientX - rect.left) / rect.width * (end() - start()));
  });
}
function fuelChart(v:VesselView):string {return `<div class="chart-key"><span>Fuel</span>${run?.maintained?.[v.id]||v.cargoCapacity===0?'':'<span>Freight</span>'}</div>${fuelGraph(v)}`;}
const budgetCursorTransform=()=>`translate(${4+(t-start())/(end()-start())*232},0)`;
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
  return `<svg class="budget-chart" data-start="${start()}" data-end="${end()}" viewBox="0 0 240 72" role="img" aria-label="Fuel and freight over the scene"><path d="M4 64H236" stroke="#33414b"/><path d="${path(s => s.propellant, v.ship.tankCapacity)}" fill="none" stroke="#78c9c0" stroke-width="1.5"/><path d="${path(s => s.logistics?.cargoMass ?? v.ship.cargoMass, v.cargoCapacity ?? 1)}" fill="none" stroke="#efb878" stroke-width="1.5"/><path class="budget-cursor" d="M0 5V66" transform="${budgetCursorTransform()}" stroke="#c7d5de" stroke-opacity="0.6"/></svg>`;
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
  $('load-status').textContent = liveError || (traffic?.halt&&t>=traffic.frontier?traffic.halt:(traffic?liveMode?'':playing?'Playing history':'History held':t===end()?'End of scene':''));
  {const origin=[...run.vessels,...Object.values(run.maintained??{})].find(v=>v.id===frame);if(origin && (!isPresent(origin,t)||sampleVessel(origin,t).activity?.kind==='fault')){frame='inertial';$<HTMLSelectElement>('frame').value=frame;}
   for(const option of $<HTMLSelectElement>('frame').options){const v=[...run.vessels,...Object.values(run.maintained??{})].find(v=>v.id===option.value);option.disabled=!!v && (!isPresent(v,t)||sampleVessel(v,t).activity?.kind==='fault');}}
  $('traffic-count').textContent=String(run.vessels.filter(v=>isPresent(v,t)).length);
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
  $('launch-view').textContent=run.entry||v?.entry&&t>=(v.entry.activeFrom??0)?'Entry view':'Surface view';
  if (key !== inspectorKey) {
    inspectorKey = key;
    const heading = v?.name ?? selected;
    $('inspector').innerHTML = `<div class="section-heading"><h2>${esc(heading)}</h2><button id="object-frame">View from here</button></div><p id="object-status"></p><dl id="readouts"></dl><button id="next-event" class="next-event"></button>${v ? fuelChart(v) : ''}<details id="schedule"><summary>Schedule</summary><div id="event-list"></div></details>`;
    $('object-frame').onclick = () => { frame = selected; $<HTMLSelectElement>('frame').value = frame; fit(); updatePanels(); };
  }
  let upcoming: SetEvent | undefined;
  if(v&&!isPresent(v,t)) {
    $('object-status').textContent=presenceLabel(v,t);
    $('readouts').innerHTML=t<v.lifetime!.start&&v.id===run.staging?.separation.children[1]?`<div><dt>Reserved propellant</dt><dd>${number(v.ship.propellant)}</dd></div>`:'';
    $<HTMLButtonElement>('object-frame').disabled=true;
    upcoming=events.find(e=>e.vessel===v.id&&e.t>t);
  } else if (v) {
    const s = sampleVessel(v, t), cargo = s.logistics?.cargoMass ?? v.ship.cargoMass;
    $('object-status').textContent = status(v);
    const maintenance=run.stations.find(p=>p.id===selected)?.maintenance;
    const used = (v.inheritedFuelUsed??0)+(s.fuelUsed??v.ledger.filter(e => e.t <= t).reduce((sum, e) => sum + e.fuelUsed, 0));
    $('readouts').innerHTML = `${v.cargoCapacity===0?'':`<div><dt>${esc(v.cargo)}</dt><dd>${number(cargo)} / ${number(v.cargoCapacity ?? cargo)}</dd></div>`}<div><dt>${v.id===run.staging?.separation.parentId?'Booster propellant':'Propellant'}</dt><dd>${number(s.propellant)} / ${number(v.ship.tankCapacity)}</dd></div><div><dt>Fuel used</dt><dd>${number(used)}</dd></div>`;
    if(v.id===run.staging?.separation.parentId)$('readouts').innerHTML+=`<div><dt>Carried payload fuel</dt><dd>${number(run.staging.separation.reservedPayloadFuel)}</dd></div>`;
    if(maintenance){const err=orbitError(s.y,maintenance.reference),baseline=displayPortState(portsOf(run).find(p=>p.id===selected)!,{[selected]:run.maintained![selected].baseline},s.activity?.knownEpoch??t),unmaintained=orbitError(baseline,maintenance.reference);$('readouts').innerHTML=`<div><dt>Maintenance fuel</dt><dd>${s.propellant.toFixed(4)} / ${number(v.ship.tankCapacity)}</dd></div><div><dt>Fuel used</dt><dd>${used.toFixed(4)}</dd></div><div><dt>Orbit error · R</dt><dd>${err.position.toExponential(2)}</dd></div><div><dt>Velocity error</dt><dd>${err.velocity.toExponential(2)}</dd></div><div><dt>Unmaintained error · R</dt><dd>${unmaintained.position.toExponential(2)}</dd></div>`;}
    if(v.ship.engine)$('readouts').innerHTML+=`<div><dt>Thrust</dt><dd>${maintenance?(s.thrust?.force??0).toExponential(2):number(s.thrust?.force??0)} / ${number(v.ship.engine.maxThrust)}</dd></div><div><dt>Thrust acceleration</dt><dd>${maintenance?(s.thrust?.acceleration??0).toExponential(2):number(s.thrust?.acceleration??0)}</dd></div>`;
    if(v.entry||v.aerodynamics) {
      const a=s.aero,body=run.world.bodies[0],r=Math.hypot(...s.y.slice(0,3).map((x,i)=>x-bodyState(body,t)[i]));
      const pressure=a?.dynamicPressure??0,drag=Math.hypot(...(a?.drag??[0,0,0])),lift=Math.hypot(...(a?.lift??[0,0,0]));
      const load=Math.hypot(...[0,1,2].map(i=>(a?.drag[i]??0)+(a?.lift[i]??0)+(s.thrust? s.thrust.force*s.thrust.direction[i]:0)))/(s.mass??1);
      $('readouts').innerHTML+=`<div><dt>Altitude · R</dt><dd>${(r-body.radius).toFixed(5)}</dd></div><div><dt>Air speed</dt><dd>${Math.hypot(...(a?.relativeVelocity??[0,0,0])).toFixed(4)}</dd></div><div><dt>Density</dt><dd>${(a?.density??0).toExponential(2)}</dd></div><div><dt>Dynamic pressure</dt><dd>${pressure.toFixed(4)}</dd></div><div><dt>Lift / drag</dt><dd>${(drag>0?lift/drag:0).toFixed(3)}</dd></div><div><dt>Flight load</dt><dd>${load.toFixed(3)}</dd></div>${s.entryPhase==='recovered'?`<div><dt>Recovery speed</dt><dd>${(run.recoveries?.[v.id]??run.entry!).relativeSpeed.toFixed(4)}</dd></div>`:''}`;
    }
    if(v.ports.some(p=>p.rail.kind==='surface')) {
      const body=run.world.bodies[0],b=bodyState(body,t),dx=s.y[0]-b[0],dy=s.y[1]-b[1],r=Math.hypot(dx,dy),vx=s.y[3]-b[3],vy=s.y[4]-b[4];
      const small=(x:number)=>Math.abs(x)<1e-12?'0.0000':Math.abs(x)<.001?x.toExponential(2):x.toFixed(4);
      const mass=v.ship.dryMass+cargo+s.propellant;
      $('readouts').innerHTML+=`${v.entry||v.aerodynamics?'':`<div><dt>Altitude · R</dt><dd>${small(r-body.radius)}</dd></div>`}<div><dt>Radial speed</dt><dd>${small((dx*vx+dy*vy)/r)}</dd></div><div><dt>Tangential speed</dt><dd>${small((dx*vy-dy*vx)/r)}</dd></div><div><dt>Thrust / weight</dt><dd>${number((s.thrust?.force??0)/mass/(body.mu/r**2))}</dd></div>`;
    }
    $<HTMLButtonElement>('object-frame').disabled=s.activity?.kind==='fault';
    if(s.activity?.reason)$('readouts').innerHTML+=`<div class="fault-reason">${esc(s.activity.reason)}</div>`;
    if(s.activity?.retryAt!==undefined)$('readouts').innerHTML+=`<div><dt>Retry</dt><dd>${number(s.activity.retryAt)}</dd></div>`;
    const local=s.activity?.kind==='fault'?[0,0,0,0,0,0]:transform(run,s.y,t,frame);
    if(Math.abs(local[2])+Math.abs(local[5])>1e-9)$('readouts').innerHTML+=`<div><dt>Z position</dt><dd>${number(local[2])}</dd></div><div><dt>Z velocity</dt><dd>${number(local[5])}</dd></div>`;
    const cursor = document.querySelector<SVGPathElement>('.budget-cursor');
    cursor?.setAttribute('transform', budgetCursorTransform());
    upcoming = events.find(e => e.vessel === selected && e.t > t + 1e-9 && e.kind !== 'burn');
  } else {
    const station = run.stations.find(s => s.id === selected), stock = stocks.find(s => s.id === selected);
    const body = run.world.bodies.find(b => b.id === selected);
    $('object-status').textContent = station?.role ?? 'Gravity source';
    $('readouts').innerHTML = stock ? `<div><dt>Freight stock</dt><dd>${number(stock.cargo)}</dd></div><div><dt>Propellant stock</dt><dd>${number(stock.propellant)}</dd></div><div><dt>Berths</dt><dd>${stock.occupied} / ${station!.berths}</dd></div>` : `<div><dt>Gravitational μ</dt><dd>${number(body!.mu)}</dd></div>`;
    upcoming = events.find(e => e.portId === selected && e.t > t + 1e-9 && (e.kind === 'dock'||e.kind==='land'||e.kind==='splashdown'));
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
  document.querySelectorAll<HTMLElement>('.timeline-row').forEach(r => r.classList.toggle('selected', r.dataset.vessel === selected));
  $('frame-name').textContent = $<HTMLSelectElement>('frame').selectedOptions[0]?.textContent ?? '';
  publishState();
}
function publishState() {
  $('state-json').textContent = JSON.stringify({ready, revision, set: run?.id, t, playing, playbackRate, frame, selected, layers, traffic:traffic?{frontier:traffic.frontier,oldest:traffic.oldest,pending,sequence,live:liveMode,stats:run?.traffic?.stats,halt:traffic.halt,error:liveError}:undefined,
    staging:run?.staging,entry:run?.entry,recoveries:run?.recoveries,aeroVectors,
    ships: run?.vessels.map(v => !isPresent(v,t)?({id:v.id,present:false,lifetime:v.lifetime}):({id: v.id,present:true, ...sampleVessel(v, t), ...(v.glyph?{glyph:v.glyph,axis:rocketAxis(v,sampleVessel(v,t),t)}:{}), screen: project(sampleVessel(v,t).y,sampleVessel(v,t).activity?.knownEpoch??t),occludedBy:occluder(project3(sampleVessel(v,t).y,sampleVessel(v,t).activity?.knownEpoch??t),spheres)?.id})),
    labels:placedLabels.map(({id,anchor,alpha,left,top})=>({id,anchor,alpha,left,top})),
    maintenance:run?.maintained?Object.fromEntries(Object.entries(run.maintained).map(([id,v])=>[id,{...sampleVessel(v,t),error:orbitError(sampleVessel(v,t).y,run!.stations.find(p=>p.id===id)!.maintenance!.reference)}])):undefined,
    stocks: run ? stockAt(run, t) : [], events, thrustWhiskers, camera: {...camera,preset:cameraPreset,panMode,tracking,trackingOffset}, seeThroughBodies, hits});
}
function loadSet(id: string) {
  if(currentSet)setSpeeds.set(currentSet,playbackRate);currentSet=id;
  playbackRate=setSpeeds.get(id)??(['selene-staging','aster-entry','aster-launch'].includes(id)?.1:1);
  const speed=$<HTMLInputElement>('speed');speed.max=String(Math.log2(maximumPlaybackRate(id)));playbackRate=Math.min(playbackRate,maximumPlaybackRate(id));speed.value=String(Math.log2(playbackRate));showSpeed();
  const continuous=trafficSets.find(d=>d.id===id);
  const set = sets.find(s => s.id === id)!;
  tracking='off';trackingOffset=[0,0,0];delete camera.rig;labelLayout.reset();placedLabels=[];hovered='';cameraPreset=['crossing-planes','orison-steered','orison-maintained','orison-maintained-service','orison-flexible-service','orison-relay-network'].includes(id)?'oblique':'top';orient(camera,cameraPreset);panMode=false;cameraControls();
  worker?.terminate();traffic=undefined;pending=false;sequence=0;desiredTarget=0;liveError='';liveMode=true;trafficDirty=false;revision++; ready = false; playing = false; run = undefined; t = 0; inspectorKey = '';
  $('load-status').textContent = 'Preparing scene…';
  $<HTMLButtonElement>('play').disabled = true; $('fleet').innerHTML = ''; $('stations').innerHTML = ''; $('inspector').innerHTML = ''; $('timelines').innerHTML = '';
  $('state-json').textContent = JSON.stringify({ready, revision});
  $('launch-view').hidden=true;document.querySelectorAll<HTMLElement>('.entry-layer').forEach(e=>e.hidden=true);
  $('live').hidden=!continuous;document.querySelector<HTMLElement>('.replay')!.hidden=!!continuous;
  $('restart').title=continuous?'Restart run':'Rewind';
  if(continuous){loadTraffic(continuous);return;}
  worker = new PrepareWorker({name:'scene-prepare'});
  const currentRevision = revision;
  worker.onmessage = (e: MessageEvent<{revision: number; run?: SceneView; error?: string}>) => {
    if (e.data.revision !== revision || currentRevision !== revision) return;
    if (e.data.error) { $('load-status').textContent = e.data.error; return; }
    run = e.data.run!; events = setEvents(run); ready = true; selected = Object.keys(run.maintained??{})[0]??run.vessels[0].id;
    $('launch-view').hidden=!run.entry&&!run.world.ports.some(p=>p.rail.kind==='surface');$('launch-view').textContent=run.entry?'Entry view':'Surface view';document.querySelectorAll<HTMLElement>('.entry-layer').forEach(e=>e.hidden=!run!.atmosphere);
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

function loadTraffic(definition:TrafficDefinition|MaintainedDefinition|AdaptiveDefinition|NetworkDefinition){
 traffic=isNetwork(definition)?new NetworkViewStore(definition):isAdaptive(definition)?new AdaptiveViewStore(definition):isMaintained(definition)?new MaintainedViewStore(definition):new TrafficViewStore(definition);
 worker=new TrafficWorker({name:'continuous-traffic'});
 const generation=revision;pending=true;
 worker.onmessage=(e:MessageEvent<{generation:number;sequence:number;delta?:TrafficDelta|MaintainedDelta|AdaptiveDelta|NetworkDelta;error?:string}>)=>{
  if(generation!==revision || e.data.generation!==revision || e.data.sequence!==sequence)return;
  pending=false;
  if(e.data.error){liveError=`Simulation stopped: ${e.data.error}`;playing=playing&&ready&&!!playbackLead()&&t<traffic!.frontier;if(!playbackLead())liveMode=false;$('load-status').textContent=liveError;updatePanels();return;}
  const first=!ready,previousFrontier=traffic!.frontier;if(traffic instanceof NetworkViewStore)traffic.ingest(e.data.delta! as NetworkDelta,!liveMode || !playing && !first);else if(traffic instanceof AdaptiveViewStore)traffic.ingest(e.data.delta! as AdaptiveDelta,!liveMode || !playing && !first);else if(traffic instanceof MaintainedViewStore)traffic.ingest(e.data.delta! as MaintainedDelta,!liveMode || !playing && !first);else traffic!.ingest(e.data.delta! as TrafficDelta,!liveMode || !playing && !first);
  if(first){ready=true;selected=traffic instanceof NetworkViewStore?traffic.definition.lanes[0].vessels[0].id:traffic!.definition.vessels[0].id;frame='inertial';t=0;playing=true;}
  else if(liveMode && playing && !playbackLead())t=traffic!.frontier;
  // Solver yields often acknowledge an unchanged head. Batch drawing-history
  // assembly with the panel cadence instead of rebuilding it for every reply.
  if(first || previousFrontier!==traffic!.frontier){
   if(first || !playing || t>run!.window.end || performance.now()-lastPanel>100)refreshTraffic();else trafficDirty=true;
  }
  if(first){$('launch-view').hidden=!run!.world.ports.some(p=>p.rail.kind==='surface');$('frame').innerHTML=`<option value="inertial">Inertial</option><option value="rotating">${esc(run!.rotating.name)}</option>`+[...run!.world.bodies.map(b=>[b.id,b.id]),...run!.stations.map(s=>[s.id,s.id]),...run!.vessels.map(v=>[v.id,v.name])].map(([id,name])=>`<option value="${esc(id)}">${esc(name)} centered</option>`).join('');
   $('description').textContent=run!.description;$('provenance').textContent=run!.provenance;$('traffic-count').textContent=String(run!.vessels.length);$<HTMLButtonElement>('play').disabled=false;fit();}
  if(first)updatePanels();
 };
 worker.onerror=(event)=>{if(generation===revision){pending=false;liveError=`Simulation stopped: ${event.message||'worker failed'}`;playing=playing&&ready&&!!playbackLead()&&t<traffic!.frontier;if(!playbackLead())liveMode=false;$('load-status').textContent=liveError;updatePanels();}};
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
function worldPath(points:ScreenPoint[],color:string,lineWidth=1,alpha=1,dash:number[]=[]) {
 ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.globalAlpha=alpha;ctx.setLineDash(dash);
 let previous:ScreenPoint|undefined,last:ScreenPoint|undefined;
 for(let i=0;i<points.length;i++) {
  const p=points[i];if(!p.every(Number.isFinite)){previous=last=undefined;continue;}
  if(previous && i!==points.length-1 && Math.hypot(...p.map((x,j)=>x-previous![j]))<.1)continue;
  if(previous)for(const [a,b] of visibleSegment(previous,p,spheres)) {
   if(!last || Math.hypot(a[0]-last[0],a[1]-last[1])>1e-6)ctx.moveTo(a[0],a[1]);
   ctx.lineTo(b[0],b[1]);last=b;
  }
  previous=p;
 }
 ctx.stroke();ctx.globalAlpha=1;ctx.setLineDash([]);
}
function draw() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0c141d'; ctx.fillRect(0, 0, width, height);
  // Quiet schematic background; no decorative planetary rendering.
  ctx.fillStyle = '#7e98aa';
  for (let i = 0; i < 65; i++) { ctx.globalAlpha = 0.12 + (i % 4) * 0.035; ctx.fillRect((i * 313.47) % width, (i * 137.33) % height, 1, 1); }
  ctx.globalAlpha = 1;
  if (!run || !ready) return;
  const reference=[...run.vessels,...Object.values(run.maintained??{})].find(v=>v.id===frame);if(reference && (!isPresent(reference,t)||sampleVessel(reference,t).activity?.kind==='fault')){frame='inertial';$<HTMLSelectElement>('frame').value=frame;}
  syncTracking();
  hits = [];thrustWhiskers=[];aeroVectors=[];
  const scenario = run.world;
  const labelRequests:Label[]=[];
  spheres=seeThroughBodies?[]:scenario.bodies.map(body=>({id:body.id,point:project3(bodyState(body,t),t),radius:Math.max(7,body.radius*camera.scale)}));
  for (const body of [...scenario.bodies].sort((a,b)=>project3(bodyState(a,t),t)[2]-project3(bodyState(b,t),t)[2])) {
    const p = project(bodyState(body, t), t), r = Math.max(7, body.radius * camera.scale);
    ctx.beginPath(); ctx.arc(...p, r, 0, Math.PI * 2); ctx.fillStyle = '#192a37';ctx.globalAlpha=seeThroughBodies?.18:1;ctx.fill();ctx.globalAlpha=seeThroughBodies?.45:1;ctx.strokeStyle = '#445c6e'; ctx.lineWidth = 1; ctx.stroke();ctx.globalAlpha=1;
    if (selected === body.id) { ctx.beginPath(); ctx.arc(...p, r + 5, 0, Math.PI * 2); ctx.strokeStyle = '#b2c6d2'; ctx.stroke(); }
    if(!occluder(project3(bodyState(body,t),t),spheres.filter(s=>s.id!==body.id)))label(body.id, body.id === 'primary' ? 'Planet' : body.id === 'moon' ? 'Selene' : body.id, p[0] + r, p[1], colors.body);
    hits.push({id:body.id,name:body.id,x:p[0],y:p[1],depth:project3(bodyState(body,t),t)[2],radius:r});
  }
  if(layers.atmosphere&&run.atmosphere) {
    const a=run.atmosphere,body=run.world.bodies.find(b=>b.id===a.bodyId)!,p=project(bodyState(body,t),t),r=body.radius*camera.scale,outer=(body.radius+a.topHeight)*camera.scale;
    const gradient=ctx.createRadialGradient(p[0],p[1],r,p[0],p[1],outer);
    for(let i=0;i<=16;i++){const u=i/16,alpha=.22*densityAt(a,u*a.topHeight)/a.density;gradient.addColorStop(u,`rgba(104,174,211,${Number.isFinite(alpha)?alpha:0})`);}
    ctx.beginPath();ctx.arc(...p,outer,0,2*Math.PI);ctx.arc(...p,r,0,2*Math.PI,true);ctx.fillStyle=gradient;ctx.fill('evenodd');
    for(const ratio of [.1,.01,.001]){const h=-a.scaleHeight*Math.log(ratio);if(h>=a.topHeight)continue;ctx.beginPath();ctx.arc(...p,(body.radius+h)*camera.scale,0,2*Math.PI);ctx.strokeStyle='rgba(128,198,237,.12)';ctx.lineWidth=.7;ctx.stroke();}
  }
  if (layers.orbits) {
    const orbitEpochs = (period: number) => {
      const duration = Math.min(period, end() - start());
      const first = Math.max(start(), Math.min(t - duration / 2, end() - duration));
      return Array.from({length: 161}, (_, i) => first + duration * i / 160);
    };
    for (const port of portsOf(run)) {
      if(port.rail.kind==='surface')continue;
      if((port.rail.kind==='ballistic'||port.rail.kind==='powered')){worldPath(run.portSamples[port.id].filter(s=>Math.abs(s.t-t)<3).map(s=>project3(s.y,s.t)),'#647c8d',.8,.3);continue;}
      const period = 2 * Math.PI / port.rail.rate;
      worldPath(orbitEpochs(period).map(epoch => project3(displayPortState(port,run!.portSamples,epoch), epoch)), '#647c8d', 0.8, 0.3);
    }
    for(const [id,v] of Object.entries(run.maintained??{}))if(id===selected&&sampleVessel(v,t).activity?.kind!=='fault'){
      const reference=run.stations.find(p=>p.id===id)!.maintenance!.reference;
      worldPath(orbitEpochs(2*Math.PI/reference.rate).map(epoch=>project3(bodyState({id:'nominal',mu:1,radius:0,rail:reference},epoch),epoch)),'#89a9b7',.8,.25,[2,5]);
      worldPath(v.baseline.filter(s=>Math.abs(s.t-t)<8).map(s=>project3(s.y,s.t)),'#b19ab4',1,.45,[4,5]);
      const baseline=project3(displayPortState(portsOf(run).find(p=>p.id===id)!,{[id]:v.baseline},t),t);
      if(!occluder(baseline,spheres)){ctx.beginPath();ctx.arc(baseline[0],baseline[1],4,0,2*Math.PI);ctx.strokeStyle='#b19ab4';ctx.stroke();}
    }
    for (const body of scenario.bodies.filter(b => b.rail.kind === 'circular')) {
      const rail = body.rail as Extract<typeof body.rail, {kind: 'circular'}>, period = 2 * Math.PI / Math.abs(rail.rate);
      worldPath(orbitEpochs(period).map(epoch => project3(bodyState(body, epoch), epoch)), '#647c8d', 0.8, 0.2);
    }
  }
  for (const v of [...run.vessels,...Object.values(run.maintained??{})]) {
    const id = v.id, isSelected = id === selected;
    if (layers.trails) {
      const trailStart = Math.max(start(), t - (run.id === 'lunar-loop' ? 9 : 12));
      let prev: ScreenPoint | undefined,chunk:ScreenPoint[]=[],shade=-1;
      for (const sample of v.samples) {
        if (sample.t < trailStart || sample.t > t || sample.activity?.kind==='fault') continue;
        const p = project3(sample.y, sample.t);
        const alpha=Math.round(32*(isSelected ? 0.7 : 0.4)*Math.exp(-(t-sample.t)/4));
        if(alpha!==shade && chunk.length){worldPath(chunk,v.color,isSelected?1.7:1.1,shade/32);chunk=prev?[prev]:[];}
        chunk.push(p);shade=alpha;
        prev = p;
      }
      if(chunk.length)worldPath(chunk,v.color,isSelected?1.7:1.1,shade/32);
      if (prev && isPresent(v,t) && sampleVessel(v,t).activity?.kind!=='fault') worldPath([prev, project3(sampleVessel(v, t).y, t)], v.color, 1.5, 0.75);
    }
    if (layers.plan && isSelected && (!isPresent(v,t)||sampleVessel(v,t).activity?.kind!=='fault')) {
      const stop = nextArrival(v)?.t ?? Math.min(end(), t + (run.id === 'lunar-loop' ? 5.58 : 8));
      worldPath([...(isPresent(v,t)?[project3(sampleVessel(v,t).y,t)]:[]), ...v.samples.filter(s => s.t > t && s.t <= stop).map(s => project3(s.y, s.t))], '#b5bdc7', 1, 0.28, [3, 5]);
    }
    if(layers.plan && isSelected)for(const arc of [...v.arcs,...(v.entry?[{id:'terminal-braking',start:v.entry.brakingEpoch,end:v.entry.recovery.t,direction:[0,0,0] as Vec3,throttle:1}]:[])]) {
      const stop=nextArrival(v)?.t??end();
      if(arc.throttle===0 || arc.end<=t || arc.start>=stop || arc.end>end() || isPresent(v,t)&&sampleVessel(v,t).activity?.kind==='fault')continue;
      const curve=[project3(sampleVessel(v,Math.max(start(),arc.start)).y,Math.max(start(),arc.start)),...v.samples.filter(s=>s.t>arc.start && s.t<arc.end).map(s=>project3(s.y,s.t)),project3(sampleVessel(v,arc.end).y,arc.end)];
      const length=curve.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-curve[i][0],p[1]-curve[i][1]),0);
      const maintenance=!!run.maintained?.[id];
      const count=Math.max(2,Math.min(maintenance?12:40,Math.ceil(length/(maintenance?32:14))));
      // Samples stay anchored to the whole arc, so whiskers disappear as flown
      // rather than crawling along the remaining portion during playback.
      for(let i=0;i<count;i++) {
        const epoch=arc.start+(i+.5)/count*(arc.end-arc.start);
        if(epoch<t || epoch>stop)continue;
        const sample=sampleVessel(v,epoch),force=sample.thrust?.force??0;
        const point=project3(sample.y,epoch),d=cameraVector(camera,transformDirection(run,sample.thrust?.direction??directionAt(arc,epoch-arc.start),epoch,frame)),n=Math.hypot(d[0],d[1]);
        if(n<1e-10 || force<=0)continue;
        // Exhaust-side whiskers share the ship's burn schematic convention.
        // A visibility floor and square-root scale show small burns without
        // letting large engines dominate the drawing. Force includes cap taper.
        const pixels=maintenance?2+7*Math.sqrt(Math.min(1,force/v.ship.engine!.maxThrust)):3+15*Math.sqrt(Math.min(1,force/v.ship.engine!.maxThrust));
        const tip:ScreenPoint=[point[0]-d[0]*pixels,point[1]+d[1]*pixels,point[2]-d[2]*pixels];
        if(occluder(point,spheres))continue;
        worldPath([point,tip],maintenance?'#85c9c0':'#f0cf8f',maintenance ? .8 : 1,maintenance ? .4 : .75);
        thrustWhiskers.push({vessel:id,t:epoch,force,from:[point[0],point[1]],to:[tip[0],tip[1]]});
      }
    }
  }
  function label(id: string, text: string, x: number, y: number, color: string) {
    if (!layers.labels) return;
    ctx.font='11px ui-sans-serif, system-ui';
    labelRequests.push({id,text,x,y,color,width:ctx.measureText(text).width,priority:id===selected?100:id===hovered?90:0});
  }
  const icons:{depth:number;draw:()=>void}[]=[];
  for (const port of portsOf(run)) {
    const powered=run.maintained?.[port.id],known=powered?sampleVessel(powered,t):undefined,epoch=known?.activity?.kind==='fault'?known.activity.knownEpoch!:t;
    const state=known?.activity?.kind==='fault'?known.y:displayPortState(port,run.portSamples,t);
    if(port.rail.kind==='surface'){const rail=port.rail,body=run.world.bodies.find(b=>b.id===rail.bodyId)!;for(let i=0;i<3;i++)state[i]=rail.center[i]+(state[i]-rail.center[i])*body.radius/rail.radius;}
    const p3=project3(state,epoch);if(occluder(p3,spheres))continue;
    const p:[number,number]=[p3[0],p3[1]];
    icons.push({depth:p3[2],draw:()=>{
    if(port.rail.kind==='surface') {
      const rail=port.rail,theta=rail.phase+rail.rate*t;
      const outward=cameraVector(camera,transformDirection(run!,[Math.cos(theta),Math.sin(theta),0],t,frame));
      ctx.save();ctx.translate(...p);ctx.rotate(Math.atan2(-outward[1],outward[0]));
      path([[0,-7],[0,7]],colors.station,2);path([[0,-7],[4,-7]],colors.station,1);path([[0,7],[4,7]],colors.station,1);ctx.restore();
    } else {
    ctx.save(); ctx.translate(...p); ctx.rotate(Math.PI / 4); ctx.strokeStyle = colors.station; ctx.lineWidth = 1.2; ctx.strokeRect(-4, -4, 8, 8); ctx.restore();
    }
    const thrust=known?.thrust;
    if(selected===port.id && thrust && thrust.force>0){const d=cameraVector(camera,transformDirection(run!,thrust.direction,t,frame));path([[p[0]-d[0]*5,p[1]+d[1]*5],[p[0]-d[0]*15,p[1]+d[1]*15]],'#ffe0a0',2,.9);}
    if (selected === port.id) { ctx.beginPath(); ctx.arc(...p, 10, 0, Math.PI * 2); ctx.strokeStyle = '#c7d5de'; ctx.stroke(); }
    if(known?.activity?.kind==='fault'){path([[p[0]-5,p[1]-5],[p[0]+5,p[1]+5]],'#ef8a81',2);path([[p[0]-5,p[1]+5],[p[0]+5,p[1]-5]],'#ef8a81',2);}
    label(port.id, port.id+(known?.activity?.kind==='fault'?' · fault':''), ...p, '#a7bac7'); hits.push({id: port.id, name: port.id, x: p[0], y: p[1],depth:p3[2]});
    }});
  }
  for (const v of run.vessels) {
    if(!isPresent(v,t))continue;
    const state=sampleVessel(v,t),epoch=state.activity?.kind==='fault'?state.activity.knownEpoch!:t,p=project(state.y,epoch);
    if(!p.every(Number.isFinite) || occluder(project3(state.y,epoch),spheres))continue;
    const transformed=transform(run,state.y,epoch,frame),velocity=cameraVector(camera,transformed.slice(3));
    icons.push({depth:project3(state.y,epoch)[2],draw:()=>{
    if(state.activity?.kind==='fault'){path([[p[0]-5,p[1]-5],[p[0]+5,p[1]+5]],'#ef8a81',2);path([[p[0]-5,p[1]+5],[p[0]+5,p[1]-5]],'#ef8a81',2);label(v.id,`${v.name} · fault`,...p,'#ef8a81');hits.push({id:v.id,name:v.name,x:p[0],y:p[1],depth:project3(state.y,epoch)[2]});return;}
    if(layers.glow&&state.aero&&state.aero.heatProxy>1e-8) {
      const intensity=Math.min(1,state.aero.heatProxy/(v.entry?.heatScale??1)),radius=10+15*Math.sqrt(intensity),d=cameraVector(camera,transformDirection(run!,state.aero.relativeVelocity,t,frame));
      ctx.save();ctx.translate(...p);ctx.rotate(Math.atan2(-d[1],d[0]));ctx.scale(1,.65);
      const glow=ctx.createRadialGradient(4,0,1,4,0,radius);glow.addColorStop(0,`rgba(255,225,158,${intensity*.75})`);glow.addColorStop(.35,`rgba(245,145,93,${intensity*.5})`);glow.addColorStop(1,'rgba(245,145,93,0)');
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(4,0,radius,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(layers.aero&&selected===v.id&&state.aero)for(const [kind,vector,color] of [['drag',state.aero.drag,'#80c6ed'],['lift',state.aero.lift,'#bb9fee']] as const) {
      const force=Math.hypot(...vector);if(force<1e-10)continue;
      const d=cameraVector(camera,transformDirection(run!,vector.map(x=>x/force) as Vec3,t,frame)),pixels=40*Math.sqrt(force/(1+force)),origin=project3(state.y,t),tip:ScreenPoint=[origin[0]+d[0]*pixels,origin[1]-d[1]*pixels,origin[2]+d[2]*pixels];
      worldPath([origin,tip],color,1.5,.9);
      const length=Math.hypot(tip[0]-origin[0],tip[1]-origin[1]);
      if(length>2){const x=(tip[0]-origin[0])/length,y=(tip[1]-origin[1])/length;path([[tip[0]-x*5-y*3,tip[1]-y*5+x*3],[tip[0],tip[1]],[tip[0]-x*5+y*3,tip[1]-y*5-x*3]],color,1.5,.9);}
      aeroVectors.push({vessel:v.id,kind,force,from:p,to:[tip[0],tip[1]]});
    }
    if(state.thrust && state.thrust.force>0) {
      const direction=cameraVector(camera,transformDirection(run!,state.thrust.direction,t,frame)),dx=direction[0],dy=-direction[1],length=Math.hypot(dx,dy);
      if(length>1e-10)path([[p[0]-dx*5,p[1]-dy*5],[p[0]-dx*15,p[1]-dy*15]],'#ffe0a0',2,.9);
    }
    ctx.save();ctx.translate(...p);
    if(v.glyph)drawRocket(ctx,v.glyph,v.color,cameraVector(camera,transformDirection(run!,rocketAxis(v,state,t),t,frame)));
    else {
      const angle=Math.hypot(velocity[0],velocity[1])>1e-10?Math.atan2(-velocity[1],velocity[0]):0;
      ctx.rotate(angle);ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-4,-3.5);ctx.lineTo(-2,0);ctx.lineTo(-4,3.5);ctx.closePath();ctx.fillStyle=v.color;ctx.fill();
    }
    ctx.restore();
    if (selected === v.id) { ctx.beginPath(); ctx.arc(...p, 11, 0, Math.PI * 2); ctx.strokeStyle = v.color; ctx.globalAlpha = 0.65; ctx.stroke(); ctx.globalAlpha = 1; }
    if (!state.logistics?.dockedPortId || selected===v.id) label(v.id, v.name, ...p, v.color);
    hits.push({id: v.id, name: v.name, x: p[0], y: p[1],depth:project3(state.y,epoch)[2]});
    }});
  }
  icons.sort((a,b)=>a.depth-b.depth).forEach(icon=>icon.draw());
  placedLabels=labelLayout.layout(labelRequests,performance.now());
  ctx.font='11px ui-sans-serif, system-ui';
  for(const l of placedLabels){ctx.globalAlpha=l.alpha;ctx.fillStyle=l.color;ctx.fillText(l.text,l.left,l.top);}
  ctx.globalAlpha=1;
  if(cameraPreset!=='top')for(const [i,color] of ['#d99086','#96bb8e','#8caed8'].entries()) {
    const unit=[0,0,0];unit[i]=1;const d=cameraVector(camera,unit);
    const origin:[number,number]=[width-45,height-43],tip:[number,number]=[origin[0]+d[0]*24,origin[1]-d[1]*24];
    path([origin,tip],color,1.5,.85);ctx.fillStyle=color;ctx.font='10px ui-monospace';ctx.fillText('XYZ'[i],tip[0]+3,tip[1]-3);
  }
  ctx.fillStyle = '#4c6477'; ctx.font = '10px ui-monospace, monospace';
  const unit = 10 ** Math.floor(Math.log10(80 / camera.scale));
  const bar = unit * camera.scale; ctx.fillRect(20, height - 22, bar, 1); ctx.fillText(`${Number(unit.toPrecision(2))} ${run.world.units.length}`, 20, height - 29);
}

$<HTMLSelectElement>('set').onchange = e => loadSet((e.target as HTMLSelectElement).value);
$<HTMLSelectElement>('frame').onchange = e => { frame = (e.target as HTMLSelectElement).value; fit(); updatePanels(); };
$('camera-view').onchange=e=>{const p=(e.target as HTMLSelectElement).value;if(p!=='custom')setCamera(p as CameraPreset);};
$('drag-mode').onclick=()=>{panMode=!panMode;cameraControls();};
$('tracking').onchange=e=>track((e.target as HTMLSelectElement).value as typeof tracking);
$('fit').onclick = ()=>{track('off');fit();draw();updatePanels();};
$('launch-view').onclick=()=>{
  if(run?.entry||vessel()?.entry&&t>=(vessel()!.entry!.activeFrom??0)){frame='inertial';$<HTMLSelectElement>('frame').value=frame;setCamera('top');track('follow');camera.scale=Math.min(width,height)/.3;updatePanels();return;}
  const pad=run?.world.ports.find(p=>p.rail.kind==='surface');if(!pad)return;
  track('off');frame=pad.id;$<HTMLSelectElement>('frame').value=frame;
  const theta=pad.rail.kind==='surface'?pad.rail.phase+pad.rail.rate*t:0;
  setCamera('top');camera.center=[Math.cos(theta)*.075,Math.sin(theta)*.075,0];camera.scale=Math.min(width,height)/.22;updatePanels();
};
$('play').onclick=()=>{if(!ready)return;if(!traffic && t>=end())t=start();playing=!playing;if(traffic && !playing){liveMode=false;refreshTraffic();}lastFrame=performance.now();updatePanels();};
$('live').onclick=goLive;
$('restart').onclick=()=>{if(ready){if(traffic)loadSet(traffic.definition.id);else seek(start());}};
$<HTMLInputElement>('time').oninput = e => seek(Number((e.target as HTMLInputElement).value));
for (const key of Object.keys(layers) as (keyof typeof layers)[]) {
  $<HTMLInputElement>(`layer-${key}`).onchange = e => { layers[key] = (e.target as HTMLInputElement).checked; cleared = false; $('clear-view').setAttribute('aria-pressed', 'false'); draw();updatePanels(); };
}
$<HTMLInputElement>('see-through').onchange=e=>{seeThroughBodies=(e.target as HTMLInputElement).checked;draw();updatePanels();};
$('clear-view').onclick = () => {
  if (!cleared) {savedLayers = {...layers}; layers = {orbits: false, trails: false, plan: false, labels: false,atmosphere:false,aero:false,glow:false};}
  else layers = {...savedLayers};
  cleared = !cleared; $('clear-view').setAttribute('aria-pressed', String(cleared));
  for (const key of Object.keys(layers) as (keyof typeof layers)[]) $<HTMLInputElement>(`layer-${key}`).checked = layers[key];
  updatePanels();
};
new ResizeObserver(() => {
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  width = rect.width; height = rect.height; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fit();
}).observe(canvas);
let drag: {x:number;y:number;camera:Camera;rotate:boolean;moved:boolean} | undefined;
canvas.oncontextmenu=e=>e.preventDefault();
function hitAt(x:number,y:number) {
 return hits.filter(h=>{
  const r=h.radius??14,dx=x-h.x,dy=y-h.y;if(Math.hypot(dx,dy)>=r)return false;
  return !h.radius || !occluder([x,y,h.depth+Math.sqrt(Math.max(0,r*r-dx*dx-dy*dy))],spheres.filter(s=>s.id!==h.id));
 }).sort((a,b)=>b.depth-a.depth);
}
canvas.onpointerdown=e=>{if(e.button>2)return;canvas.focus();canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,camera:structuredClone(camera),rotate:cameraPreset!=='top'&&!panMode&&!e.shiftKey&&e.button===0,moved:false};$('hit-menu').hidden=true;};
canvas.onpointermove=e=>{
 if(!drag){const r=canvas.getBoundingClientRect();hovered=hitAt(e.clientX-r.left,e.clientY-r.top)[0]?.id??'';return;}
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved||=Math.hypot(dx,dy)>4;
 if(drag.moved){Object.assign(camera,structuredClone(drag.camera));if(drag.rotate){orbitAround(camera,pivot(),dx,dy);cameraPreset='custom';cameraControls();}else pan(camera,dx,dy);captureTrackingOffset();}
};
canvas.onpointerup = e => {
  if (!drag) return;
  const moved = drag.moved; drag = undefined;
  if (moved || e.button!==0) return;
  const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
  const found = hitAt(x,y);
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
  const rect=canvas.getBoundingClientRect();zoom(camera,Math.exp(-e.deltaY*.0015),e.clientX-rect.left-width/2,e.clientY-rect.top-height/2);captureTrackingOffset();
}, {passive: false});
document.addEventListener('pointerdown', e => { if (!canvas.contains(e.target as Node) && !$('hit-menu').contains(e.target as Node)) $('hit-menu').hidden = true; });
document.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).matches('input, select, button, summary')) return;
  if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
  if (e.key.toLowerCase() === 'f') $('fit').click();
  if (e.key.toLowerCase() === 't')setCamera('top');
  if(e.target===canvas && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();const dx=e.key==='ArrowLeft'?-18:e.key==='ArrowRight'?18:0,dy=e.key==='ArrowUp'?-18:e.key==='ArrowDown'?18:0;
    if(e.shiftKey || cameraPreset==='top' || panMode)pan(camera,dx,dy);else{orbitAround(camera,pivot(),dx,dy);cameraPreset='custom';cameraControls();}captureTrackingOffset();
  }
  if (e.key === 'Escape') $('hit-menu').hidden = true;
});
function showSpeed(){
  const text = `${playbackRate < .01 ? Number(playbackRate.toPrecision(3)) : playbackRate<1 ? playbackRate.toFixed(2) : Number(playbackRate.toFixed(2))}×`;
  $('speed-value').textContent = text;
  $('speed').setAttribute('aria-valuetext', text);
}
$<HTMLInputElement>('speed').oninput = () => {
  playbackRate = Math.min(maximumPlaybackRate(run?.id??''),2 ** Number($<HTMLInputElement>('speed').value));showSpeed();
  if (ready) updatePanels();
};
function animate(now: number) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  if(ready && playing && traffic && !document.hidden){
   if(liveMode){
    if(playbackLead()){t=Math.min(traffic.frontier,t+dt*playbackRate);desiredTarget=t+playbackLead();if((traffic.halt||liveError)&&t>=traffic.frontier)playing=false;if(now-lastPanel>100||t>run!.window.end||t>run!.traffic!.frontier)refreshTraffic();}
    else desiredTarget=Math.min(traffic.frontier+1,Math.max(traffic.frontier,desiredTarget)+dt*playbackRate);
    requestTraffic(desiredTarget);
   }
   else {t=Math.min(traffic.frontier,t+dt*playbackRate);if((traffic.halt||liveError)&&t>=traffic.frontier)playing=false;else if(t>=liveEdge()){traffic.release();desiredTarget=t+playbackLead();liveMode=true;}if(now-lastPanel>100||playbackLead()&&(t>run!.window.end||t>run!.traffic!.frontier))refreshTraffic();}
  }
  if (ready && playing && !traffic) {
    t = Math.min(end(), t + dt * playbackRate);
    if (t >= end()) { if ($<HTMLInputElement>('replay').checked) t = start(); else playing = false; }
  }
  if(ready && trafficDirty && now-lastPanel>100)refreshTraffic();
  draw();
  if (ready && now - lastPanel > 100) { updatePanels(); lastPanel = now; }
  requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(document.hidden && traffic){playing=false;liveMode=false;updatePanels();}});
// Read-only, lightweight presentation probe; no influence on physical scheduling.
Object.defineProperty(window,'orbitalPlayback',{get:()=>({epoch:t,frontier:traffic?.frontier,playing,ready,liveMode,planning:traffic?.stats.planningPending??0})});
loadSet(sets[0].id); requestAnimationFrame(animate);
