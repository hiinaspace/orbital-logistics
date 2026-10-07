import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { EditorSession } from '../src/editor/session';
import { solveRendezvous } from '../src/planning/rendezvous';
import { targetBundle } from '../src/planning/target';
import { Runner } from '../src/sim/runner';
import { validateBundle } from '../src/sim/schema';
const fixture = validateBundle(JSON.parse(readFileSync('fixtures/m2-rendezvous.json', 'utf8')));
const cases = [];
for (const [label, radial, transverse] of [['close', 0, 0.078], ['initial', 0.015, 0.065], ['worse', 0.05, 0.02]] as const) {
  const seed = structuredClone(fixture); Object.assign(seed.program.burns[0], { radial, transverse });
  const result = solveRendezvous(seed, 'departure'); assert.equal(result.status, 'proposed'); if (result.status !== 'proposed') throw new Error(result.reason);
  const proposal = result.proposal, bundle = { scenario: seed.scenario, program: proposal.program };
  const times = [...new Set([seed.scenario.rendezvous!.departureEpoch, seed.scenario.rendezvous!.arrivalEpoch, ...Array.from({length: 81}, (_, i) => seed.scenario.duration * i / 80)])].sort((a, b) => a - b);
  const steps = [1 / 512, 1 / 1024, 1 / 2048].map(step => {
    const refined = structuredClone(bundle); refined.scenario.policy.step = step; refined.scenario.policy.maxNodes = 65536;
    const runner = new Runner(refined), target = new Runner(targetBundle(refined));
    const samples = times.map(t => ({ ...runner.sample(t), target: target.sample(t).y }));
    runner.advanceTo(seed.scenario.duration);
    return { step, samples, terminal: runner.current, ledger: runner.ledger };
  });
  cases.push({ label, seed, result, bundle, steps });
  if (label === 'initial') {
    const editor = new EditorSession(seed); writeFileSync('docs/evidence/m2-before.json', editor.serialize(0.5));
    editor.change(proposal.program); editor.execute(); editor.execution.advanceTo(seed.scenario.duration);
    writeFileSync('docs/evidence/m2-after.json', editor.serialize(seed.scenario.rendezvous!.arrivalEpoch));
  }
}
writeFileSync('docs/evidence/m2-oracle-input.json', JSON.stringify({ environment: { host: hostname(), node: process.version }, cases }) + '\n');
console.log(JSON.stringify(cases.map(c => ({ seed: c.label, iterations: c.result.proposal.iterations, evaluations: c.result.proposal.evaluations,
  initialMiss: c.result.trials[0].error, totalDv: c.result.proposal.totalDv, addedDv: c.result.proposal.addedDv })), null, 2));
