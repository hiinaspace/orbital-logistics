// Versioned, structured-cloneable data. The simulation has no browser dependencies.
import {dot, norm, type State, type Vec3} from './vectors';
export type {State, Vec3} from './vectors';
export const MODEL = 'rk4-canonical-v3' as const;
export type Rail =
  | { kind: 'fixed'; position: Vec3 }
  | { kind: 'circular'; center: Vec3; u: Vec3; v: Vec3; radius: number; rate: number; phase: number };
export interface Body { id: string; mu: number; radius: number; rail: Rail }
export interface Engine { maxThrust: number; maxAcceleration?: number }
export interface ThrustArc { id: string; start: number; end: number; direction: Vec3; throttle: number }
export interface BallisticRail {kind:'ballistic'; epoch:number; validUntil:number; state:State; policy:Scenario['policy']; minClearance:number; provenance:string}
// Physical support geometry. Circular fields are derived by validation, never trusted.
export interface SurfaceRail {kind:'surface';bodyId:string;centerHeight:number;center:Vec3;u:Vec3;v:Vec3;radius:number;rate:number;phase:number}
export interface Port {
  id: string; rail: Extract<Rail, {kind: 'circular'}> | BallisticRail | SurfaceRail;
  cargo: number; cargoCapacity: number; propellant: number; tankCapacity: number;
  serviceDuration: number;
}
export interface Logistics {
  modelVersion: 'kinematic-ports-v1' | 'ballistic-ports-v2' | 'surface-ports-v3'; ports: Port[]; cargoCapacity: number;
  capture: {position: number; velocity: number};
  objective: {destinationId: string; quota: number; returnPortId: string; minPropellant: number; hardwareCost: number; deadline?: number};
}
export type Operation = {id: string; t: number; portId: string} & (
  {kind: 'dock'} | {kind:'land'} | {kind: 'undock'} | {kind:'launch';thrustArcId:string} | {kind: 'transfer'; cargo: number; propellant: number});
export const operationOrder = (o: Operation) => ({undock: 0, launch:0, land:1, dock: 1, transfer: 2})[o.kind];
export const compareOperations = (a: Operation, b: Operation) => a.t - b.t || operationOrder(a) - operationOrder(b);
export interface Rendezvous {
  target: { id: string; state: State };
  referenceBodyId: string; departureEpoch: number; arrivalEpoch: number;
  bounds: { radial: [number, number]; transverse: [number, number] };
  branch: { direction: 'ccw'; revolutions: 0; minClearance: number };
  tolerance: { position: number; velocity: number };
}
export interface Scenario {
  schemaVersion: 3; modelVersion: typeof MODEL; id: string;
  units: { length: string; time: string; mass: string };
  epoch: number; duration: number;
  policy: { step: number; maxNodes: number; maxSubdivision: number };
  bodies: Body[];
  rendezvous?: Rendezvous;
  logistics?: Logistics;
  ship: { id: string; state: State; dryMass: number; cargoMass: number;
    propellant: number; tankCapacity: number; exhaustVelocity: number; engine?: Engine };
}
interface BurnBase {
  id: string; t: number; referenceBodyId: string;
  snap?: { bodyId: string; kind: 'periapsis' | 'apoapsis'; window: [number, number]; resolvedEpoch: number };
  assist?: { kind: 'match-orbit' | 'intercept'; targetId: string; targetEpoch: number };
}
export type ReferenceBurn = BurnBase & {basis: 'radial-transverse-normal-v2'; radial: number; transverse: number; normal: number; orientationAxis: Vec3};
export type Burn = ReferenceBurn | (BurnBase & {basis: 'inertial-cartesian-v2'; deltaVelocity: Vec3});
export interface Program { schemaVersion: 3; id: string; burns: Burn[]; operations?: Operation[]; thrustArcs?: ThrustArc[] }
export interface Bundle { scenario: Scenario; program: Program }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Record<string, unknown>;
}
function finite(value: unknown, name: string, min = -Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) throw new Error(`Invalid ${name}`);
  return value === 0 ? 0 : value; // JSON canonicalizes negative zero on reload.
}
function name(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) throw new Error('Invalid name');
  return value;
}
function vector(value: unknown, size: number): number[] {
  if (!Array.isArray(value) || value.length !== size) throw new Error('Invalid vector');
  return value.map(v => finite(v, 'vector component'));
}
function integer(value: unknown, label: string, min: number, max: number): number {
  const n = finite(value, label, min);
  if (!Number.isInteger(n) || n > max) throw new Error(`Invalid ${label}`);
  return n;
}

