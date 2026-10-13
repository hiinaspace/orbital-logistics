// Versioned, structured-cloneable data. The simulation has no browser dependencies.
import {dot, norm, type State, type Vec3} from './vectors';
export type {State, Vec3} from './vectors';
export const MODEL = 'rk4-canonical-v3' as const;
export type Rail =
  | { kind: 'fixed'; position: Vec3 }
  | { kind: 'circular'; center: Vec3; u: Vec3; v: Vec3; radius: number; rate: number; phase: number };
export interface Body { id: string; mu: number; radius: number; rail: Rail }
export interface Engine { maxThrust: number; maxAcceleration?: number }
export interface Steering {kind:'spherical-smoothstep-v1';keys:{offset:number;direction:Vec3}[]}
export interface ThrustArc { id: string; start: number; end: number; direction: Vec3; throttle: number; steering?:Steering }
export interface BallisticRail {kind:'ballistic'; epoch:number; validUntil:number; state:State; policy:Scenario['policy']; minClearance:number; provenance:string}
// A powered target owns a frozen logistics-free propulsion program and tank.
export interface PoweredRail extends Omit<BallisticRail,'kind'> {kind:'powered';propulsion:{dryMass:number;propellant:number;tankCapacity:number;exhaustVelocity:number;engine:Engine};program:Program;minPropellant:number}
// Physical support geometry. Circular fields are derived by validation, never trusted.
export interface SurfaceRail {bodyRail?:Rail;latitude?:number;kind:'surface';bodyId:string;centerHeight:number;center:Vec3;u:Vec3;v:Vec3;radius:number;rate:number;phase:number}
export interface Port {
  id: string; rail: Extract<Rail, {kind: 'circular'}> | BallisticRail | PoweredRail | SurfaceRail;
  cargo: number; cargoCapacity: number; propellant: number; tankCapacity: number;
  serviceDuration: number;
}
export interface Logistics {
  modelVersion: 'kinematic-ports-v1' | 'ballistic-ports-v2' | 'surface-ports-v3' | 'powered-ports-v4' | 'surface-ports-v5' | 'moving-surface-ports-v6' | 'mission-surface-v7'; ports: Port[]; cargoCapacity: number;
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
export interface Program { schemaVersion: 3|4; id: string; burns: Burn[]; operations?: Operation[]; thrustArcs?: ThrustArc[] }
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
// stays durable. Scenario/snapshot v3 retain their contracts; steering programs
// use v4 so older readers reject them rather than silently dropping the heading law.
type LegacyStateWire = [number,number,number,number];
function upgradeWire(value: unknown): unknown {
  const input = object(value), rawScenario = object(input.scenario), rawProgram = object(input.program);
  const result = structuredClone(input), s = object(result.scenario), p = object(result.program);
  if ((rawScenario.schemaVersion!==3 || ![3,4].includes(rawProgram.schemaVersion as number)) &&
      (['surface-ports-v3','surface-ports-v5','moving-surface-ports-v6','mission-surface-v7'].includes(object(rawScenario.logistics??{}).modelVersion as string) ||
       (Array.isArray(object(rawScenario.logistics??{}).ports) && (object(rawScenario.logistics??{}).ports as unknown[]).some(p=>object(object(p).rail).kind==='surface')) ||
       (Array.isArray(rawProgram.operations) && rawProgram.operations.some(o=>object(o).kind==='launch'||object(o).kind==='land'))))throw new Error('Surface features require schema3');
  if ((rawScenario.schemaVersion !== 3 && (object(rawScenario.ship).engine !== undefined || rawScenario.engine !== undefined)) ||
      (![3,4].includes(rawProgram.schemaVersion as number) && rawProgram.thrustArcs !== undefined)) throw new Error('Propulsion fields require schema3 scenario and program3 or4');
  if(rawProgram.schemaVersion!==4 && Array.isArray(rawProgram.thrustArcs) && rawProgram.thrustArcs.some(a=>object(a).steering!==undefined))throw new Error('Steering fields require program schema4');
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
  if (s.schemaVersion !== 3 || ![3,4].includes(p.schemaVersion as number) || s.modelVersion !== MODEL) throw new Error('Unsupported schema/model version');
  if(s.atmosphere!==undefined || s.aero!==undefined || object(s.ship).aero!==undefined)throw new Error('Atmosphere requires entry-flight-v1');
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
    if ((l.modelVersion !== 'kinematic-ports-v1' && l.modelVersion !== 'ballistic-ports-v2' && l.modelVersion !== 'surface-ports-v3' && l.modelVersion !== 'powered-ports-v4' && l.modelVersion !== 'surface-ports-v5' && l.modelVersion !== 'moving-surface-ports-v6' && l.modelVersion !== 'mission-surface-v7') || scenario.rendezvous ||
        (!['ballistic-ports-v2','powered-ports-v4','moving-surface-ports-v6','mission-surface-v7'].includes(l.modelVersion as string) && (bodies.length !== 1 || bodies[0].rail.kind !== 'fixed')) ||
        !Array.isArray(l.ports) || l.ports.length < (l.modelVersion==='mission-surface-v7'?1:2) || l.ports.length > 8) throw new Error('Unsupported logistics domain');
    const primary = bodies[0];
    const center = primary.rail.kind==='fixed' ? primary.rail.position : undefined;
    const ports: Port[] = l.ports.map(value => {
      const port = object(value), r = object(port.rail);
      const moving=l.modelVersion==='moving-surface-ports-v6'||l.modelVersion==='mission-surface-v7';
      if(!moving && r.bodyRail!==undefined)throw new Error('Body-relative support requires moving-surface-ports-v6');
      let rail: Port['rail'];
      if((l.modelVersion!=='powered-ports-v4'||r.kind!=='powered') && ['propulsion','program','minPropellant','maintenance'].some(k=>r[k]!==undefined))throw new Error('Powered target fields require powered-ports-v4');
      if(['surface-ports-v3','surface-ports-v5','moving-surface-ports-v6','mission-surface-v7'].includes(l.modelVersion as string) && r.kind==='surface') {
        if(l.modelVersion==='surface-ports-v3' && r.latitude!==undefined)throw new Error('Latitude requires surface-ports-v5');
        const latitude=l.modelVersion!=='surface-ports-v3'?finite(r.latitude,'surface latitude'):undefined;
        if(latitude!==undefined && Math.abs(latitude)>Math.PI/2)throw new Error('Invalid surface latitude');
        const owner=moving?bodies.find(b=>b.id===r.bodyId):primary;
        if(!owner)throw new Error('Unknown surface body');
        const centerHeight=finite(r.centerHeight,'supported COM height',Number.MIN_VALUE),radius=owner.radius+centerHeight;
        const supportCenter=owner.rail.kind==='fixed'?owner.rail.position:owner.rail.center;
        const rate=finite(r.rate,'physical spin'),phase=finite(r.phase,'pad longitude');
        if(r.bodyId!==owner.id || (!moving&&!center) || radius<=owner.radius || !Number.isFinite(radius) ||
          Math.abs(rate)>=Math.sqrt(owner.mu/radius**3) || !supportCenter.every(x=>Number.isFinite(x+radius)&&Number.isFinite(x-radius)))throw new Error('Unsupported surface support');
        // A conservative global rail envelope proves support cannot enter any
        // other sphere while docked propagation bypasses free-flight collision.
        if(moving)for(const other of bodies.filter(b=>b.id!==owner.id)){
          const a=owner.rail,b=other.rail,ac=a.kind==='fixed'?a.position:a.center,bc=b.kind==='fixed'?b.position:b.center;
          let separation=Math.hypot(...ac.map((x,i)=>x-bc[i]))-(a.kind==='fixed'?0:a.radius*Math.hypot(norm(a.u),norm(a.v)))-(b.kind==='fixed'?0:b.radius*Math.hypot(norm(b.u),norm(b.v)));
          if(a.kind==='circular'&&b.kind==='circular'&&a.rate===b.rate&&a.u.every((x,i)=>x===b.u[i])&&a.v.every((x,i)=>x===b.v[i])){
            const cosine=a.radius*Math.cos(a.phase)-b.radius*Math.cos(b.phase),sine=a.radius*Math.sin(a.phase)-b.radius*Math.sin(b.phase);
            separation=Math.hypot(cosine,sine)*(1-1e-10)-Math.hypot(...ac.map((x,i)=>x-bc[i]));
          }
          if(!Number.isFinite(separation)||separation<=radius+other.radius)throw new Error('Surface support separation cannot be certified');
        }
        rail={kind:'surface',bodyId:owner.id,centerHeight,center:[...supportCenter],u:[1,0,0],v:[0,1,0],radius,rate,phase,...(latitude!==undefined?{latitude}:{}),...(moving?{bodyRail:structuredClone(owner.rail)}:{})};
      } else if(l.modelVersion==='ballistic-ports-v2'||l.modelVersion==='powered-ports-v4'||moving) {
        const p=object(r.policy), targetEpoch=finite(r.epoch,'target epoch'),validUntil=finite(r.validUntil,'target validity');
        if((r.kind!=='ballistic' && !(l.modelVersion==='powered-ports-v4' && r.kind==='powered')) || targetEpoch!==epoch || validUntil!==epoch+duration)throw new Error('Ballistic port must cover the complete scenario');
        const targetStep=finite(p.step,'target step',1/65536), targetNodes=integer(p.maxNodes,'target nodes',2,65536);
        if(duration/targetStep!==Math.floor(duration/targetStep) || duration/targetStep+2>targetNodes)throw new Error('Invalid target work budget');
        const minClearance=finite(r.minClearance,'target clearance',0);
        rail={kind:'ballistic',epoch:targetEpoch,validUntil,state:vector(r.state,6) as State,
          policy:{step:targetStep,maxNodes:targetNodes,maxSubdivision:integer(p.maxSubdivision,'target subdivisions',0,20)},
          minClearance,provenance:name(r.provenance)};
        if(!bodies.every(b=>Number.isFinite(b.radius+minClearance)))throw new Error('Invalid target clearance');
        if(r.kind==='powered') {
          const controls=object(r.program),propulsion=object(r.propulsion);
          if(!Array.isArray(controls.burns)||controls.burns.length || controls.operations!==undefined || !Array.isArray(controls.thrustArcs)||controls.thrustArcs.length>16)throw new Error('Powered targets require finite arcs without impulses/operations');
          const target=validateBundle({scenario:{...scenario,logistics:undefined,rendezvous:undefined,policy:rail.policy,ship:{...propulsion,id:name(port.id),state:rail.state,cargoMass:0}},program:controls});
          if(!target.scenario.ship.engine)throw new Error('Powered target engine required');
          const {dryMass,propellant,tankCapacity,exhaustVelocity,engine}=target.scenario.ship;
          rail={...rail,kind:'powered',propulsion:{dryMass,propellant,tankCapacity,exhaustVelocity,engine},program:target.program,minPropellant:finite(r.minPropellant,'target reserve',0)};
          if(rail.minPropellant>propellant || [port.cargo,port.cargoCapacity,port.propellant,port.tankCapacity].some(x=>x!==0))throw new Error('Powered target has fixed ballast and no exchange inventory');
        }

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
    if(l.modelVersion==='moving-surface-ports-v6' && (bodies.length!==2 || duration>2 || ports.length!==2 || ports.filter(p=>p.rail.kind==='surface').length!==1 || !ports.some(p=>p.rail.kind==='surface'&&p.rail.bodyRail?.kind==='circular') || ports.some(p=>!['surface','ballistic'].includes(p.rail.kind))))throw new Error('Moving surface domain requires two bodies, moving support and ballistic targets');
    if(l.modelVersion==='mission-surface-v7' && (bodies.length!==2||ports.length!==1||ports[0].rail.kind!=='surface'||ports[0].rail.bodyRail?.kind!=='circular'||bodies.some(b=>b.rail.kind!=='circular')||ports[0].cargo!==0||ports[0].propellant!==0||ports[0].cargoCapacity!==0||ports[0].tankCapacity!==0))throw Error('Mission surface requires one empty moving pad in a two-source field');
    const ids = [...bodies.map(b => b.id), scenario.ship.id, ...ports.map(p => p.id)];
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate port ID');
    const cargoCapacity = finite(l.cargoCapacity, 'cargo capacity', 0);
    const position = finite(capture.position, 'capture position', Number.MIN_VALUE), velocity = finite(capture.velocity, 'capture velocity', Number.MIN_VALUE);
    const destinationId = name(goal.destinationId), returnPortId = name(goal.returnPortId);
    const quota = finite(goal.quota, 'delivery quota', l.modelVersion==='mission-surface-v7'?0:Number.MIN_VALUE), minPropellant = finite(goal.minPropellant, 'return propellant', 0);
    if (scenario.ship.cargoMass > cargoCapacity || position > 0.001 || velocity > 0.001 || (l.modelVersion==='mission-surface-v7'?(quota!==0||destinationId!==returnPortId):destinationId===returnPortId) ||
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
  const program: Program = { schemaVersion: p.schemaVersion as 3|4, id: name(p.id), burns };
  if(p.thrustArcs!==undefined) {
    if(!scenario.ship.engine || !Array.isArray(p.thrustArcs) || p.thrustArcs.length>128)throw new Error('Invalid thrust program');
    let end=epoch;
    program.thrustArcs=p.thrustArcs.map(value=>{
      const a=object(value),start=finite(a.start,'thrust start',epoch),stop=finite(a.end,'thrust end',start),direction=vector(a.direction,3) as Vec3,throttle=finite(a.throttle,'throttle',0);
      if(start<end || stop<=start || stop>epoch+duration || throttle>1 || Math.abs(norm(direction)-1)>1e-12 ||
        burns.some(b=>b.t>=start && b.t<=stop && norm(b.basis==='inertial-cartesian-v2'?b.deltaVelocity:[b.radial,b.transverse,b.normal])>0))throw new Error('Overlapping/invalid thrust interval or impulse');
      if(throttle>0 && scenario.ship.engine!.maxThrust*throttle/scenario.ship.exhaustVelocity===0)throw new Error('Unsupported throttle scale');
      let steering:Steering|undefined;
      if(a.steering!==undefined) {
        const steer=object(a.steering);
        if(steer.kind!=='spherical-smoothstep-v1' || !Array.isArray(steer.keys) || steer.keys.length<2 || steer.keys.length>64)throw new Error('Invalid steering keys');
        let previous=-Infinity,previousEpoch=-Infinity;
        const keys=steer.keys.map(value=>{
          const k=object(value),offset=finite(k.offset,'steering offset',0),d=vector(k.direction,3) as Vec3;
          if(offset<=previous || start+offset<=previousEpoch || offset>stop-start || Math.abs(norm(d)-1)>1e-12)throw new Error('Invalid steering key');
          previous=offset;previousEpoch=start+offset;return {offset,direction:d};
        });
        if(keys[0].offset!==0 || keys.at(-1)!.offset!==stop-start || Math.hypot(...keys[0].direction.map((x,i)=>x-direction[i]))>1e-12)throw new Error('Steering must cover the arc and match its initial direction');
        for(let i=1;i<keys.length;i++)if(keys[i].direction.reduce((v,x,j)=>v+x*keys[i-1].direction[j],0)<-.5)throw new Error('Steering turns must be at most120 degrees; add an intermediate key');
        steering={kind:'spherical-smoothstep-v1',keys};
      }
      end=stop;return {id:name(a.id),start,end:stop,direction,throttle,...(steering?{steering}:{})};
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
        if(!['surface-ports-v3','surface-ports-v5','moving-surface-ports-v6','mission-surface-v7'].includes(scenario.logistics!.modelVersion) || port.rail.kind!=='surface' || t<=epoch || !arc || arc.start!==t ||
          burns.some(b=>b.t===t))throw new Error('Invalid launch/first thrust arc');
        return {id,t,portId,kind:'launch',thrustArcId};
      }
      if(op.kind==='land') {
        if(!['surface-ports-v3','surface-ports-v5','moving-surface-ports-v6','mission-surface-v7'].includes(scenario.logistics!.modelVersion) || port.rail.kind!=='surface' || t<=epoch)throw new Error('Invalid surface landing');
        return {id,t,portId,kind:'land'};
      }
      if (op.kind === 'dock' || op.kind === 'undock') return {id, t, portId, kind: op.kind};
      if (scenario.logistics!.modelVersion==='mission-surface-v7'||op.kind !== 'transfer' || t + port.serviceDuration === t || t + port.serviceDuration > epoch + duration) throw new Error('Invalid transfer/duration');
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
  const powered=scenario.logistics?.ports.filter(p=>p.rail.kind==='powered')??[];
  if(scenario.logistics?.modelVersion==='powered-ports-v4' && (powered.length!==1 || scenario.logistics.ports.length!==2 || scenario.logistics.ports.reduce((n,p)=>n+('policy' in p.rail?duration/p.rail.policy.step:0),0)>65536))throw new Error('Powered world requires one relay and one ballistic origin within preparation budget');
  if(powered.length>1 || powered.reduce((n,p)=>n+(p.rail.kind==='powered'?duration/p.rail.policy.step:0),0)>32768)throw new Error('Powered provider preparation budget exceeded');
  for(const port of powered) {
    if(port.rail.kind!=='powered')continue;
    const arcs=port.rail.program.thrustArcs!.filter(a=>a.throttle>0);
    let attached:number|undefined;
    const check=(a:number,b:number)=>{if(arcs.some(arc=>a<arc.end && b>arc.start))throw new Error('Attachment overlaps station maintenance');};
    for(const op of program.operations??[]) {
      if(op.portId!==port.id)continue;
      if(op.kind==='transfer')throw new Error('Powered station exchange is unsupported');
      if(op.kind==='dock'){if(arcs.some(a=>op.t>=a.start&&op.t<a.end))throw new Error('Capture during station maintenance');attached=op.t;}
      if(op.kind==='undock' && attached!==undefined){check(attached,op.t);attached=undefined;}
    }
    if(attached!==undefined)check(attached,epoch+duration);
  }
  return { scenario, program };
}

export function parseBundle(json: string): Bundle {
  if (json.length > 256_000) throw new Error('Scenario/program exceeds import limit');
  return validateBundle(JSON.parse(json));
}
