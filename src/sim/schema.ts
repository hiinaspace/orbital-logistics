// Versioned, structured-cloneable data. The simulation has no browser dependencies.
export const MODEL = 'rk4-canonical-v1' as const;
export type State = [number, number, number, number];
export type Rail =
  | { kind: 'fixed'; position: [number, number] }
  | { kind: 'circular'; center: [number, number]; radius: number; rate: number; phase: number };
export interface Body { id: string; mu: number; radius: number; rail: Rail }
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
  ship: { id: string; state: State; dryMass: number; cargoMass: number;
    propellant: number; tankCapacity: number; exhaustVelocity: number };
}
export interface Burn {
  id: string; t: number; referenceBodyId: string;
  basis: 'radial-transverse-ccw-v1'; radial: number; transverse: number;
  snap?: { bodyId: string; kind: 'periapsis' | 'apoapsis'; window: [number, number]; resolvedEpoch: number };
  assist?: { kind: 'match-orbit' | 'intercept'; targetId: string; targetEpoch: number };
}
export interface Program { schemaVersion: 1; id: string; burns: Burn[] }
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
      if (!scenario.rendezvous || assist.targetId !== scenario.rendezvous.target.id ||
          (assist.kind !== 'match-orbit' && assist.kind !== 'intercept') || targetEpoch > epoch + duration ||
          (assist.kind === 'intercept' && targetEpoch !== t)) throw new Error('Invalid correction provenance');
      burn.assist = { kind: assist.kind, targetId: assist.targetId as string, targetEpoch };
    }
    return burn;
  });
  if (new Set(burns.map(b => b.id)).size !== burns.length) throw new Error('Duplicate burn ID');
  return { scenario, program: { schemaVersion: 1, id: name(p.id), burns } };
}

export function parseBundle(json: string): Bundle {
  if (json.length > 256_000) throw new Error('Scenario/program exceeds import limit');
  return validateBundle(JSON.parse(json));
}
