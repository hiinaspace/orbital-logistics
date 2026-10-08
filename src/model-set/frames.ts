import { bodyState } from '../sim/dynamics';
import type { State, Vec3 } from '../sim/schema';
import { displayPortState, portsOf, stateAt, type SetRun } from './model';

export function transform(run: SetRun, y: State, t: number, frame: string): State {
  let origin: State = [0, 0, 0, 0, 0, 0], angle = 0, rate = 0;
  if (frame === 'rotating') { rate = run.rotating.rate; angle = run.rotating.phase + rate * t; }
  else if (frame !== 'inertial') {
    const body = run.vessels[0].bundle.scenario.bodies.find(b => b.id === frame);
    const port = portsOf(run).find(p => p.id === frame);
    const vessel = run.vessels.find(v => v.bundle.scenario.ship.id === frame);
    if (body) origin = bodyState(body, t);
    else if (port) origin = displayPortState(port,run.portSamples,t);
    else if (vessel) origin = stateAt(vessel, t);
    else throw new Error('Unknown frame');
  }
  const c = Math.cos(angle), s = Math.sin(angle), x = y[0] - origin[0], yy = y[1] - origin[1];
  const rx = c * x + s * yy, ry = -s * x + c * yy;
  return [rx, ry, y[2]-origin[2], c * (y[3] - origin[3]) + s * (y[4] - origin[4]) + rate * ry,
    -s * (y[3] - origin[3]) + c * (y[4] - origin[4]) - rate * rx, y[5]-origin[5]];
}

// Forces/directions rotate with the axes. They have no translating origin or
// angular-velocity term; that term belongs to velocities at a position.
export function transformDirection(run:SetRun, direction:Vec3, t:number, frame:string):Vec3 {
  if(frame!=='rotating')return [...direction];
  const angle=run.rotating.phase+run.rotating.rate*t,c=Math.cos(angle),s=Math.sin(angle);
  return [c*direction[0]+s*direction[1],-s*direction[0]+c*direction[1],direction[2]];
}
