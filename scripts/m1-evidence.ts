import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { EditorSession } from '../src/editor/session';
import { inspectEvents } from '../src/planning/events';
import { bodyState } from '../src/sim/dynamics';
import { Runner } from '../src/sim/runner';
import { validateBundle, type Bundle } from '../src/sim/schema';

const orbit = validateBundle(JSON.parse(readFileSync('fixtures/m1-orbit.json', 'utf8')));
const binary = validateBundle(JSON.parse(readFileSync('fixtures/m0-binary.json', 'utf8')));
function assess(bundle: Bundle) {
  const times = [...new Set([...bundle.program.burns.map(b => b.t), ...Array.from({ length: 81 }, (_, i) => bundle.scenario.duration * i / 80)])].sort((a, b) => a - b);
  const steps = [1 / 512, 1 / 1024, 1 / 2048].map(step => {
    const b = structuredClone(bundle); b.scenario.policy.step = step; b.scenario.policy.maxNodes = 65536;
    const runner = new Runner(b), terminal = runner.sample(b.scenario.duration), samples = [];
    for (const time of times) { const sample = runner.sample(time); samples.push({ t: sample.t, y: sample.y }); if (sample.t !== time) break; }
    const diagnostics = Object.fromEntries(b.scenario.bodies.map(body => [body.id, inspectEvents(b, runner, body.id, b.scenario.duration)]));
    runner.advanceTo(terminal.t);
    return { step, terminal, samples, diagnostics, ledger: runner.ledger };
  });
  assert.ok(steps.every(s => s.terminal.status === steps[0].terminal.status), `Classification changed: ${bundle.scenario.id} ${JSON.stringify(bundle.program)}`);
  const finest = steps[2];
  const convergence = steps.slice(0, 2).map(row => {
    let maxPositionDifference = 0;
    for (const sample of row.samples) {
      const fine = finest.samples.find(p => p.t === sample.t); if (!fine) continue;
      maxPositionDifference = Math.max(maxPositionDifference, Math.hypot(sample.y[0] - fine.y[0], sample.y[1] - fine.y[1]));
    }
    assert.ok(maxPositionDifference < 1e-5, `Position refinement exceeded acceptance: ${maxPositionDifference}`);
    return { step: row.step, maxPositionDifference };
  });
  return { bundle, steps, convergence };
}
const cases = [];
for (const [source, bound] of [[orbit, 0.25], [binary, 0.03]] as const) {
  for (const referenceBodyId of source.scenario.bodies.map(b => b.id)) {
    for (const t of source === orbit ? [0, 1.137, 3.5] : [0, 1.137, 2.3]) {
      for (const radial of [-bound, 0, bound]) for (const transverse of [-bound, 0, bound]) {
        const bundle: Bundle = structuredClone(source);
        bundle.program.burns = [{ id: 'domain-burn', t, referenceBodyId, basis: 'radial-transverse-ccw-v1', radial, transverse }];
        cases.push(assess(bundle));
      }
    }
  }
}
for (const [name, source] of [['orbit', orbit], ['moon', binary]] as const) {
  const editor = new EditorSession(source);
  writeFileSync(`docs/evidence/m1-${name}-before.json`, editor.serialize(0));
  let radial = 0, transverse = 0.1;
  if (name === 'moon') {
    // Retain the planning spike's inertial seed (0.015, -0.01), transformed once
    // into the documented saved basis. This is fixture authoring, not a targeter.
    const y = new Runner(source).sample(1.137).y, b = bodyState(source.scenario.bodies[0], 1.137);
    const dx = y[0] - b[0], dy = y[1] - b[1], r = Math.hypot(dx, dy);
    radial = (0.015 * dx - 0.01 * dy) / r; transverse = (-0.015 * dy - 0.01 * dx) / r;
  }
  const id = editor.addBurn(1.137, 'primary'); editor.updateBurn(id, { radial, transverse }); editor.execute();
  const authored = editor.bundle; authored.scenario.id += '-authored-check';
  cases.push(assess(authored));
  writeFileSync(`docs/evidence/m1-${name}-after.json`, editor.serialize(2.5));
}
writeFileSync('docs/evidence/m1-oracle-input.json', JSON.stringify({ environment: { host: hostname(), node: process.version },
  acceptance: { position: 1e-5, eventTime: 1e-5, relativeVelocity: 1e-5, pixelScale: 5000 }, cases }) + '\n');
console.log(JSON.stringify({ cases: cases.length, classifications: Object.fromEntries(['horizon', 'unsupported-approach'].map(status => [status, cases.filter(c => c.steps[0].terminal.status === status).length])),
  worstRefinementPosition: Math.max(...cases.flatMap(c => c.convergence.map(r => r.maxPositionDifference))) }, null, 2));
