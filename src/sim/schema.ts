// Versioned, structured-cloneable data. The simulation has no browser dependencies.
export const MODEL = 'rk4-canonical-v1' as const;
export type State = [number, number, number, number];
export type Rail =
  | { kind: 'fixed'; position: [number, number] }
  | { kind: 'circular'; center: [number, number]; radius: number; rate: number; phase: number };
export interface Body { id: string; mu: number; radius: number; rail: Rail }
export interface Port {
  id: string; rail: Extract<Rail, {kind: 'circular'}>;
  cargo: number; cargoCapacity: number; propellant: number; tankCapacity: number;
  serviceDuration: number;
}
export interface Logistics {
  modelVersion: 'kinematic-ports-v1'; ports: Port[]; cargoCapacity: number;
  capture: {position: number; velocity: number};
  objective: {destinationId: string; quota: number; returnPortId: string; minPropellant: number; hardwareCost: number; deadline?: number};
}
export type Operation = {id: string; t: number; portId: string} & (
  {kind: 'dock'} | {kind: 'undock'} | {kind: 'transfer'; cargo: number; propellant: number});
export const operationOrder = (o: Operation) => ({undock: 0, dock: 1, transfer: 2})[o.kind];
export const compareOperations = (a: Operation, b: Operation) => a.t - b.t || operationOrder(a) - operationOrder(b);
export interface Rendezvous {
  target: { id: string; state: State };
  referenceBodyId: string; departureEpoch: number; arrivalEpoch: number;
  bounds: { radial: [number, number]; transverse: [number, number] };
  branch: { direction: 'ccw'; revolutions: 0; minClearance: number };
  tolerance: { position: number; velocity: number };
}
export interface Scenario {
  schemaVersion: 1; modelVersion: typeof MODEL; id: string;
  units: { length: string; time: string; mass: string };
  epoch: number; duration: number;
  policy: { step: number; maxNodes: number; maxSubdivision: number };
  bodies: Body[];
  rendezvous?: Rendezvous;
  logistics?: Logistics;
  ship: { id: string; state: State; dryMass: number; cargoMass: number;
    propellant: number; tankCapacity: number; exhaustVelocity: number };
}
export interface Burn {
  id: string; t: number; referenceBodyId: string;
  basis: 'radial-transverse-ccw-v1'; radial: number; transverse: number;
  snap?: { bodyId: string; kind: 'periapsis' | 'apoapsis'; window: [number, number]; resolvedEpoch: number };
  assist?: { kind: 'match-orbit' | 'intercept'; targetId: string; targetEpoch: number };
}
export interface Program { schemaVersion: 1; id: string; burns: Burn[]; operations?: Operation[] }
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

