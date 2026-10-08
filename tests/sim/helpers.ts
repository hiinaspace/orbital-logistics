import { readFileSync } from 'node:fs';
import { validateBundle, type Bundle, type State } from '../../src/sim/schema';

export const circular = validateBundle(JSON.parse(readFileSync(new URL('../../fixtures/m0-circular.json', import.meta.url), 'utf8')));
export const impulse = validateBundle({scenario:circular.scenario,program:JSON.parse(readFileSync(new URL('../../fixtures/m0-impulse.json', import.meta.url), 'utf8'))}).program;
export function fixture(state?: State | [number,number,number,number], step = 1 / 512): Bundle {
  const bundle = structuredClone(circular);
  if (state) bundle.scenario.ship.state = state.length===4 ? [state[0],state[1],0,state[2],state[3],0] : state;
  bundle.scenario.policy.step = step;
  bundle.scenario.policy.maxNodes = 65536;
  return bundle;
}
export const error = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
export function analytic(t: number, eccentricity: number): State {
  if (eccentricity < 1) {
    let E = t;
    for (let i = 0; i < 30; i++) E -= (E - eccentricity * Math.sin(E) - t) / (1 - eccentricity * Math.cos(E));
    const den = 1 - eccentricity * Math.cos(E), b = Math.sqrt(1 - eccentricity ** 2);
    return [Math.cos(E) - eccentricity, b * Math.sin(E), 0, -Math.sin(E) / den, b * Math.cos(E) / den, 0];
  }
  let H = Math.asinh(t / eccentricity);
  for (let i = 0; i < 30; i++) H -= (eccentricity * Math.sinh(H) - H - t) / (eccentricity * Math.cosh(H) - 1);
  const den = eccentricity * Math.cosh(H) - 1, b = Math.sqrt(eccentricity ** 2 - 1);
  return [eccentricity - Math.cosh(H), b * Math.sinh(H), 0, -Math.sinh(H) / den, b * Math.cosh(H) / den, 0];
}
