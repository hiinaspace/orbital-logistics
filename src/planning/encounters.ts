import { bodyState, rk4 } from '../sim/dynamics';
import { Runner, type CoastSegment } from '../sim/runner';
import { validateBundle, type Bundle, type Burn, type Program, type State } from '../sim/schema';
import { inspectEvents } from './events';
import { targetBundle } from './target';

export interface Opportunity {
  id: string; kind: 'match-orbit' | 'intercept'; t: number; targetEpoch: number;
  y: State; target: State; positionError: number; relativeSpeed: number;
}
export interface EncounterProposal {
  kind: Opportunity['kind']; program: Program; arrival: Burn; positionError: number; relativeSpeed: number;
  totalDv: number; addedDv: number; propellantUsed: number; refinement: { position: number; velocity: number };
}
export type EncounterResult = { status: 'proposed'; proposal: EncounterProposal } | { status: 'failed'; reason: string };

// All roots come from continuous canonical coasts. Camera/display sampling never
// selects physics events. Geometric matching currently supports a circular target
// about the fixed primary; simultaneous intercepts also work for other target coasts.
export function discoverEncounters(bundle: Bundle, runner = new Runner(bundle), horizon = bundle.scenario.epoch + bundle.scenario.duration): Opportunity[] {
  const s = bundle.scenario, spec = s.rendezvous;
  if (!spec) return [];
  const tolerance = spec.tolerance;
  const target = new Runner(targetBundle(bundle)), rows: Opportunity[] = [];
  const coasts = runner.coastSegments(horizon), body = s.bodies[0], center = bodyState(body, s.epoch);
  const v = spec.target.state, dx = v[0] - center[0], dy = v[1] - center[1], radius = Math.hypot(dx, dy);
  const rate = (dx * v[3] - dy * v[2]) / (radius * radius), phase = Math.atan2(dy, dx);
  const circular = Math.abs(dx * v[2] + dy * v[3]) < 1e-9 && Math.abs(Math.hypot(v[2], v[3]) - Math.sqrt(body.mu / radius)) < 1e-9;
  const geometryTolerance = Math.min(1e-7, spec.tolerance.position / 100);
  const radiusError = (y: State) => Math.hypot(y[0] - center[0], y[1] - center[1]) - radius;
  function preState(segment: CoastSegment, t: number): State {
    return t === segment.t0 ? segment.y0 : t === segment.t1 ? segment.y1 : rk4(s, segment.t0, segment.y0, t - segment.t0);
  }
  function root(segment: CoastSegment, f: (t: number, y: State) => number): number {
    let lo = segment.t0, hi = segment.t1, f0 = f(lo, segment.y0);
    for (let i = 0; i < 40 && hi - lo > 1e-10; i++) {
      const mid = (lo + hi) / 2, value = f(mid, preState(segment, mid));
      if (f0 * value > 0) { lo = mid; f0 = value; } else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function add(kind: Opportunity['kind'], t: number, y: State, targetEpoch: number) {
    if (t <= s.epoch + 1e-6 || t >= horizon - 1e-6 || targetEpoch < s.epoch || targetEpoch > horizon) return;
    const other = target.sample(targetEpoch); if (other.t !== targetEpoch) return;
    const positionError = Math.hypot(y[0] - other.y[0], y[1] - other.y[1]);
    const relativeSpeed = Math.hypot(y[2] - other.y[2], y[3] - other.y[3]);
    if (positionError > (kind === 'intercept' ? tolerance.position : geometryTolerance) || relativeSpeed < 1e-8) return;
    if (rows.some(e => e.kind === kind && Math.abs(e.t - t) < 1e-5)) return;
    rows.push({ id: `${kind}:${t.toFixed(8)}`, kind, t, targetEpoch, y: [...y], target: [...other.y], positionError, relativeSpeed });
  }
  function geometric(t: number, y: State) {
    if (!circular) return;
    let angle = Math.atan2(y[1] - center[1], y[0] - center[0]) - phase;
    if (rate > 0) angle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    else angle = -(((-angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    const first = s.epoch + angle / rate, period = 2 * Math.PI / Math.abs(rate);
    // Explicitly retain the nearest visible occurrence, not a hidden revolution.
    const occurrences = [];
    for (let tt = first; tt <= horizon; tt += period) occurrences.push(tt);
    occurrences.sort((a, b) => Math.abs(a - t) - Math.abs(b - t));
    if (occurrences.length) add('match-orbit', t, y, occurrences[0]);
  }
  const approachRate = (t: number, y: State) => { const b = target.sample(t).y; return (y[0] - b[0]) * (y[2] - b[2]) + (y[1] - b[1]) * (y[3] - b[3]); };
  for (const coast of coasts) {
    if (circular) {
      const a = radiusError(coast.y0), b = radiusError(coast.y1);
      // Already-coincident coasts have no isolated crossing. Do not create a
      // cloud of match icons from circular numerical sign noise.
      if (a * b < 0 && Math.max(Math.abs(a), Math.abs(b)) > geometryTolerance) {
        const t = root(coast, (_t, y) => radiusError(y)); geometric(t, preState(coast, t));
      }
      if (bundle.program.burns.some(b => b.t === coast.t0) && Math.abs(a) < geometryTolerance) geometric(coast.t0, coast.y0);
    }
    const a = approachRate(coast.t0, coast.y0), b = approachRate(coast.t1, coast.y1);
    if (a < 0 && b >= 0) { const t = root(coast, approachRate); add('intercept', t, preState(coast, t), t); }
  }
  if (circular) for (const event of inspectEvents(bundle, runner, body.id, horizon, coasts).apsides) {
    if (Math.abs(event.distance - radius) <= geometryTolerance) geometric(event.t, runner.sample(event.t).y);
  }
  // A tangency may be geometric and simultaneous. Give both actions to the user.
  for (const event of [...rows]) if (event.kind === 'match-orbit') add('intercept', event.t, event.y, event.t);
  return rows.sort((a, b) => a.t - b.t || a.kind.localeCompare(b.kind));
}

export function proposeEncounter(input: Bundle, opportunityId: string): EncounterResult {
  const fail = (reason: string): EncounterResult => ({ status: 'failed', reason });
  try {
    const bundle = validateBundle(input), s = bundle.scenario, spec = s.rendezvous;
    if (!spec) return fail('No rendezvous target');
    const event = discoverEncounters(bundle).find(e => e.id === opportunityId);
    if (!event) return fail('Encounter changed; select its current marker');
    const existing = bundle.program.burns.find(b => Math.abs(b.t - event.t) < 1e-9);
    const t = existing?.t ?? event.t, program = structuredClone(bundle.program);
    program.burns = program.burns.filter(b => b.id !== existing?.id);
    const before = new Runner({ scenario: s, program }).sample(t);
    if (before.t !== t || before.status !== 'running') return fail('Encounter trajectory is unresolved');
    const targetEpoch = event.kind === 'intercept' ? t : event.targetEpoch;
    const target = new Runner(targetBundle(bundle)).sample(targetEpoch), y = before.y;
    const error = Math.hypot(y[0] - target.y[0], y[1] - target.y[1]);
    if (error > (event.kind === 'intercept' ? spec.tolerance.position : Math.min(1e-7, spec.tolerance.position / 100))) return fail('Encounter no longer meets the position tolerance');
    const ref = bodyState(s.bodies[0], t), dx = y[0] - ref[0], dy = y[1] - ref[1], r = Math.hypot(dx, dy);
    const dvx = target.y[2] - y[2], dvy = target.y[3] - y[3];
    let id = existing?.id ?? 'encounter-burn'; while (!existing && program.burns.some(b => b.id === id)) id += '-new';
    const arrival: Burn = { id, t, referenceBodyId: spec.referenceBodyId, basis: 'radial-transverse-ccw-v1',
      radial: (dvx * dx + dvy * dy) / r, transverse: (-dvx * dy + dvy * dx) / r,
      assist: { kind: event.kind, targetId: spec.target.id, targetEpoch } };
    program.burns.push(arrival); program.burns.sort((a, b) => a.t - b.t);
    const proposed = validateBundle({ scenario: s, program }), runner = new Runner(proposed), end = s.epoch + s.duration;
    const terminal = runner.sample(end);
    if (terminal.status !== 'horizon') return fail(terminal.status === 'burn-rejected' ? 'Not enough fuel for correction' : 'Correction trajectory is unresolved');
    const matched = runner.sample(t), relativeSpeed = Math.hypot(matched.y[2] - target.y[2], matched.y[3] - target.y[3]);
    if (relativeSpeed >= spec.tolerance.velocity) return fail('Velocity matching is unresolved');
    const refined = structuredClone(proposed); refined.scenario.policy.step /= 2;
    refined.scenario.policy.maxNodes = Math.min(65536, Math.max(s.policy.maxNodes, Math.ceil(s.duration / refined.scenario.policy.step) + 1024));
    const originalTarget = new Runner(targetBundle(bundle));
    const fine = new Runner(refined), fineTarget = new Runner(targetBundle(refined));
    if (fine.sample(end).status !== 'horizon' || fineTarget.sample(end).status !== 'horizon') return fail('Refined correction is unresolved');
    let position = 0, velocity = 0;
    for (const epoch of [t, targetEpoch, ...Array.from({ length: 81 }, (_, i) => s.epoch + s.duration * i / 80)]) {
      const a = runner.sample(epoch).y, b = fine.sample(epoch).y, c = originalTarget.sample(epoch).y, d = fineTarget.sample(epoch).y;
      position = Math.max(position, Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(c[0] - d[0], c[1] - d[1]));
      velocity = Math.max(velocity, Math.hypot(a[2] - b[2], a[3] - b[3]), Math.hypot(c[2] - d[2], c[3] - d[3]));
    }
    if (position >= spec.tolerance.position / 100 || velocity >= spec.tolerance.velocity / 100) return fail('Correction accuracy is unresolved');
    const cost = (p: Program) => p.burns.reduce((sum, b) => sum + Math.hypot(b.radial, b.transverse), 0), totalDv = cost(program);
    return { status: 'proposed', proposal: { kind: event.kind, program, arrival, positionError: error, relativeSpeed, totalDv,
      addedDv: totalDv - cost(bundle.program), propellantUsed: s.ship.propellant - terminal.propellant, refinement: { position, velocity } } };
  } catch (error) { return fail((error as Error).message); }
}
