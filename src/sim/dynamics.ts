import type { Body, Scenario, State } from './schema';

export function bodyState(body: Body, t: number): State {
  const rail = body.rail;
  if (rail.kind === 'fixed') return [...rail.position, 0, 0];
  const angle = rail.phase + rail.rate * t, c = Math.cos(angle), s = Math.sin(angle);
  return [rail.center[0] + rail.radius * c, rail.center[1] + rail.radius * s,
    -rail.radius * rail.rate * s, rail.radius * rail.rate * c];
}
export function derivative(scenario: Scenario, t: number, y: State): State {
  let ax = 0, ay = 0;
  for (const body of scenario.bodies) {
    const b = bodyState(body, t), dx = b[0] - y[0], dy = b[1] - y[1], r = Math.hypot(dx, dy);
    if (r <= body.radius) throw new Error('Derivative requested inside a surface');
    ax += body.mu * dx / r ** 3; ay += body.mu * dy / r ** 3;
  }
  return [y[2], y[3], ax, ay];
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
// Failed certificates are subdivided by the runner, never softened or traversed.
export function certifiedCoast(scenario: Scenario, t: number, y: State, h: number): boolean {
  const clearances = scenario.bodies.map(body => {
    const b = bodyState(body, t);
    return Math.hypot(y[0] - b[0], y[1] - b[1]) - body.radius;
  });
  if (clearances.some(c => c <= 0)) return false;
  const accelerationBound = scenario.bodies.reduce((sum, body, i) =>
    sum + body.mu / (body.radius + clearances[i] / 2) ** 2, 0);
  const speed = Math.hypot(y[2], y[3]);
  return scenario.bodies.every((body, i) => {
    const sourceSpeed = body.rail.kind === 'fixed' ? 0 : Math.abs(body.rail.radius * body.rail.rate);
    const excursion = (speed + sourceSpeed) * h + accelerationBound * h * h / 2;
    return Number.isFinite(excursion) && excursion < clearances[i] / 2;
  });
}
