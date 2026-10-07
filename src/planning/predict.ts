import { Runner, type Sample } from '../sim/runner';
import type { Bundle } from '../sim/schema';
import { inspectEvents, type Diagnostics } from './events';
import { targetBundle } from './target';
import { discoverEncounters, type Opportunity } from './encounters';

export interface Prediction {
  revision: number; scenarioId: string; modelVersion: string; horizon: number;
  samples: Sample[]; terminal: Sample; diagnostics: Record<string, Diagnostics>;
  burnStates: Record<string, Sample>;
  rendezvous?: { t: number; positionError: number; relativeSpeed: number; kind?: 'match-orbit' | 'intercept'; targetEpoch?: number };
  opportunities: Opportunity[];
  accuracy?: { status: 'converged' | 'unresolved'; position: number; velocity: number; eventTime: number; classificationStable: boolean };
}
export function predict(bundle: Bundle, revision: number, horizon = bundle.scenario.epoch + bundle.scenario.duration, verify = false): Prediction {
  const runner = new Runner(bundle), samples: Sample[] = [], start = bundle.scenario.epoch;
  // Display sampling is disposable; canonical coast brackets drive events.
  for (let i = 0; i <= 800; i++) {
    const sample = runner.sample(start + (horizon - start) * i / 800);
    samples.push(sample); if (sample.status !== 'running') break;
  }
  const terminal = runner.sample(horizon), diagnostics: Record<string, Diagnostics> = {};
  const coasts = runner.coastSegments(horizon);
  for (const body of bundle.scenario.bodies) diagnostics[body.id] = inspectEvents(bundle, runner, body.id, horizon, coasts);
  const burnStates = Object.fromEntries(bundle.program.burns.map(b => [b.id, runner.sample(b.t)]));
  const result: Prediction = { revision, scenarioId: bundle.scenario.id, modelVersion: bundle.scenario.modelVersion,
    horizon, samples, terminal, diagnostics, burnStates, opportunities: discoverEncounters(bundle, runner, horizon) };
  if (bundle.scenario.rendezvous) {
    const assistBurn = bundle.program.burns.filter(b => b.assist).at(-1);
    const t = assistBurn?.t ?? bundle.scenario.rendezvous.arrivalEpoch, targetEpoch = assistBurn?.assist?.targetEpoch ?? t;
    const ship = runner.sample(t), target = new Runner(targetBundle(bundle)).sample(targetEpoch);
    if (ship.t === t && target.t === targetEpoch) result.rendezvous = { t, kind: assistBurn?.assist?.kind, targetEpoch, positionError: Math.hypot(ship.y[0] - target.y[0], ship.y[1] - target.y[1]), relativeSpeed: Math.hypot(ship.y[2] - target.y[2], ship.y[3] - target.y[3]) };
  }
  if (verify) {
    const refined = structuredClone(bundle); refined.scenario.policy.step /= 2;
    refined.scenario.policy.maxNodes = Math.min(65536, Math.max(refined.scenario.policy.maxNodes, Math.ceil(refined.scenario.duration / refined.scenario.policy.step) + 1024));
    try {
      const fine = new Runner(refined), fineTerminal = fine.sample(horizon);
      let position = 0, velocity = 0, eventTime = 0;
      let classificationStable = terminal.status === fineTerminal.status;
      for (const sample of samples) {
        if (sample.t > Math.min(terminal.t, fineTerminal.t)) continue;
        const other = fine.sample(sample.t);
        position = Math.max(position, Math.hypot(sample.y[0] - other.y[0], sample.y[1] - other.y[1]));
        velocity = Math.max(velocity, Math.hypot(sample.y[2] - other.y[2], sample.y[3] - other.y[3]));
      }
      const refinedCoasts = fine.coastSegments(horizon);
      for (const body of bundle.scenario.bodies) {
        const events = inspectEvents(refined, fine, body.id, horizon, refinedCoasts).apsides;
        const original = diagnostics[body.id].apsides;
        if (events.length !== original.length) classificationStable = false;
        for (let i = 0; i < Math.min(events.length, original.length); i++) {
          if (events[i].kind !== original[i].kind) classificationStable = false;
          eventTime = Math.max(eventTime, Math.abs(events[i].t - original[i].t));
        }
      }
      result.accuracy = { status: classificationStable && position < 1e-5 && velocity < 1e-5 && eventTime < 1e-5 ? 'converged' : 'unresolved',
        position, velocity, eventTime, classificationStable };
    } catch {
      result.accuracy = { status: 'unresolved', position: Infinity, velocity: Infinity, eventTime: Infinity, classificationStable: false };
    }
  }
  return result;
}
