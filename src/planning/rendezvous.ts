import { bodyState } from '../sim/dynamics';
import { Runner, type Sample } from '../sim/runner';
import { validateBundle, type Bundle, type Burn, type Program } from '../sim/schema';
import { inspectEvents } from './events';
import { targetBundle } from './target';

export interface Trial {
  radial: number; transverse: number; status: string;
  error?: number; sweep?: number; clearance?: number;
}
export interface RendezvousProposal {
  program: Program; departure: Burn; arrival: Burn;
  positionError: number; relativeSpeed: number; totalDv: number; addedDv: number;
  propellantUsed: number; iterations: number; evaluations: number;
  refinement: { position: number; velocity: number };
}
export type SolveResult = { status: 'proposed'; proposal: RendezvousProposal; trials: Trial[] } |
  { status: 'failed'; reason: string; trials: Trial[] };

// Deliberately narrow: one fixed-time departure, one coast, CCW and less than
// one full revolution about a fixed primary. Every trial obeys that same domain.
export function solveRendezvous(input: Bundle, burnId: string, maxEvaluations = 96): SolveResult {
  const trials: Trial[] = [];
  const fail = (reason: string): SolveResult => ({ status: 'failed', reason, trials });
  try {
    const bundle = validateBundle(input), s = bundle.scenario, spec = s.rendezvous;
    if (!spec) return fail('No rendezvous target');
    if (!Number.isInteger(maxEvaluations) || maxEvaluations < 1 || maxEvaluations > 96) return fail('Invalid work budget');
    const seed = bundle.program.burns.find(b => b.id === burnId);
    if (!seed || bundle.program.burns.length !== 1 || seed.t !== spec.departureEpoch || seed.referenceBodyId !== spec.referenceBodyId || seed.snap) return fail('Select the single departure maneuver at the departure epoch');
    const target = new Runner(targetBundle(bundle));
    if (target.sample(s.epoch + s.duration).status !== 'horizon') return fail('Target trajectory is unresolved');
    const targetArrival = target.sample(spec.arrivalEpoch), body = s.bodies[0];
    let evaluations = 0;
    const candidate = (radial: number, transverse: number) => {
      if (evaluations >= maxEvaluations) throw new Error('Work limit reached');
      evaluations++;
      const row: Trial = { radial, transverse, status: 'bounds' }; trials.push(row);
      if (radial < spec.bounds.radial[0] || radial > spec.bounds.radial[1] || transverse < spec.bounds.transverse[0] || transverse > spec.bounds.transverse[1]) return undefined;
      const departure: Burn = { ...seed, radial, transverse };
      const b: Bundle = { scenario: s, program: { ...bundle.program, burns: [departure] } };
      const runner = new Runner(b), arrival = runner.sample(spec.arrivalEpoch);
      if (arrival.t !== spec.arrivalEpoch || arrival.status !== 'running') { row.status = arrival.status; return undefined; }
      const coasts = runner.coastSegments(spec.arrivalEpoch).filter(c => c.t0 >= spec.departureEpoch);
      let sweep = 0;
      for (const coast of coasts) {
        const center = bodyState(body, coast.t0), a = [coast.y0[0] - center[0], coast.y0[1] - center[1]], b = [coast.y1[0] - center[0], coast.y1[1] - center[1]];
        // Negative angular momentum is a different branch, even before a full turn.
        if (a[0] * coast.y0[3] - a[1] * coast.y0[2] <= 0) { row.status = 'branch'; return undefined; }
        sweep += Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
      }
      const clearance = inspectEvents(b, runner, body.id, spec.arrivalEpoch, coasts).closest.altitude;
      row.sweep = sweep; row.clearance = clearance;
      if (sweep <= 0 || sweep >= 2 * Math.PI || clearance < spec.branch.minClearance) { row.status = 'branch'; return undefined; }
      const residual = [arrival.y[0] - targetArrival.y[0], arrival.y[1] - targetArrival.y[1]] as [number, number];
      row.status = 'valid'; row.error = Math.hypot(...residual);
      return { departure, arrival, residual, error: row.error };
    };
    let current = candidate(seed.radial, seed.transverse);
    if (!current) return fail(`Seed outside the allowed branch: ${trials.at(-1)!.status}`);
    let iterations = 0;
    const solveTolerance = Math.min(spec.tolerance.position / 100, 1e-7);
    while (current.error > solveTolerance && iterations < 12) {
      iterations++;
      const columns: [number, number][] = [];
      for (const axis of ['radial', 'transverse'] as const) {
        const delta = 1e-4;
        const plus = candidate(current.departure.radial + (axis === 'radial' ? delta : 0), current.departure.transverse + (axis === 'transverse' ? delta : 0));
        const minus = candidate(current.departure.radial - (axis === 'radial' ? delta : 0), current.departure.transverse - (axis === 'transverse' ? delta : 0));
        if (!plus && !minus) return fail('No sensitivity inside the allowed branch');
        const a = plus ?? current, b = minus ?? current, scale = plus && minus ? 2 * delta : delta;
        columns.push([(a.residual[0] - b.residual[0]) / scale, (a.residual[1] - b.residual[1]) / scale]);
      }
      const [[a, c], [b, d]] = columns, determinant = a * d - b * c;
      if (Math.abs(determinant) < 1e-10) return fail('Departure sensitivity is singular');
      const [x, y] = current.residual;
      let dr = (-d * x + b * y) / determinant, dt = (c * x - a * y) / determinant;
      const trust = Math.min(1, 0.04 / Math.hypot(dr, dt)); dr *= trust; dt *= trust;
      let next: typeof current | undefined;
      for (let line = 0; line < 8; line++) {
        const scale = 2 ** -line;
        const trial = candidate(current.departure.radial + dr * scale, current.departure.transverse + dt * scale);
        if (trial && trial.error < current.error) { next = trial; break; }
      }
      if (!next) return fail('No improving correction inside the allowed branch');
      current = next;
    }
    if (current.error > solveTolerance) return fail('Rendezvous did not converge');
    const pre = current.arrival, ref = bodyState(body, spec.arrivalEpoch), dx = pre.y[0] - ref[0], dy = pre.y[1] - ref[1], r = Math.hypot(dx, dy);
    const dvx = targetArrival.y[2] - pre.y[2], dvy = targetArrival.y[3] - pre.y[3];
    const arrival: Burn = { id: 'rendezvous-arrival', t: spec.arrivalEpoch, referenceBodyId: body.id, basis: 'radial-transverse-ccw-v1',
      radial: (dvx * dx + dvy * dy) / r, transverse: (-dvx * dy + dvy * dx) / r };
    const program: Program = { ...bundle.program, burns: [current.departure, arrival] };
    const proposed = validateBundle({ scenario: s, program }), execution = new Runner(proposed);
    const terminal = execution.sample(s.epoch + s.duration);
    if (terminal.status !== 'horizon') return fail(terminal.status === 'burn-rejected' ? 'Not enough fuel for arrival burn' : `Proposal stopped: ${terminal.status}`);
    const matched = execution.sample(spec.arrivalEpoch), relativeSpeed = Math.hypot(matched.y[2] - targetArrival.y[2], matched.y[3] - targetArrival.y[3]);
    if (current.error >= spec.tolerance.position || relativeSpeed >= spec.tolerance.velocity) return fail('Arrival tolerances unresolved');
    // Independent step refinement is tied to capture tolerances, not screen zoom.
    const refined = structuredClone(proposed); refined.scenario.policy.step /= 2;
    refined.scenario.policy.maxNodes = Math.min(65536, Math.max(s.policy.maxNodes, Math.ceil(s.duration / refined.scenario.policy.step) + 1024));
    const fine = new Runner(refined), fineTarget = new Runner(targetBundle(refined));
    if (fine.sample(s.epoch + s.duration).status !== 'horizon' || fineTarget.sample(s.epoch + s.duration).status !== 'horizon') return fail('Refined proposal stopped');
    let position = 0, velocity = 0;
    for (const t of [spec.departureEpoch, spec.arrivalEpoch, ...Array.from({ length: 81 }, (_, i) => s.epoch + s.duration * i / 80)]) {
      for (const [a, b] of [[execution.sample(t), fine.sample(t)], [target.sample(t), fineTarget.sample(t)]] as [Sample, Sample][]) {
        position = Math.max(position, Math.hypot(a.y[0] - b.y[0], a.y[1] - b.y[1]));
        velocity = Math.max(velocity, Math.hypot(a.y[2] - b.y[2], a.y[3] - b.y[3]));
      }
    }
    if (position >= spec.tolerance.position / 100 || velocity >= spec.tolerance.velocity / 100) return fail('Proposal accuracy unresolved');
    const totalDv = program.burns.reduce((sum, b) => sum + Math.hypot(b.radial, b.transverse), 0);
    return { status: 'proposed', trials, proposal: { program, departure: current.departure, arrival, positionError: current.error, relativeSpeed,
      totalDv, addedDv: totalDv - Math.hypot(seed.radial, seed.transverse), propellantUsed: s.ship.propellant - terminal.propellant,
      iterations, evaluations, refinement: { position, velocity } } };
  } catch (error) { return fail((error as Error).message); }
}
