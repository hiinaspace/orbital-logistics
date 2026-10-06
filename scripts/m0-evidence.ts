import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { cpus, hostname } from 'node:os';
import { Runner } from '../src/sim/runner';
import { validateBundle } from '../src/sim/schema';
import { analytic, error, fixture, impulse } from '../tests/sim/helpers';

const twoBody = [0, 0.6, 1.5].map(e => {
  const horizon = e < 1 ? 2 * Math.PI : 4;
  const steps = [1 / 128, 1 / 256, 1 / 512].map(step => {
    const initial = analytic(0, e), runner = new Runner(fixture(initial, step));
    const energy = (y: number[]) => (y[2] ** 2 + y[3] ** 2) / 2 - 1 / Math.hypot(y[0], y[1]);
    const angular = (y: number[]) => y[0] * y[3] - y[1] * y[2];
    let maxStateError = 0, maxPositionError = 0, maxEnergyDrift = 0, maxAngularDrift = 0;
    for (let i = 0; i <= 600; i++) {
      const t = horizon * i / 600, sample = runner.advanceTo(t), expected = analytic(t, e);
      assert.equal(sample.status, 'running');
      maxStateError = Math.max(maxStateError, error(sample.y, expected));
      maxPositionError = Math.max(maxPositionError, error(sample.y.slice(0, 2), expected.slice(0, 2)));
      maxEnergyDrift = Math.max(maxEnergyDrift, Math.abs(energy(sample.y) - energy(initial)));
      maxAngularDrift = Math.max(maxAngularDrift, Math.abs(angular(sample.y) - angular(initial)));
    }
    assert.ok(maxStateError < (step === 1 / 512 ? 1e-8 : 1e-5));
    return { step, maxStateError, maxPositionError, maxEnergyDrift, maxAngularDrift };
  });
  return { eccentricity: e, horizon, steps };
});
const binary = validateBundle(JSON.parse(readFileSync('fixtures/m0-binary.json', 'utf8')));
const times = Array.from({ length: 601 }, (_, i) => i / 100);
const branches = ['coast', 'impulse'].map(name => {
  const bundle = structuredClone(binary);
  if (name === 'impulse') {
    bundle.program = structuredClone(impulse); bundle.program.id = 'binary-impulse-v1';
    bundle.program.burns[0].radial = 0.015; bundle.program.burns[0].transverse = -0.01;
  }
  const steps = [1 / 128, 1 / 256, 1 / 512].map(step => {
    const b = structuredClone(bundle); b.scenario.policy.step = step;
    const runner = new Runner(b);
    const samples = times.map(t => {
      const p = runner.advanceTo(t); assert.ok(p.status === 'running' || p.status === 'horizon'); return p.y;
    });
    return { step, samples, ledger: runner.ledger };
  });
  return { name, bundle, steps };
});
const b = fixture(analytic(0, 0.6), 1 / 32); b.program = impulse;
const direct = new Runner(b), partitioned = new Runner(b);
const endpoint = direct.advanceTo(6);
for (const t of [0.137, 0.234, 0.789, 1.137, 2.002, 2.999, 3.14159, 4.567, 5.912]) partitioned.advanceTo(t);
const partitionDifference = error(partitioned.advanceTo(6).y, endpoint.y);
assert.equal(partitionDifference, 0);
const report = { environment: { host: hostname(), node: process.version, cpu: cpus()[0]?.model },
  model: b.scenario.modelVersion, twoBody, canonicalPartitionDifference: partitionDifference,
  fixture: 'fixtures/m0-circular.json', impulseProgram: 'fixtures/m0-impulse.json',
  limitations: 'Short bounded fixtures only; conservative near-surface stop; no refined collision epoch or apsis locator.' };
writeFileSync('docs/evidence/m0-numerics.json', JSON.stringify(report, null, 2) + '\n');
writeFileSync('docs/evidence/m0-oracle-input.json', JSON.stringify({ times, branches }) + '\n');
console.log(JSON.stringify(report, null, 2));