// This boundary converts propulsion-free v1 planar and v2 spatial data. Original JSON
// stays durable; canonical runtime objects and newly saved programs are v3.
type LegacyStateWire = [number,number,number,number];
function upgradeWire(value: unknown): unknown {
  const input = object(value), rawScenario = object(input.scenario), rawProgram = object(input.program);
  const result = structuredClone(input), s = object(result.scenario), p = object(result.program);
  if ((rawScenario.schemaVersion!==3 || rawProgram.schemaVersion!==3) &&
      (object(rawScenario.logistics??{}).modelVersion==='surface-ports-v3' ||
       (Array.isArray(object(rawScenario.logistics??{}).ports) && (object(rawScenario.logistics??{}).ports as unknown[]).some(p=>object(object(p).rail).kind==='surface')) ||
       (Array.isArray(rawProgram.operations) && rawProgram.operations.some(o=>object(o).kind==='launch'||object(o).kind==='land'))))throw new Error('Surface features require schema3');
  if ((rawScenario.schemaVersion !== 3 && (object(rawScenario.ship).engine !== undefined || rawScenario.engine !== undefined)) ||
      (rawProgram.schemaVersion !== 3 && rawProgram.thrustArcs !== undefined)) throw new Error('Propulsion fields require schema3');
  if (rawScenario.schemaVersion === 2) {
    if (rawScenario.modelVersion !== 'rk4-canonical-v2') throw new Error('Unsupported schema/model version');
    s.schemaVersion=3;s.modelVersion=MODEL;
  }
  if (rawProgram.schemaVersion === 2) p.schemaVersion=3;
  if (rawScenario.schemaVersion === 1) {
    if (rawScenario.modelVersion !== 'rk4-canonical-v1') throw new Error('Unsupported schema/model version');
    const lift = (v: unknown) => [...vector(v,2),0];
    const liftState = (v: unknown) => {const a=vector(v,4) as LegacyStateWire;return [a[0],a[1],0,a[2],a[3],0];};
    const rail = (value: unknown) => {const r=object(value);return r.kind==='fixed' ? {...r,position:lift(r.position)} :
      {...r,center:lift(r.center),u:[1,0,0],v:[0,1,0]};};
    if (!Array.isArray(s.bodies)) throw new Error('Invalid bodies');
    s.bodies=s.bodies.map(b=>({...object(b),rail:rail(object(b).rail)}));
    s.ship={...object(s.ship),state:liftState(object(s.ship).state)};
    if (s.rendezvous) {const r=object(s.rendezvous),t=object(r.target);s.rendezvous={...r,target:{...t,state:liftState(t.state)}};}
    if (s.logistics) {const l=object(s.logistics);if (!Array.isArray(l.ports)) throw new Error('Invalid ports');
      s.logistics={...l,ports:l.ports.map(p=>({...object(p),rail:rail(object(p).rail)}))};}
    s.schemaVersion=3;s.modelVersion=MODEL;
  }
  if (rawProgram.schemaVersion === 1) {
    if (!Array.isArray(p.burns)) throw new Error('Invalid burns');
    p.burns=p.burns.map(value=>{const b=object(value);if(b.basis!=='radial-transverse-ccw-v1')throw new Error('Unsupported legacy burn');
      return {...b,basis:'radial-transverse-normal-v2',orientationAxis:[0,0,1],normal:0};});p.schemaVersion=3;
  }
  return result;
}
export function validatePlane(u: Vec3, v: Vec3): void {
  if (Math.abs(norm(u)-1)>1e-12 || Math.abs(norm(v)-1)>1e-12 || Math.abs(dot(u,v))>1e-12) throw new Error('Invalid rail plane');
}
function circularRail(value: Record<string, unknown>, minRadius = 0): Extract<Rail,{kind:'circular'}> {
  const u=vector(value.u,3) as Vec3,v=vector(value.v,3) as Vec3;validatePlane(u,v);
  return {kind:'circular',center:vector(value.center,3) as Vec3,u,v,radius:finite(value.radius,'rail radius',minRadius),
    rate:finite(value.rate,'rate'),phase:finite(value.phase,'phase')};
}
// Reconstruct rather than casting JSON; failed imports cannot mutate an existing run.
export function validateBundle(value: unknown): Bundle {
  const bundle = object(upgradeWire(value)), s = object(bundle.scenario), p = object(bundle.program);
  if (s.schemaVersion !== 3 || p.schemaVersion !== 3 || s.modelVersion !== MODEL) throw new Error('Unsupported schema/model version');
  const units = object(s.units), policy = object(s.policy), ship = object(s.ship);
  const epoch = finite(s.epoch, 'epoch'), duration = finite(s.duration, 'duration', Number.MIN_VALUE);
  const step = finite(policy.step, 'step', 1 / 65536);
  const maxNodes = integer(policy.maxNodes, 'maxNodes', 2, 65536);
  const maxSubdivision = integer(policy.maxSubdivision, 'maxSubdivision', 0, 20);
  if (!Number.isFinite(epoch + duration) || epoch + step === epoch || duration > 64 ||
      duration / step !== Math.floor(duration / step) || duration / step + 2 > maxNodes) {
    throw new Error('Unsupported duration/grid or work budget');
  }
  if (!Array.isArray(s.bodies) || s.bodies.length === 0 || s.bodies.length > 8) throw new Error('Invalid bodies');
  const bodies: Body[] = s.bodies.map(value => {
    const b = object(value), r = object(b.rail);
    let rail: Rail;
    if (r.kind === 'fixed') rail = { kind: 'fixed', position: vector(r.position, 3) as Vec3 };
    else if (r.kind === 'circular') rail = circularRail(r);
    else throw new Error('Unsupported ephemeris');
    return { id: name(b.id), mu: finite(b.mu, 'mu', Number.MIN_VALUE),
      radius: finite(b.radius, 'surface radius', Number.MIN_VALUE), rail };
  });
  if (new Set(bodies.map(b => b.id)).size !== bodies.length) throw new Error('Duplicate body ID');
  const scenario: Scenario = { schemaVersion: 3, modelVersion: MODEL, id: name(s.id),
    units: { length: name(units.length), time: name(units.time), mass: name(units.mass) },
    epoch, duration, policy: { step, maxNodes, maxSubdivision }, bodies,
    ship: { id: name(ship.id), state: vector(ship.state, 6) as State,
      dryMass: finite(ship.dryMass, 'dry mass', Number.MIN_VALUE), cargoMass: finite(ship.cargoMass, 'cargo mass', 0),
      propellant: finite(ship.propellant, 'propellant', 0), tankCapacity: finite(ship.tankCapacity, 'tank capacity', 0),
      exhaustVelocity: finite(ship.exhaustVelocity, 'exhaust velocity', Number.MIN_VALUE) } };
  if (scenario.ship.propellant > scenario.ship.tankCapacity || bodies.some(b => b.id === scenario.ship.id)) throw new Error('Invalid ship capacity/ID');
  if (!Number.isFinite(scenario.ship.dryMass + scenario.ship.cargoMass + scenario.ship.propellant)) throw new Error('Invalid total mass');
  if (s.rendezvous !== undefined) {
    const r = object(s.rendezvous), target = object(r.target), bounds = object(r.bounds), branch = object(r.branch), tolerance = object(r.tolerance);
    const departureEpoch = finite(r.departureEpoch, 'departure', epoch), arrivalEpoch = finite(r.arrivalEpoch, 'arrival', departureEpoch);
    const radial = vector(bounds.radial, 2) as [number, number], transverse = vector(bounds.transverse, 2) as [number, number];
    const targetId = name(target.id), referenceBodyId = name(r.referenceBodyId);
    if (bodies.length !== 1 || bodies[0].rail.kind !== 'fixed' || referenceBodyId !== bodies[0].id ||
        branch.direction !== 'ccw' || branch.revolutions !== 0 || arrivalEpoch <= departureEpoch || arrivalEpoch >= epoch + duration ||
        radial[0] >= radial[1] || transverse[0] >= transverse[1] || targetId === scenario.ship.id || bodies.some(b => b.id === targetId)) throw new Error('Unsupported rendezvous domain');
    scenario.rendezvous = { target: { id: targetId, state: vector(target.state, 6) as State }, referenceBodyId, departureEpoch, arrivalEpoch,
      bounds: { radial, transverse }, branch: { direction: 'ccw', revolutions: 0, minClearance: finite(branch.minClearance, 'clearance', 0) },
      tolerance: { position: finite(tolerance.position, 'position tolerance', Number.MIN_VALUE), velocity: finite(tolerance.velocity, 'velocity tolerance', Number.MIN_VALUE) } };
  }
  if (s.logistics !== undefined) {
    const l = object(s.logistics), capture = object(l.capture), goal = object(l.objective);
    if ((l.modelVersion !== 'kinematic-ports-v1' && l.modelVersion !== 'ballistic-ports-v2' && l.modelVersion !== 'surface-ports-v3') || scenario.rendezvous ||
        (l.modelVersion !== 'ballistic-ports-v2' && (bodies.length !== 1 || bodies[0].rail.kind !== 'fixed')) ||
        !Array.isArray(l.ports) || l.ports.length < 2 || l.ports.length > 8) throw new Error('Unsupported logistics domain');
    const primary = bodies[0];
    const center = primary.rail.kind==='fixed' ? primary.rail.position : undefined;
    const ports: Port[] = l.ports.map(value => {
      const port = object(value), r = object(port.rail);
      let rail: Port['rail'];
      if(l.modelVersion==='surface-ports-v3' && r.kind==='surface') {
        const centerHeight=finite(r.centerHeight,'supported COM height',Number.MIN_VALUE),radius=primary.radius+centerHeight;
        const rate=finite(r.rate,'physical spin'),phase=finite(r.phase,'pad longitude');
        if(r.bodyId!==primary.id || !center || radius<=primary.radius || !Number.isFinite(radius) ||
          Math.abs(rate)>=Math.sqrt(primary.mu/radius**3) || !center.every(x=>Number.isFinite(x+radius)&&Number.isFinite(x-radius)))throw new Error('Unsupported surface support');
        rail={kind:'surface',bodyId:primary.id,centerHeight,center:[...center],u:[1,0,0],v:[0,1,0],radius,rate,phase};
      } else if(l.modelVersion==='ballistic-ports-v2') {
        const p=object(r.policy), targetEpoch=finite(r.epoch,'target epoch'),validUntil=finite(r.validUntil,'target validity');
        if(r.kind!=='ballistic' || targetEpoch!==epoch || validUntil!==epoch+duration)throw new Error('Ballistic port must cover the complete scenario');
        const targetStep=finite(p.step,'target step',1/65536), targetNodes=integer(p.maxNodes,'target nodes',2,65536);
        if(duration/targetStep!==Math.floor(duration/targetStep) || duration/targetStep+2>targetNodes)throw new Error('Invalid target work budget');
        const minClearance=finite(r.minClearance,'target clearance',0);
        rail={kind:'ballistic',epoch:targetEpoch,validUntil,state:vector(r.state,6) as State,
          policy:{step:targetStep,maxNodes:targetNodes,maxSubdivision:integer(p.maxSubdivision,'target subdivisions',0,20)},
          minClearance,provenance:name(r.provenance)};
        if(!bodies.every(b=>Number.isFinite(b.radius+minClearance)))throw new Error('Invalid target clearance');
      } else {
        const circular=circularRail(r,primary.radius), expectedRate=Math.sqrt(primary.mu/circular.radius**3);
        if(r.kind!=='circular' || circular.radius<=primary.radius || !center || circular.center.some((v,i)=>v!==center[i]) ||
          !Number.isFinite(expectedRate) || expectedRate<=0 || !Number.isFinite(circular.radius*circular.rate) ||
          !circular.center.every(v=>Number.isFinite(v+circular.radius)&&Number.isFinite(v-circular.radius)) ||
          Math.abs(circular.rate/expectedRate-1)>1e-12)throw new Error('Unsupported port rail');
        rail=circular;
      }
      const result: Port = {id: name(port.id), rail, cargo: finite(port.cargo, 'port cargo', 0), cargoCapacity: finite(port.cargoCapacity, 'port cargo capacity', 0),
        propellant: finite(port.propellant, 'port propellant', 0), tankCapacity: finite(port.tankCapacity, 'port tank capacity', 0),
        serviceDuration: finite(port.serviceDuration, 'service duration', Number.MIN_VALUE)};
      if (result.cargo > result.cargoCapacity || result.propellant > result.tankCapacity || result.serviceDuration > duration) throw new Error('Invalid port capacity/duration');
      return result;
    });
    const pads=ports.filter(p=>p.rail.kind==='surface');
    if(new Set(pads.map(p=>p.rail.kind==='surface'?p.rail.rate:0)).size>1)throw new Error('Inconsistent body spin');
    const ids = [...bodies.map(b => b.id), scenario.ship.id, ...ports.map(p => p.id)];
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate port ID');
    const cargoCapacity = finite(l.cargoCapacity, 'cargo capacity', 0);
    const position = finite(capture.position, 'capture position', Number.MIN_VALUE), velocity = finite(capture.velocity, 'capture velocity', Number.MIN_VALUE);
    const destinationId = name(goal.destinationId), returnPortId = name(goal.returnPortId);
    const quota = finite(goal.quota, 'delivery quota', Number.MIN_VALUE), minPropellant = finite(goal.minPropellant, 'return propellant', 0);
    if (scenario.ship.cargoMass > cargoCapacity || position > 0.001 || velocity > 0.001 || destinationId === returnPortId ||
        ports.some(p => p.rail.kind==='circular' && p.rail.radius - primary.radius <= position) ||
        !ports.some(p => p.id === destinationId) || !ports.some(p => p.id === returnPortId) || minPropellant > scenario.ship.tankCapacity) throw new Error('Invalid logistics objective/capture');
    scenario.logistics = {modelVersion: l.modelVersion, ports, cargoCapacity, capture: {position, velocity},
      objective: {destinationId, quota, returnPortId, minPropellant, hardwareCost: finite(goal.hardwareCost, 'hardware cost', 0),
        ...(goal.deadline !== undefined ? {deadline: finite(goal.deadline, 'deadline', epoch)} : {})}};
    if ((scenario.logistics.objective.deadline ?? epoch) > epoch + duration) throw new Error('Deadline beyond horizon');
  }
  if (!Array.isArray(p.burns) || p.burns.length > 128) throw new Error('Invalid burns');
  let previous = -Infinity;
  const burns: Burn[] = p.burns.map(value => {
    const b = object(value), t = finite(b.t, 'burn epoch', epoch), referenceBodyId = name(b.referenceBodyId);
    if (t <= previous || t > epoch + duration || !bodies.some(body => body.id === referenceBodyId)) throw new Error('Invalid burn order, reference or basis');
    previous = t;
    const common = {id:name(b.id),t,referenceBodyId};
    let burn: Burn;
    if (b.basis==='inertial-cartesian-v2') burn={...common,basis:b.basis,deltaVelocity:vector(b.deltaVelocity,3) as Vec3};
    else if (b.basis==='radial-transverse-normal-v2') {
      const orientationAxis=vector(b.orientationAxis,3) as Vec3;
      if(Math.abs(norm(orientationAxis)-1)>1e-12)throw new Error('Invalid burn orientation axis');
      burn={...common,basis:b.basis,orientationAxis,radial:finite(b.radial,'radial impulse'),transverse:finite(b.transverse,'transverse impulse'),normal:finite(b.normal,'normal impulse')};
    } else throw new Error('Unsupported burn basis');
    if (b.snap !== undefined) {
      const snap = object(b.snap), window = vector(snap.window, 2) as [number, number];
      if ((snap.kind !== 'periapsis' && snap.kind !== 'apoapsis') || snap.bodyId !== referenceBodyId ||
          window[0] < epoch || window[1] > epoch + duration || window[0] >= window[1] ||
          t < window[0] || t > window[1] || snap.resolvedEpoch !== t) throw new Error('Invalid apsis provenance');
      burn.snap = { bodyId: referenceBodyId, kind: snap.kind, window, resolvedEpoch: t };
    }
    if (b.assist !== undefined) {
      const assist = object(b.assist), targetEpoch = finite(assist.targetEpoch, 'target epoch', epoch);
      if (!((scenario.rendezvous && assist.targetId === scenario.rendezvous.target.id) || scenario.logistics?.ports.some(p => p.id === assist.targetId)) ||
          (assist.kind !== 'match-orbit' && assist.kind !== 'intercept') || targetEpoch > epoch + duration ||
          (assist.kind === 'intercept' && targetEpoch !== t)) throw new Error('Invalid correction provenance');
      burn.assist = { kind: assist.kind, targetId: assist.targetId as string, targetEpoch };
    }
    return burn;
  });
  if (ship.engine !== undefined) {
    const e=object(ship.engine);
    scenario.ship.engine={maxThrust:finite(e.maxThrust,'maximum thrust',Number.MIN_VALUE),
      ...(e.maxAcceleration!==undefined?{maxAcceleration:finite(e.maxAcceleration,'maximum acceleration',Number.MIN_VALUE)}:{})};
    if(!Number.isFinite(scenario.ship.engine.maxThrust/scenario.ship.exhaustVelocity) ||
       scenario.ship.engine.maxThrust/scenario.ship.exhaustVelocity===0 ||
       !Number.isFinite(scenario.ship.engine.maxThrust/scenario.ship.dryMass))throw new Error('Unsupported engine scale');
  }
  if (new Set(burns.map(b => b.id)).size !== burns.length) throw new Error('Duplicate burn ID');
  const program: Program = { schemaVersion: 3, id: name(p.id), burns };
  if(p.thrustArcs!==undefined) {
    if(!scenario.ship.engine || !Array.isArray(p.thrustArcs) || p.thrustArcs.length>128)throw new Error('Invalid thrust program');
    let end=epoch;
    program.thrustArcs=p.thrustArcs.map(value=>{
      const a=object(value),start=finite(a.start,'thrust start',epoch),stop=finite(a.end,'thrust end',start),direction=vector(a.direction,3) as Vec3,throttle=finite(a.throttle,'throttle',0);
      if(start<end || stop<=start || stop>epoch+duration || throttle>1 || Math.abs(norm(direction)-1)>1e-12 ||
        burns.some(b=>b.t>=start && b.t<=stop && norm(b.basis==='inertial-cartesian-v2'?b.deltaVelocity:[b.radial,b.transverse,b.normal])>0))throw new Error('Overlapping/invalid thrust interval or impulse');
      if(throttle>0 && scenario.ship.engine!.maxThrust*throttle/scenario.ship.exhaustVelocity===0)throw new Error('Unsupported throttle scale');
      end=stop;return {id:name(a.id),start,end:stop,direction,throttle};
    });
  }
  if (p.operations !== undefined) {
    if (!scenario.logistics || !Array.isArray(p.operations) || p.operations.length > 128) throw new Error('Invalid operations');
    const operations: Operation[] = p.operations.map(value => {
      const op = object(value), id = name(op.id), portId = name(op.portId), t = finite(op.t, 'operation epoch', epoch);
      const port = scenario.logistics!.ports.find(p => p.id === portId);
      if (!port || t > epoch + duration) throw new Error('Invalid operation port/epoch');
      if(op.kind==='launch') {
        const thrustArcId=name(op.thrustArcId),arc=program.thrustArcs?.find(a=>a.id===thrustArcId);
        if(scenario.logistics!.modelVersion!=='surface-ports-v3' || port.rail.kind!=='surface' || t<=epoch || !arc || arc.start!==t ||
          burns.some(b=>b.t===t))throw new Error('Invalid launch/first thrust arc');
        return {id,t,portId,kind:'launch',thrustArcId};
      }
      if(op.kind==='land') {
        if(scenario.logistics!.modelVersion!=='surface-ports-v3' || port.rail.kind!=='surface' || t<=epoch)throw new Error('Invalid surface landing');
        return {id,t,portId,kind:'land'};
      }
      if (op.kind === 'dock' || op.kind === 'undock') return {id, t, portId, kind: op.kind};
      if (op.kind !== 'transfer' || t + port.serviceDuration === t || t + port.serviceDuration > epoch + duration) throw new Error('Invalid transfer/duration');
      const cargo = finite(op.cargo, 'transfer cargo'), propellant = finite(op.propellant, 'transfer propellant', 0);
      if (!Number.isFinite(cargo + propellant) || (cargo === 0 && propellant === 0)) throw new Error('Empty transfer');
      return {id, t, portId, kind: 'transfer', cargo, propellant};
    });
    if (new Set([...burns.map(b => b.id), ...operations.map(o => o.id)]).size !== burns.length + operations.length ||
        operations.some((o, i) => i > 0 && compareOperations(operations[i - 1], o) >= 0)) throw new Error('Invalid operation order/ID');
    program.operations = operations;
  }
  for(const launch of program.operations?.filter(o=>o.kind==='launch')??[]) {
    if(program.operations!.some(o=>o!==launch && o.t===launch.t))throw new Error('Conflicting launch operations');
  }
  for(const land of program.operations?.filter(o=>o.kind==='land')??[]) {
    const others=program.operations!.filter(o=>o!==land && o.t===land.t);
    if(burns.some(b=>b.t===land.t) || program.thrustArcs?.some(a=>a.start===land.t) ||
      others.length>1 || others.some(o=>o.kind!=='transfer' || o.portId!==land.portId))throw new Error('Conflicting landing events');
  }
  const ids=[...burns.map(b=>b.id),...(program.operations??[]).map(o=>o.id),...(program.thrustArcs??[]).map(a=>a.id)];
  if(new Set(ids).size!==ids.length)throw new Error('Duplicate program ID');
  if((program.operations??[]).some(o=>(program.thrustArcs??[]).some(a=>o.t>a.start && o.t<a.end)))throw new Error('Operation inside powered arc');
  return { scenario, program };
}

export function parseBundle(json: string): Bundle {
  if (json.length > 256_000) throw new Error('Scenario/program exceeds import limit');
  return validateBundle(JSON.parse(json));
}
