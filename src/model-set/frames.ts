import { bodyState } from '../sim/dynamics';
import { portState } from '../sim/logistics';
import type { State } from '../sim/schema';
import { portsOf, stateAt, type SetRun } from './model';

export function transform(run: SetRun, y: State, t: number, frame: string): State {
  let origin: State = [0, 0, 0, 0], angle = 0, rate = 0;
  if (frame === 'rotating') { rate = run.rotating.rate; angle = run.rotating.phase + rate * t; }
  else if (frame !== 'inertial') {
    const body = run.vessels[0].bundle.scenario.bodies.find(b => b.id === frame);
    const port = portsOf(run).find(p => p.id === frame);
    const vessel = run.vessels.find(v => v.bundle.scenario.ship.id === frame);
    if (body) origin = bodyState(body, t);
    else if (port) origin = portState(port, t);
    else if (vessel) origin = stateAt(vessel, t);
    else throw new Error('Unknown frame');
  }
  const c = Math.cos(angle), s = Math.sin(angle), x = y[0] - origin[0], yy = y[1] - origin[1];
  const rx = c * x + s * yy, ry = -s * x + c * yy;
  return [rx, ry, c * (y[2] - origin[2]) + s * (y[3] - origin[3]) + rate * ry,
    -s * (y[2] - origin[2]) + c * (y[3] - origin[3]) - rate * rx];
}
