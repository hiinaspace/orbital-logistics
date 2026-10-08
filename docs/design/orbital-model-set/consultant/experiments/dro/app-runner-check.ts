// Consultant check (2026-10-07): does the app's unchanged canonical Runner host the
// planar DRO found offline by dro.py? Loads the real moon fixture, swaps only the
// ship state, runs to t=24 (8.6 periods) and measures rotating-frame closure.
// Run from the repo root: npx tsx docs/design/orbital-model-set/consultant/experiments/dro/app-runner-check.ts
import {readFileSync, writeFileSync} from 'node:fs';
import {Runner} from '../../../../../../src/sim/runner';
import {validateBundle, type State} from '../../../../../../src/sim/schema';

const dro = JSON.parse(readFileSync('docs/design/orbital-model-set/consultant/experiments/dro/results.json', 'utf8'));
const bundle = JSON.parse(readFileSync('fixtures/m0-binary.json', 'utf8'));
bundle.scenario.duration = 24; bundle.scenario.policy.maxNodes = 65536;
bundle.scenario.ship.state = dro.chosen_inertial.initial_inertial_state;
bundle.program = {schemaVersion: 1, id: 'dro-viewer-only', burns: []};
const period: number = dro.two_body_comparison.dro_period;
const rotating = (y: State, t: number): State => { // rails rotate at rate 1 about the barycentre
  const c = Math.cos(-t), s = Math.sin(-t), [x, yy, vx, vy] = y;
  const rx = c * x - s * yy, ry = s * x + c * yy; // position in rotating frame
  const vxi = c * vx - s * vy, vyi = s * vx + c * vy; // inertial velocity expressed in rotating axes
  return [rx, ry, vxi + ry, vyi - rx]; // subtract omega x r with omega = 1
};
function run(step: number) {
  const b = structuredClone(bundle); b.scenario.policy.step = step;
  const runner = new Runner(validateBundle(b)), start = rotating(runner.sample(0).y, 0);
  const closure = [1, 2, 3, 8].map(k => { const t = k * period, y = rotating(runner.sample(t).y, t);
    return {k, position: Math.hypot(y[0] - start[0], y[1] - start[1]), velocity: Math.hypot(y[2] - start[2], y[3] - start[3])}; });
  const end = runner.sample(24);
  let minMoon = Infinity;
  for (let t = 0; t <= 24; t += 1 / 64) { const y = runner.sample(t).y; minMoon = Math.min(minMoon, Math.hypot(y[0] - 0.98 * Math.cos(t), y[1] - 0.98 * Math.sin(t))); }
  return {step, status: end.status, retainedNodes: runner.retainedNodes, closure, minMoonCentreDistance: minMoon};
}
const out = {fixture: 'fixtures/m0-binary.json', shipState: bundle.scenario.ship.state, period, runs: [run(1 / 512), run(1 / 1024)]};
console.log(JSON.stringify(out, null, 2));
writeFileSync('docs/design/orbital-model-set/consultant/experiments/dro/app-runner-check.json', JSON.stringify(out, null, 2) + '\n');
