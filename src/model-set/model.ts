import {entryForces,recoveredState,type EntryPhysics,type RecoveryPose} from '../sim/entry';
import {norm,scale,type Vec3 as Vector3} from '../sim/vectors';
import {aerodynamicForces,type Atmosphere,type AeroTelemetry,type AeroConfiguration} from '../sim/atmosphere';
import {directionAt} from '../sim/steering';
import { Runner, type LedgerEntry, type Sample, type EventBoundary } from '../sim/runner';
import {resourcesAt,type ResourceAnchor,type Depot} from '../traffic/resources';
import {portState} from '../sim/logistics';
import { validateBundle, type Bundle, type Port, type Scenario, type Rail, type State, type Vec3, type ThrustArc } from '../sim/schema';

export interface Station { id: string; role: string; berths: number; maintenance?:{reference:Extract<Rail,{kind:'circular'}>;checks:{t:number;outcome:string;before:number[];after?:number[];evaluations:number}[]} }
export interface Vessel { name: string; color: string; cargo: string; bundle: Bundle }
export interface ModelSet {
  schemaVersion: 1; id: string; name: string; extent: number;
  description: string; provenance: string; stations: Station[]; vessels: Vessel[];
  rotating: { name: string; rate: number; phase: number };
}
export type PortSamples=Record<string,{t:number;y:State}[]>;
export interface Activity {kind:'service'|'waiting'|'flying'|'fault'|'unavailable';reason?:string;nextDeparture?:number;retryAt?:number;knownEpoch?:number}
export interface ViewSample extends Sample {activity?:Activity;mass?:number;aero?:AeroTelemetry;axis?:Vector3;entryPhase?:'coast'|'entry'|'braking'|'recovered'}
export interface VesselView {
 entry?:{physics:EntryPhysics;recovery:RecoveryPose;activeFrom?:number;entryEpoch:number;brakingEpoch:number;heatScale:number};
 aerodynamics?:{scenario:Scenario;atmosphere:Atmosphere;aero:AeroConfiguration};
 glyph?:'rocket'|'stack';initialAxis?:Vec3;
 inheritedFuelUsed?:number;
 lifetime?:{start:number;end:number;retired?:boolean;parentId?:string};
 id:string;name:string;color:string;cargo:string;ship:Scenario['ship'];ports:Port[];cargoCapacity:number;
 arcs:ThrustArc[];continuousFuel:boolean;portSamples:PortSamples;samples:ViewSample[];
 ledger:ViewerEvent[];boundaries:EventBoundary[];
 // Disposable dense coverage can be queried without expanding the entire
 // rolling history into every render list. Never a physics restart provider.
 trajectories?:{start:number;end:number;through:number;samples:ViewSample[];boundaries:EventBoundary[];arcs?:ThrustArc[]}[];
}
export interface VesselRun extends Vessel,VesselView {}
export interface MaintainedView extends VesselView {baseline:{t:number;y:State}[]}
export interface SceneView {
 atmosphere?:Atmosphere;entry?:{recoveryEpoch:number;relativeSpeed:number;waterEnergy:number;impulse:Vec3;work:{trials:number;evaluations:number;roots:number};maxima:{pressure:number;acceleration:number;heat:number;force:number}};
 recoveries?:Record<string,NonNullable<SceneView['entry']>>;
 staging?:{separation:{t:number;parentId:string;children:string[];state:State;beforeMass:number;afterMass:number;momentumBefore:number[];momentumAfter:number[];reservedPayloadFuel:number;boosterFuel:number};initialFuel:number};
 maintained?:Record<string,MaintainedView>;
 schemaVersion:1;id:string;name:string;extent:number;description:string;provenance:string;
 stations:Station[];rotating:ModelSet['rotating'];vessels:VesselView[];portSamples:PortSamples;
 world:{bodies:Scenario['bodies'];ports:Port[];units:Scenario['units']};window:{start:number;end:number};
 traffic?:{frontier:number;oldest:number;resources:ResourceAnchor[];depots:Depot[];stats:Record<string,number>;halt?:string};
}
export interface SetRun extends SceneView {vessels:VesselRun[]}
export interface Stock { id: string; cargo: number; propellant: number; occupied: number }
export type ViewerEvent=Omit<LedgerEntry,'kind'> & {kind:LedgerEntry['kind']|'planning-failed'|'unavailable'|'fault'|'separation'|'entry'|'splashdown'};
export interface SetEvent extends ViewerEvent { vessel: string; color: string }