// Reconstruct rather than casting JSON; failed imports cannot mutate an existing run.
export function validateBundle(value: unknown): Bundle {
  const bundle = object(value), s = object(bundle.scenario), p = object(bundle.program);
  if (s.schemaVersion !== 1 || p.schemaVersion !== 1 || s.modelVersion !== MODEL) throw new Error('Unsupported schema/model version');
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
    if (r.kind === 'fixed') rail = { kind: 'fixed', position: vector(r.position, 2) as [number, number] };
    else if (r.kind === 'circular') rail = { kind: 'circular', center: vector(r.center, 2) as [number, number],
      radius: finite(r.radius, 'rail radius', 0), rate: finite(r.rate, 'rate'), phase: finite(r.phase, 'phase') };
    else throw new Error('Unsupported ephemeris');
    return { id: name(b.id), mu: finite(b.mu, 'mu', Number.MIN_VALUE),
      radius: finite(b.radius, 'surface radius', Number.MIN_VALUE), rail };
  });
  if (new Set(bodies.map(b => b.id)).size !== bodies.length) throw new Error('Duplicate body ID');
  const scenario: Scenario = { schemaVersion: 1, modelVersion: MODEL, id: name(s.id),
    units: { length: name(units.length), time: name(units.time), mass: name(units.mass) },
    epoch, duration, policy: { step, maxNodes, maxSubdivision }, bodies,
    ship: { id: name(ship.id), state: vector(ship.state, 4) as State,
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
    scenario.rendezvous = { target: { id: targetId, state: vector(target.state, 4) as State }, referenceBodyId, departureEpoch, arrivalEpoch,
      bounds: { radial, transverse }, branch: { direction: 'ccw', revolutions: 0, minClearance: finite(branch.minClearance, 'clearance', 0) },
      tolerance: { position: finite(tolerance.position, 'position tolerance', Number.MIN_VALUE), velocity: finite(tolerance.velocity, 'velocity tolerance', Number.MIN_VALUE) } };
  }
  if (s.logistics !== undefined) {
    const l = object(s.logistics), capture = object(l.capture), goal = object(l.objective);
    if (l.modelVersion !== 'kinematic-ports-v1' || scenario.rendezvous || bodies.length !== 1 || bodies[0].rail.kind !== 'fixed' ||
        !Array.isArray(l.ports) || l.ports.length !== 2) throw new Error('Unsupported logistics domain');
    const primary = bodies[0], center = (primary.rail as Extract<Rail, {kind: 'fixed'}>).position;
    const ports: Port[] = l.ports.map(value => {
      const port = object(value), r = object(port.rail), radius = finite(r.radius, 'port radius', primary.radius);
      const rail: Port['rail'] = {kind: 'circular', center: vector(r.center, 2) as [number, number], radius,
        rate: finite(r.rate, 'port rate'), phase: finite(r.phase, 'port phase')};
      const expectedRate = Math.sqrt(primary.mu / radius ** 3);
      if (r.kind !== 'circular' || radius <= primary.radius || rail.center.some((v, i) => v !== center[i]) ||
          !Number.isFinite(expectedRate) || expectedRate <= 0 || !Number.isFinite(radius * rail.rate) ||
          !rail.center.every(v => Number.isFinite(v + radius) && Number.isFinite(v - radius)) ||
          Math.abs(rail.rate / expectedRate - 1) > 1e-12) throw new Error('Unsupported port rail');
      const result: Port = {id: name(port.id), rail, cargo: finite(port.cargo, 'port cargo', 0), cargoCapacity: finite(port.cargoCapacity, 'port cargo capacity', 0),
        propellant: finite(port.propellant, 'port propellant', 0), tankCapacity: finite(port.tankCapacity, 'port tank capacity', 0),
        serviceDuration: finite(port.serviceDuration, 'service duration', Number.MIN_VALUE)};
      if (result.cargo > result.cargoCapacity || result.propellant > result.tankCapacity || result.serviceDuration > duration) throw new Error('Invalid port capacity/duration');
      return result;
    });
    const ids = [...bodies.map(b => b.id), scenario.ship.id, ...ports.map(p => p.id)];
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate port ID');
    const cargoCapacity = finite(l.cargoCapacity, 'cargo capacity', 0);
    const position = finite(capture.position, 'capture position', Number.MIN_VALUE), velocity = finite(capture.velocity, 'capture velocity', Number.MIN_VALUE);
    const destinationId = name(goal.destinationId), returnPortId = name(goal.returnPortId);
    const quota = finite(goal.quota, 'delivery quota', Number.MIN_VALUE), minPropellant = finite(goal.minPropellant, 'return propellant', 0);
    if (scenario.ship.cargoMass > cargoCapacity || position > 0.001 || velocity > 0.001 || destinationId === returnPortId ||
        ports.some(p => p.rail.radius - primary.radius <= position) ||
        !ports.some(p => p.id === destinationId) || !ports.some(p => p.id === returnPortId) || minPropellant > scenario.ship.tankCapacity) throw new Error('Invalid logistics objective/capture');
    scenario.logistics = {modelVersion: 'kinematic-ports-v1', ports, cargoCapacity, capture: {position, velocity},
      objective: {destinationId, quota, returnPortId, minPropellant, hardwareCost: finite(goal.hardwareCost, 'hardware cost', 0),
        ...(goal.deadline !== undefined ? {deadline: finite(goal.deadline, 'deadline', epoch)} : {})}};
    if ((scenario.logistics.objective.deadline ?? epoch) > epoch + duration) throw new Error('Deadline beyond horizon');
  }
  if (!Array.isArray(p.burns) || p.burns.length > 128) throw new Error('Invalid burns');
  let previous = -Infinity;
  const burns: Burn[] = p.burns.map(value => {
    const b = object(value), t = finite(b.t, 'burn epoch', epoch), referenceBodyId = name(b.referenceBodyId);
    if (t <= previous || t > epoch + duration || !bodies.some(body => body.id === referenceBodyId) || b.basis !== 'radial-transverse-ccw-v1') throw new Error('Invalid burn order, reference or basis');
    previous = t;
    const burn: Burn = { id: name(b.id), t, referenceBodyId, basis: 'radial-transverse-ccw-v1',
      radial: finite(b.radial, 'radial impulse'), transverse: finite(b.transverse, 'transverse impulse') };
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
  if (new Set(burns.map(b => b.id)).size !== burns.length) throw new Error('Duplicate burn ID');
  const program: Program = { schemaVersion: 1, id: name(p.id), burns };
  if (p.operations !== undefined) {
    if (!scenario.logistics || !Array.isArray(p.operations) || p.operations.length > 128) throw new Error('Invalid operations');
    const operations: Operation[] = p.operations.map(value => {
      const op = object(value), id = name(op.id), portId = name(op.portId), t = finite(op.t, 'operation epoch', epoch);
      const port = scenario.logistics!.ports.find(p => p.id === portId);
      if (!port || t > epoch + duration) throw new Error('Invalid operation port/epoch');
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
  return { scenario, program };
}

export function parseBundle(json: string): Bundle {
  if (json.length > 256_000) throw new Error('Scenario/program exceeds import limit');
  return validateBundle(JSON.parse(json));
}
