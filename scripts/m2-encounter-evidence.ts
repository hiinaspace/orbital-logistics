import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { discoverEncounters, proposeEncounter } from '../src/planning/encounters';
import { solveRendezvous } from '../src/planning/rendezvous';
import { targetBundle } from '../src/planning/target';
import { Runner } from '../src/sim/runner';
import { validateBundle } from '../src/sim/schema';
const fixture = validateBundle(JSON.parse(readFileSync('fixtures/m2-rendezvous.json', 'utf8')));
const cases = [];
for (const label of ['manual-intercept', 'phase-offset-match', 'moved-departure'] as const) {
  const seed = structuredClone(fixture);
  Object.assign(seed.program.burns[0], { radial: 0, transverse: label === 'phase-offset-match' ? 0.1 : Math.sqrt(7 / 6) - 1 });
  if (label === 'moved-departure') seed.program.burns[0].t = 0.8;
  const events = discoverEncounters(seed);
  const result = label === 'moved-departure' ? solveRendezvous(seed, 'departure') : proposeEncounter(seed, events[0].id);
  assert.equal(result.status, 'proposed'); if (result.status !== 'proposed') throw new Error(result.reason);
  const bundle = {scenario: seed.scenario, program: result.proposal.program};
  const times = [...new Set([result.proposal.arrival.t, result.proposal.arrival.assist!.targetEpoch, ...Array.from({length: 81}, (_, i) => seed.scenario.duration * i / 80)])].sort((a,b) => a-b);
  const steps = [1,2,4].map(divisor => {
    const fine = structuredClone(bundle); fine.scenario.policy.step /= divisor; fine.scenario.policy.maxNodes = 65536;
    const runner = new Runner(fine), target = new Runner(targetBundle(fine));
    const samples = times.map(t => ({...runner.sample(t), target: target.sample(t).y}));
    return {step: fine.scenario.policy.step, samples, terminal: runner.advanceTo(seed.scenario.duration), ledger: runner.ledger};
  });
  cases.push({label, seed, events, result, bundle, steps});
}
writeFileSync('docs/evidence/m2-encounter-oracle-input.json', JSON.stringify({environment: {host: hostname(), node: process.version}, cases})+'\n');
