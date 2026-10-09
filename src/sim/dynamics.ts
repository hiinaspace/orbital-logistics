import type { Body, Scenario, State } from './schema';
import {distance, norm, velocity} from './vectors';

export function bodyState(body: Body, t: number): State {
  const rail = body.rail;
  if (rail.kind === 'fixed') return [...rail.position, 0, 0, 0];
  const angle = rail.phase + rail.rate * t, c = Math.cos(angle), s = Math.sin(angle);
  return [...rail.center.map((x,i)=>x+rail.radius*(rail.u[i]*c+rail.v[i]*s)),
    ...rail.u.map((u,i)=>rail.radius*rail.rate*(-u*s+rail.v[i]*c))] as State;
}
export function derivative(scenario: Scenario, t: number, y: State, gravityJacobian?:number[]): State {
  const acceleration = [0,0,0];
  gravityJacobian?.fill(0);
  for (const body of scenario.bodies) {
    const b = bodyState(body, t), r = distance(b,y);
    if (r <= body.radius) throw new Error('Derivative requested inside a surface');
    for(let i=0;i<3;i++) acceleration[i] += body.mu*(b[i]-y[i])/r**3;
    if(gravityJacobian){const factor=body.mu/r**3,q=3*factor/(r*r);for(let i=0;i<3;i++)for(let j=0;j<3;j++)gravityJacobian[3*i+j]+=q*(b[i]-y[i])*(b[j]-y[j])-(i===j?factor:0);}
  }
  return [...velocity(y), ...acceleration] as State;
}

function add(y: State, k: State, h: number): State {
  return y.map((v, i) => v + h * k[i]) as State;
}
export function rk4(scenario: Scenario, t: number, y: State, h: number): State {
  const a = derivative(scenario, t, y), b = derivative(scenario, t + h / 2, add(y, a, h / 2));
  const c = derivative(scenario, t + h / 2, add(y, b, h / 2)), d = derivative(scenario, t + h, add(y, c, h));
  return y.map((v, i) => v + h * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6) as State;
}

// A sufficient clearance certificate for all RK stages AND continuous motion.
// In each body's half-clearance ball, this acceleration bound is valid. If even
// the maximum excursion cannot leave any such ball, a surface cannot be crossed.
// The spatial norm obeys the same triangle bound. The rail speed bound uses
// the Frobenius norm of its accepted basis (conservative even within tolerance).
// Failed certificates are subdivided by the runner, never softened or traversed.
export function certifiedCoast(scenario: Scenario, t: number, y: State, h: number, propulsiveAccelerationBound = 0): boolean {
  const clearances = scenario.bodies.map(body => {
    const b = bodyState(body, t);
    return distance(y,b) - body.radius;
  });
  if (clearances.some(c => c <= 0)) return false;
  const accelerationBound = scenario.bodies.reduce((sum, body, i) =>
    sum + body.mu / (body.radius + clearances[i] / 2) ** 2, propulsiveAccelerationBound);
  const speed = norm(velocity(y));
  return scenario.bodies.every((body, i) => {
    const sourceSpeed = body.rail.kind === 'fixed' ? 0 : Math.abs(body.rail.radius * body.rail.rate) * Math.sqrt(norm(body.rail.u)**2 + norm(body.rail.v)**2);
    const excursion = (speed + sourceSpeed) * h + accelerationBound * h * h / 2;
    return Number.isFinite(excursion) && excursion < clearances[i] / 2;
  });
}