// A curated set overlays independent test ships. Admission checks shared finite
// inventories and berths; no ship's program may depend on another's future arrival.
export function validateSet(value: ModelSet): ModelSet {
  if (value.schemaVersion !== 1 || !value.id || !value.name || !Number.isFinite(value.extent) || value.extent <= 0 ||
      !Number.isFinite(value.rotating.rate) || !Number.isFinite(value.rotating.phase) ||
      value.vessels.length < 1 || value.vessels.length > 8) throw new Error('Invalid model set');
  const set = structuredClone(value);
  set.vessels.forEach(v => {
    v.bundle = validateBundle(v.bundle);
    if (!v.name || !v.cargo || !/^#[0-9a-f]{6}$/i.test(v.color)) throw new Error('Invalid vessel presentation');
  });
  const world = (s: Scenario) => JSON.stringify([s.epoch, s.duration, s.units, s.bodies, s.logistics?.ports]);
  if (set.vessels.some(v => world(v.bundle.scenario) !== world(set.vessels[0].bundle.scenario))) throw new Error('Incompatible worlds');
  const ids = set.vessels.map(v => v.bundle.scenario.ship.id);
  const ports = set.vessels[0].bundle.scenario.logistics?.ports ?? [];
  const bodies = set.vessels[0].bundle.scenario.bodies;
  if (new Set(ids).size !== ids.length || ids.some(id => ports.some(p => p.id === id) || bodies.some(b => b.id === id)) ||
      new Set(set.stations.map(s => s.id)).size !== set.stations.length || set.stations.length !== ports.length ||
      set.stations.some(s => !ports.some(p => p.id === s.id) || !Number.isInteger(s.berths) || s.berths < 1)) throw new Error('Invalid set identities/berths');
  if(ports.some(p=>p.rail.kind==='powered')){
    if(ports.some(p=>p.rail.kind==='powered'&&!set.stations.find(s=>s.id===p.id)?.maintenance))throw new Error('Powered station requires maintenance reference');
    const s=set.vessels[0].bundle.scenario,targetWork=ports.reduce((n,p)=>n+('policy' in p.rail?s.duration/p.rail.policy.step:0),0),baselineWork=ports.reduce((n,p)=>n+(p.rail.kind==='powered'?s.duration/p.rail.policy.step:0),0);
    const work=set.vessels.reduce((n,v)=>n+v.bundle.scenario.duration/v.bundle.scenario.policy.step+targetWork+4096,baselineWork);
    if(set.vessels.length>2 || work>262144)throw new Error('Maintained scene preparation budget exceeded');
  }
  for(const station of set.stations)if(station.maintenance){
    const ref=station.maintenance.reference;
    validateBundle({scenario:{...set.vessels[0].bundle.scenario,logistics:undefined,bodies:[{id:'reference',mu:1,radius:.0001,rail:ref}]},program:{schemaVersion:3,id:'reference-validation',burns:[]}});
    if(!ports.some(p=>p.id===station.id&&p.rail.kind==='powered') || station.maintenance.checks.length>8 || station.maintenance.checks.some(c=>!Number.isFinite(c.t)||!['skip','correct'].includes(c.outcome)))throw new Error('Invalid maintenance presentation');
  }
  return set;
}

export function setEvents(run: SceneView): SetEvent[] {
  return [...run.vessels,...Object.values(run.maintained??{})].flatMap(v => v.ledger.map(e => ({...e,...(run.maintained?.[v.id]?{portId:v.id}:{}), vessel: v.id, color: v.color})))
    .sort((a, b) => a.t - b.t || eventOrder(a) - eventOrder(b) || a.vessel.localeCompare(b.vessel));
}
function eventOrder(e: ViewerEvent): number {
  // A berth can be handed over at the same epoch: departure precedes arrival.
  return (e.kind === 'undock' || e.kind==='launch') ? 0 : (e.kind === 'dock' || e.kind==='land') ? 1 : 2;
}
export function stockAt(run: SceneView, t: number): Stock[] {
  const ports=portsOf(run);
  if(run.traffic) {
    const anchor=[...run.traffic.resources].reverse().find(a=>a.t<=t);
    if(!anchor)throw new Error('No retained resource anchor');
    return resourcesAt(anchor,run.traffic.depots,t).stocks.map(p=>({...p,occupied:run.vessels.filter(v=>sampleVessel(v,t).logistics?.dockedPortId===p.id).length}));
  }
  const stocks = ports.map(p => ({id: p.id, cargo: p.cargo, propellant: p.propellant, occupied: 0}));
  for (const e of setEvents(run)) {
    if (e.t > t) break;
    const p = stocks.find(p => p.id === e.portId);
    if (!p) continue;
    if (e.kind === 'dock' || e.kind==='land') p.occupied++;
    if (e.kind === 'undock' || e.kind==='launch') p.occupied--;
    if (e.kind === 'transfer') {
      p.cargo -= e.cargoAfter! - e.cargoBefore!;
      p.propellant -= e.propellantAfter - e.propellantBefore;
    }
  }
  return stocks;
}

export function prepareSet(value: ModelSet): SetRun {
  const set = validateSet(value);
  const runners:Runner[]=[];
  const vessels = set.vessels.map(v => {
    const runner = new Runner(v.bundle), s = v.bundle.scenario, end = s.epoch + s.duration;
    const terminal = runner.advanceTo(end);
    if (terminal.status !== 'horizon') throw new Error(`${v.name}: ${terminal.status} ${terminal.detail}`);
    runners.push(runner);
    const ledger = runner.ledger;
    // Dense disposable drawing samples plus exact events. The canonical Runner
    // owns physics; interpolation below is only for display, never a restart state.
    // Surface scenes need sub-pixel drawing accuracy even at close zoom. These
    // extra drawing queries cannot create canonical checkpoints.
    const launchTimes=(v.bundle.program.operations??[]).filter(o=>o.kind==='launch').flatMap(o=>
      Array.from({length:4097},(_,i)=>o.t+Math.min(2,end-o.t)*i/4096));
    // Sample every free-flight interval densely, not just a fixed landing window.
    // This also covers the return's initial coast at extreme ship-follow zoom.
    const flightTimes=(v.bundle.program.operations??[]).some(o=>o.kind==='land') ? ledger
      .filter(e=>e.kind==='dock'||e.kind==='land').flatMap(e=>{
        const departure=[...ledger].reverse().find(d=>d.t<e.t&&(d.kind==='launch'||d.kind==='undock'));
        if(!departure)return [];
        const count=Math.ceil((e.t-departure.t)*2048);
        if(count>16384)throw new Error('Surface display flight exceeds sample budget');
        return Array.from({length:count+1},(_,i)=>departure.t+(e.t-departure.t)*i/count);
      }) : [];
    const epochs = [...new Set([...flightTimes,...launchTimes,...Array.from({length: 2049}, (_, i) => s.epoch + s.duration * i / 2048), ...ledger.map(e => e.t),...(v.bundle.program.thrustArcs??[]).flatMap(a=>a.steering?.keys.map(k=>a.start+k.offset)??[])])].sort((a, b) => a - b);
    if(epochs.length>32768)throw new Error('Surface display sample budget exceeded');
    return {...v,id:s.ship.id,ship:s.ship,ports:s.logistics?.ports??[],cargoCapacity:s.logistics?.cargoCapacity??s.ship.cargoMass,arcs:v.bundle.program.thrustArcs??[],continuousFuel:v.bundle.program.thrustArcs!==undefined, portSamples:{} as PortSamples, samples: epochs.map(t => runner.sample(t)), ledger, boundaries:runner.eventBoundaries};
  });
  const epochs=[...new Set(vessels.flatMap(v=>v.samples.map(s=>s.t)))].sort((a,b)=>a-b);
  const portSamples:PortSamples=Object.fromEntries((set.vessels[0].bundle.scenario.logistics?.ports??[])
    .filter(p=>p.rail.kind==='ballistic'||p.rail.kind==='powered').map(p=>[p.id,epochs.map(t=>({t,y:runners[0].portState(p.id,t)}))]));
  const maintained:Record<string,MaintainedView>={};
  for(const port of set.vessels[0].bundle.scenario.logistics?.ports??[])if(port.rail.kind==='powered') {
    const rail=port.rail,ledger=runners[0].portLedger(port.id),boundaries=runners[0].portBoundaries(port.id);
    const times=[...new Set([...epochs,...Array.from({length:4097},(_,i)=>rail.epoch+(rail.validUntil-rail.epoch)*i/4096),...ledger.map(e=>e.t),...rail.program.thrustArcs!.flatMap(a=>a.steering?.keys.map(k=>a.start+k.offset)??[])])].sort((a,b)=>a-b);
    const samples=times.map(t=>runners[0].portSample(port.id,t));
    portSamples[port.id]=samples.map(s=>({t:s.t,y:s.y}));
    const scenario={...set.vessels[0].bundle.scenario,logistics:undefined,ship:{...rail.propulsion,id:port.id,state:rail.state,cargoMass:0},policy:rail.policy};
    const baseline=new Runner({scenario,program:{schemaVersion:3,id:'unmaintained-comparison',burns:[]}});
    if(baseline.advanceTo(rail.validUntil).status!=='horizon')throw new Error('Unsafe unmaintained comparison');
    maintained[port.id]={id:port.id,name:port.id,color:'#85c9c0',cargo:'Ballast',ship:scenario.ship,ports:[],cargoCapacity:0,arcs:rail.program.thrustArcs!,continuousFuel:true,portSamples:{},samples,ledger,boundaries,baseline:times.map(t=>({t,y:baseline.sample(t).y}))};
  }
  vessels.forEach(v=>v.portSamples=portSamples);
  const scenario=set.vessels[0].bundle.scenario;
  const run: SetRun = {...set, vessels,portSamples,...(Object.keys(maintained).length?{maintained}:{}),world:{bodies:scenario.bodies,ports:scenario.logistics?.ports??[],units:scenario.units},window:{start:scenario.epoch,end:scenario.epoch+scenario.duration}};
  const ports = vessels[0].bundle.scenario.logistics?.ports ?? [];
  // Check every discrete change, including simultaneous transfers as one epoch.
  // Each independent run has already proved its own tanks, cargo, and captures.
  for (const t of new Set(setEvents(run).map(e => e.t))) {
    for (const stock of stockAt(run, t)) {
      const port = ports.find(p => p.id === stock.id)!;
      const berth = set.stations.find(s => s.id === stock.id)!;
      if (stock.cargo < -1e-10 || stock.propellant < -1e-10 || stock.cargo > port.cargoCapacity + 1e-10 ||
          stock.propellant > port.tankCapacity + 1e-10 || stock.occupied < 0 || stock.occupied > berth.berths) throw new Error(`Shared stock or berths exceeded at ${stock.id}, t=${t}`);
    }
  }
  if(run.maintained && new TextEncoder().encode(JSON.stringify(run)).byteLength>8_000_000)throw new Error('Maintained scene display packet budget exceeded');
  return run;
}

// Presence is distinct from retained endpoint data used by histories and events.
export function isPresent(v:VesselView,t:number):boolean {
 const l=v.lifetime;return !l||t>=l.start&&(l.retired?t<l.end:t<=l.end);
}
export function presenceLabel(v:VesselView,t:number):string {
 return t<(v.lifetime?.start??-Infinity)?'Attached to launch stack':'Separated';
}
export function sampleVessel(v: VesselView, t: number): ViewSample {
  const dense=v.trajectories?.find(p=>t>=p.start && t<p.end && t<=p.through);
  if(dense)return sampleVessel({...v,trajectories:undefined,samples:dense.samples,boundaries:dense.boundaries,arcs:dense.arcs??v.arcs},t);
  const [a,b] = bracket(v, t),sample={...structuredClone(a),t,y:a.activity?.kind==='fault'?[...a.y] as State:stateAt(v,t)};
  if(a.fuelUsed!==undefined && a!==b && a.t!==t) {
    const endpoint=v.boundaries.find(e=>e.t===b.t)?.before??b,u=(t-a.t)/(b.t-a.t);
    sample.propellant=a.propellant+u*(endpoint.propellant-a.propellant);
    if(a.mass!==undefined)sample.mass=a.mass+u*((endpoint as ViewSample).mass!-a.mass);
    sample.fuelUsed=a.fuelUsed+u*(endpoint.fuelUsed!-a.fuelUsed);
    if(sample.logistics)sample.logistics.fuelUsed=a.logistics!.fuelUsed+u*(endpoint.logistics!.fuelUsed-a.logistics!.fuelUsed);
  }
  // Throttle is fixed per arc; steering uses the same physical direction law.
  // Mass and therefore force/acceleration vary smoothly. These are drawing values, never a target or propagation origin.
  const entryActive=!!v.entry&&t>=(v.entry.activeFrom??v.samples[0].t);
  if(sample.thrust && !entryActive) {
    const engine=v.ship.engine!,arc=v.arcs.find(a=>a.id===sample.thrust!.id)!;
    const mass=sample.mass??v.ship.dryMass+(sample.logistics?.cargoMass??v.ship.cargoMass)+sample.propellant;
    sample.thrust.force=Math.min(engine.maxThrust*arc.throttle,(engine.maxAcceleration??Infinity)*mass);
    sample.thrust.direction=directionAt(arc,t-arc.start);
    sample.thrust.acceleration=sample.thrust.force/mass*Math.hypot(...sample.thrust.direction);
  }
  if(v.aerodynamics && !entryActive && !sample.logistics?.dockedPortId) {
    sample.aero=aerodynamicForces(v.aerodynamics.scenario.bodies[0],v.aerodynamics.atmosphere,v.aerodynamics.aero,t,sample.y);
    if(sample.thrust)sample.axis=[...sample.thrust.direction];
  }
  if(v.entry && entryActive) {
    if(t>=v.entry.recovery.t) {
      sample.y=recoveredState(v.entry.recovery,t);sample.entryPhase='recovered';delete sample.thrust;delete sample.aero;
      const r=sample.y.slice(0,3).map((x,i)=>x-v.entry!.recovery.center[i]) as Vector3;
      sample.axis=scale(r,1/norm(r));
    } else {
      const f=entryForces(v.entry.physics,t,[...sample.y,sample.propellant]);
      sample.aero=f.aero;sample.axis=f.axis;sample.mass=f.mass;
      sample.entryPhase=t>=v.entry.brakingEpoch?'braking':t>=v.entry.entryEpoch?'entry':'coast';
      if(norm(f.force)>0)sample.thrust={id:'terminal-braking',force:norm(f.force),acceleration:norm(f.force)/f.mass,direction:scale(f.force,1/norm(f.force))};else delete sample.thrust;
    }
  }
  return sample;
}
function bracket(v: VesselView, t: number): [ViewSample, ViewSample] {
  const samples = v.samples;
  if (!Number.isFinite(t) || t < samples[0].t || t > samples.at(-1)!.t) throw new Error(`Display epoch outside set: ${v.id}, t=${t}, range=[${samples[0].t}, ${samples.at(-1)!.t}]`);
  let lo = 0, hi = samples.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (samples[mid].t <= t) lo = mid; else hi = mid - 1;
  }
  const a = samples[lo], b = samples[Math.min(lo + 1, samples.length - 1)];
  return [a, b];
}
export function stateAt(v: VesselView, t: number): State {
  if(v.entry && t>=v.entry.recovery.t && t<=v.samples.at(-1)!.t)return recoveredState(v.entry.recovery,t);
  const dense=v.trajectories?.find(p=>t>=p.start && t<p.end && t<=p.through);
  if(dense)return stateAt({...v,trajectories:undefined,samples:dense.samples,boundaries:dense.boundaries},t);
  const [a, b] = bracket(v, t);
  if(a.activity?.kind==='fault' && t>(a.activity.knownEpoch??a.t))throw new Error('Reference vessel has no state at this epoch');
  if (a.t === t || a === b) return [...a.y];
  if (a.logistics?.dockedPortId) {
    const port = v.ports.find(p => p.id === a.logistics!.dockedPortId)!;
    return displayPortState(port,v.portSamples,t);
  }
  const u = (t - a.t) / (b.t - a.t);
  // Every instantaneous event supplies its physical left state. No inverse burn
  // or docking reconstruction is owned by the renderer.
  const endpoint = v.boundaries.find(e=>e.t===b.t)?.before.y ?? b.y;
  return a.y.map((x, i) => x + u * (endpoint[i] - x)) as State;
}

