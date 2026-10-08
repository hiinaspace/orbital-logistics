import {validateBundle} from '../sim/schema';
import {distance, relativeSpeed} from '../sim/vectors';
import { Runner, type Sample } from '../sim/runner';
import type { Bundle } from '../sim/schema';
import { inspectEvents, type Diagnostics } from './events';
import { targetBundle } from './target';
import { discoverEncounters, type Opportunity } from './encounters';
import { logisticsResult } from '../sim/logistics';

export interface Prediction {
  revision: number; scenarioId: string; modelVersion: string; horizon: number;
  samples: Sample[]; terminal: Sample; diagnostics: Record<string, Diagnostics>;
  burnStates: Record<string, Sample>;
  logistics?: ReturnType<typeof logisticsResult>;
  rendezvous?: { t: number; positionError: number; relativeSpeed: number; kind?: 'match-orbit' | 'intercept'; targetEpoch?: number };
  opportunities: Opportunity[];
  accuracy?: { status: 'converged' | 'unresolved'; position: number; velocity: number; eventTime: number; classificationStable: boolean };
}
export function predict(bundle: Bundle, revision: number, horizon = bundle.scenario.epoch + bundle.scenario.duration, verify = false): Prediction {
  bundle=validateBundle(bundle);
  const runner = new Runner(bundle), samples: Sample[] = [], start = bundle.scenario.epoch;
  // Display sampling is disposable; canonical coast brackets drive events.
  const eventEpochs = [...bundle.program.burns.map(b => b.t), ...(bundle.program.thrustArcs??[]).flatMap(a=>[a.start,a.end]), ...(bundle.program.operations ?? []).flatMap(o => [o.t, ...(o.kind === 'transfer' ? [o.t + bundle.scenario.logistics!.ports.find(p => p.id === o.portId)!.serviceDuration] : [])])];
  const epochs = [...new Set([...Array.from({length: 801}, (_, i) => start + (horizon - start) * i / 800), ...eventEpochs.filter(t => t >= start && t <= horizon)])].sort((a,b) => a-b);
  for (const t of epochs) {
    const sample = runner.sample(t);
    samples.push(sample); if (sample.status !== 'running') break;
  }
  const terminal = runner.sample(horizon), diagnostics: Record<string, Diagnostics> = {};
  const coasts = runner.coastSegments(horizon);
  for (const body of bundle.scenario.bodies) diagnostics[body.id] = inspectEvents(bundle, runner, body.id, horizon, coasts);
  const burnStates = Object.fromEntries(bundle.program.burns.map(b => [b.id, runner.sample(b.t)]));
  const result: Prediction = { revision, scenarioId: bundle.scenario.id, modelVersion: bundle.scenario.modelVersion,
    horizon, samples, terminal, diagnostics, burnStates, opportunities: discoverEncounters(bundle, runner, horizon) };
  if (bundle.scenario.logistics && terminal.logistics) {
    result.logistics = logisticsResult(bundle.scenario.logistics, terminal.logistics, terminal.propellant, terminal.t);
    if (terminal.status !== 'horizon') {result.logistics.complete = false; result.logistics.completedAt = undefined; result.logistics.reason = terminal.detail;}
  }
  if (bundle.scenario.rendezvous) {
    const assistBurn = bundle.program.burns.filter(b => b.assist).at(-1);
    const t = assistBurn?.t ?? bundle.scenario.rendezvous.arrivalEpoch, targetEpoch = assistBurn?.assist?.targetEpoch ?? t;
    const ship = runner.sample(t), target = new Runner(targetBundle(bundle)).sample(targetEpoch);
    if (ship.t === t && target.t === targetEpoch) result.rendezvous = { t, kind: assistBurn?.assist?.kind, targetEpoch, positionError: distance(ship.y,target.y), relativeSpeed: relativeSpeed(ship.y,target.y) };
  }
  if (verify) {
    const refined = structuredClone(bundle); refined.scenario.policy.step /= 2;
    refined.scenario.policy.maxNodes = Math.min(65536, Math.max(refined.scenario.policy.maxNodes, Math.ceil(refined.scenario.duration / refined.scenario.policy.step) + 1024));
    try {
      const fine = new Runner(refined), fineTerminal = fine.sample(horizon);
      let position = 0, velocity = 0, eventTime = 0;
      let classificationStable = terminal.status === fineTerminal.status;
      if (bundle.scenario.logistics) {
        classificationStable &&= JSON.stringify(runner.ledger.map(e => [e.t, e.kind, e.id])) === JSON.stringify(fine.ledger.map(e => [e.t, e.kind, e.id]));
        const a = terminal.logistics!, b = fineTerminal.logistics!;
        classificationStable &&= a.dockedPortId === b.dockedPortId && a.operationCursor === b.operationCursor &&
          JSON.stringify(a.ports) === JSON.stringify(b.ports) && a.cargoMass === b.cargoMass && Math.abs(terminal.propellant - fineTerminal.propellant) < 1e-8;
      }
      for (const sample of samples) {
        if (sample.t > Math.min(terminal.t, fineTerminal.t)) continue;
        const other = fine.sample(sample.t);
        position = Math.max(position, distance(sample.y,other.y));
        velocity = Math.max(velocity, relativeSpeed(sample.y,other.y));
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
      const positionTolerance = Math.min(1e-5, (bundle.scenario.logistics?.capture.position ?? 0.001) / 100);
      const velocityTolerance = Math.min(1e-5, (bundle.scenario.logistics?.capture.velocity ?? 0.001) / 100);
      result.accuracy = { status: classificationStable && position < positionTolerance && velocity < velocityTolerance && eventTime < 1e-5 ? 'converged' : 'unresolved',
        position, velocity, eventTime, classificationStable };
    } catch {
      result.accuracy = { status: 'unresolved', position: Infinity, velocity: Infinity, eventTime: Infinity, classificationStable: false };
    }
  }
  return result;
}
