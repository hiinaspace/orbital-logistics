import {burnMagnitude} from '../sim/burns';
import {distance, relativeSpeed, position, velocity, subtract, dot} from '../sim/vectors';
import {validateBundle} from '../sim/schema';
import { bodyState } from '../sim/dynamics';
import { Runner, type CoastSegment } from '../sim/runner';
import type { Bundle, State } from '../sim/schema';

export interface Encounter {
  bodyId: string; kind: 'periapsis' | 'apoapsis' | 'endpoint'; t: number;
  distance: number; altitude: number; relativeSpeed: number;
}
export interface Diagnostics { apsides: Encounter[]; closest: Encounter; apsidesUnique: boolean }
export function inspectEvents(bundle: Bundle, runner: Runner, bodyId: string, horizon: number, segments = runner.coastSegments(horizon)): Diagnostics {
  bundle=validateBundle(bundle);
  const scenario = bundle.scenario, body = scenario.bodies.find(b => b.id === bodyId);
  const impulses = bundle.program.burns.filter(b => burnMagnitude(b) > 0);
  if (!body) throw new Error('Unknown encounter body');
  function inspect(t: number, y: State, kind: Encounter['kind']): Encounter {
    const b = bodyState(body!, t), separation = distance(y,b);
    return { bodyId, kind, t, distance:separation, altitude: separation - body!.radius,
      relativeSpeed: relativeSpeed(y,b) };
  }
  function radialSpeed(t: number, y: State): number {
    const b=bodyState(body!,t), r=subtract(position(y),position(b));
    return dot(r,subtract(velocity(y),velocity(b)))/distance(y,b);
  }
  function root(segment: CoastSegment, g0: number): number {
    let lo = segment.t0, hi = segment.t1;
    for (let i = 0; i < 40 && hi - lo > 1e-10; i++) {
      const t = (lo + hi) / 2, y = runner.segmentState(segment,t);
      if (radialSpeed(t, y) * g0 > 0) lo = t; else hi = t;
    }
    return (lo + hi) / 2;
  }
  const initial = runner.sample(scenario.epoch), candidates: { event: Encounter; group: number }[] = [];
  const groupMaximum = [0]; let group = 0;
  let closest = segments.length ? inspect(segments[0].t0, segments[0].y0, 'endpoint') : inspect(initial.t, initial.y, 'endpoint');
  for (const segment of segments) {
    if (segment.t0 !== scenario.epoch && impulses.some(b => b.t === segment.t0)) { group++; groupMaximum[group] = 0; }
    const g0 = radialSpeed(segment.t0, segment.y0), g1 = radialSpeed(segment.t1, segment.y1);
    groupMaximum[group] = Math.max(groupMaximum[group], Math.abs(g0), Math.abs(g1));
    const endpoint = inspect(segment.t1, segment.y1, 'endpoint');
    if (endpoint.distance < closest.distance) closest = endpoint;
    if (g0 * g1 < 0 || (g0 !== 0 && g1 === 0)) {
      const t = root(segment, g0);
      if (impulses.some(b => Math.abs(t - b.t) < 1e-6) ||
          candidates.some(a => Math.abs(a.event.t - t) < 1e-7)) continue;
      const event = inspect(t, runner.segmentState(segment,t), g0 < 0 ? 'periapsis' : 'apoapsis');
      candidates.push({ event, group });
      if (event.distance < closest.distance) closest = event;
    }
  }
  // Circular coasts have no unique apsis. Numerical sign noise is not an event.
  const apsides = candidates.filter(c => groupMaximum[c.group] > 1e-6).map(c => c.event);
  return { apsides, closest, apsidesUnique: groupMaximum.some(g => g > 1e-6) };
}