export function portsOf(run: SceneView): Port[] { return run.world.ports; }

// Finite, disposable station drawing data. Physical docking uses Runner.portState.
export function displayPortState(port:Port,samples:PortSamples,t:number):State {
  if(port.rail.kind!=='ballistic' && port.rail.kind!=='powered')return portState(port,t);
  const points=samples[port.id];
  if(!points || !Number.isFinite(t) || t<points[0].t || t>points.at(-1)!.t)throw new Error('Display target epoch outside validity');
  let lo=0,hi=points.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid].t<=t)lo=mid;else hi=mid-1;}
  const a=points[lo],b=points[Math.min(lo+1,points.length-1)];if(a.t===t || a===b)return [...a.y];
  const u=(t-a.t)/(b.t-a.t);return a.y.map((x,i)=>x+u*(b.y[i]-x)) as State;
}

export function orbitError(y:State,reference:Extract<Rail,{kind:'circular'}>):{position:number;velocity:number} {
 const r=y.slice(0,3).map((x,i)=>x-reference.center[i]),angle=Math.atan2(r.reduce((s,x,i)=>s+x*reference.v[i],0),r.reduce((s,x,i)=>s+x*reference.u[i],0)),c=Math.cos(angle),sn=Math.sin(angle);
 const p=reference.center.map((x,i)=>x+reference.radius*(reference.u[i]*c+reference.v[i]*sn)),v=reference.u.map((x,i)=>reference.radius*reference.rate*(-x*sn+reference.v[i]*c));
 return {position:Math.hypot(...p.map((x,i)=>x-y[i])),velocity:Math.hypot(...v.map((x,i)=>x-y[i+3]))};
}
