import { Runner, type LedgerEntry, type Sample, type EventBoundary } from '../sim/runner';
import {resourcesAt,type ResourceAnchor,type Depot} from '../traffic/resources';
import {portState} from '../sim/logistics';
import { validateBundle, type Bundle, type Port, type Scenario, type State, type ThrustArc } from '../sim/schema';

export interface Station { id: string; role: string; berths: number }
export interface Vessel { name: string; color: string; cargo: string; bundle: Bundle }
export interface ModelSet {
  schemaVersion: 1; id: string; name: string; extent: number;
  description: string; provenance: string; stations: Station[]; vessels: Vessel[];
  rotating: { name: string; rate: number; phase: number };
}
export type PortSamples=Record<string,{t:number;y:State}[]>;
export interface Activity {kind:'service'|'waiting'|'flying'|'fault'|'unavailable';reason?:string;nextDeparture?:number;retryAt?:number;knownEpoch?:number}
export interface ViewSample extends Sample {activity?:Activity}
export interface VesselView {
 id:string;name:string;color:string;cargo:string;ship:Scenario['ship'];ports:Port[];cargoCapacity:number;
 arcs:ThrustArc[];continuousFuel:boolean;portSamples:PortSamples;samples:ViewSample[];
 ledger:ViewerEvent[];boundaries:EventBoundary[];
}
export interface VesselRun extends Vessel,VesselView {}
export interface SceneView {
 schemaVersion:1;id:string;name:string;extent:number;description:string;provenance:string;
 stations:Station[];rotating:ModelSet['rotating'];vessels:VesselView[];portSamples:PortSamples;
 world:{bodies:Scenario['bodies'];ports:Port[];units:Scenario['units']};window:{start:number;end:number};
 traffic?:{frontier:number;oldest:number;resources:ResourceAnchor[];depots:Depot[];stats:Record<string,number>;halt?:string};
}
export interface SetRun extends SceneView {vessels:VesselRun[]}
export interface Stock { id: string; cargo: number; propellant: number; occupied: number }
export type ViewerEvent=Omit<LedgerEntry,'kind'> & {kind:LedgerEntry['kind']|'planning-failed'|'unavailable'|'fault'};
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
  return set;
}

export function setEvents(run: SceneView): SetEvent[] {
  return run.vessels.flatMap(v => v.ledger.map(e => ({...e, vessel: v.id, color: v.color})))
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
    const epochs = [...new Set([...flightTimes,...launchTimes,...Array.from({length: 2049}, (_, i) => s.epoch + s.duration * i / 2048), ...ledger.map(e => e.t)])].sort((a, b) => a - b);
    if(epochs.length>32768)throw new Error('Surface display sample budget exceeded');
    return {...v,id:s.ship.id,ship:s.ship,ports:s.logistics?.ports??[],cargoCapacity:s.logistics?.cargoCapacity??s.ship.cargoMass,arcs:v.bundle.program.thrustArcs??[],continuousFuel:v.bundle.program.thrustArcs!==undefined, portSamples:{} as PortSamples, samples: epochs.map(t => runner.sample(t)), ledger, boundaries:runner.eventBoundaries};
  });
  const epochs=[...new Set(vessels.flatMap(v=>v.samples.map(s=>s.t)))].sort((a,b)=>a-b);
  const portSamples:PortSamples=Object.fromEntries((set.vessels[0].bundle.scenario.logistics?.ports??[])
    .filter(p=>p.rail.kind==='ballistic').map(p=>[p.id,epochs.map(t=>({t,y:runners[0].portState(p.id,t)}))]));
  vessels.forEach(v=>v.portSamples=portSamples);
  const scenario=set.vessels[0].bundle.scenario;
  const run: SetRun = {...set, vessels,portSamples,world:{bodies:scenario.bodies,ports:scenario.logistics?.ports??[],units:scenario.units},window:{start:scenario.epoch,end:scenario.epoch+scenario.duration}};
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
  return run;
}

export function sampleVessel(v: VesselView, t: number): ViewSample {
  const [a,b] = bracket(v, t),sample={...structuredClone(a),t,y:a.activity?.kind==='fault'?[...a.y] as State:stateAt(v,t)};
  if(a.fuelUsed!==undefined && a!==b && a.t!==t) {
    const endpoint=v.boundaries.find(e=>e.t===b.t)?.before??b,u=(t-a.t)/(b.t-a.t);
    sample.propellant=a.propellant+u*(endpoint.propellant-a.propellant);
    sample.fuelUsed=a.fuelUsed+u*(endpoint.fuelUsed!-a.fuelUsed);
    if(sample.logistics)sample.logistics.fuelUsed=a.logistics!.fuelUsed+u*(endpoint.logistics!.fuelUsed-a.logistics!.fuelUsed);
  }
  // Throttle/heading are piecewise constant; mass and therefore force/acceleration
  // vary smoothly. These are drawing values, never a target or propagation origin.
  if(sample.thrust) {
    const engine=v.ship.engine!,arc=v.arcs.find(a=>a.id===sample.thrust!.id)!;
    const mass=v.ship.dryMass+(sample.logistics?.cargoMass??v.ship.cargoMass)+sample.propellant;
    sample.thrust.force=Math.min(engine.maxThrust*arc.throttle,(engine.maxAcceleration??Infinity)*mass);
    sample.thrust.acceleration=sample.thrust.force/mass*Math.hypot(...arc.direction);
  }
  return sample;
}
function bracket(v: VesselView, t: number): [ViewSample, ViewSample] {
  const samples = v.samples;
  if (!Number.isFinite(t) || t < samples[0].t || t > samples.at(-1)!.t) throw new Error('Display epoch outside set');
  let lo = 0, hi = samples.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (samples[mid].t <= t) lo = mid; else hi = mid - 1;
  }
  const a = samples[lo], b = samples[Math.min(lo + 1, samples.length - 1)];
  return [a, b];
}
export function stateAt(v: VesselView, t: number): State {
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
  if(port.rail.kind!=='ballistic')return portState(port,t);
  const points=samples[port.id];
  if(!points || !Number.isFinite(t) || t<points[0].t || t>points.at(-1)!.t)throw new Error('Display target epoch outside validity');
  let lo=0,hi=points.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid].t<=t)lo=mid;else hi=mid-1;}
  const a=points[lo],b=points[Math.min(lo+1,points.length-1)];if(a.t===t || a===b)return [...a.y];
  const u=(t-a.t)/(b.t-a.t);return a.y.map((x,i)=>x+u*(b.y[i]-x)) as State;
}
