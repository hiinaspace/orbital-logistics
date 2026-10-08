import {readFileSync,writeFileSync} from 'node:fs';
import {hostname} from 'node:os';
import {Runner} from '../src/sim/runner';
import {logisticsResult} from '../src/sim/logistics';
import type {ModelSet} from '../src/model-set/model';
const set: ModelSet = JSON.parse(readFileSync('fixtures/model-sets/orison-freight.json', 'utf8'));
const cases = set.vessels.map(v => {
  const bundle = v.bundle, runner = new Runner(bundle), terminal = runner.advanceTo(64), ledger = runner.ledger;
  const times = [...new Set([0, 64, ...Array.from({length:129}, (_,i) => i/2), ...ledger.flatMap(e => [e.t, Math.min(64, e.t + 1e-8)])])].sort((a,b) => a-b);
  const samples = times.map(t => runner.sample(t));
  return {label: v.name, bundle, steps: [{step: bundle.scenario.policy.step, samples, terminal, ledger,
    result: logisticsResult(bundle.scenario.logistics!, terminal.logistics!, terminal.propellant, terminal.t)}]};
});
writeFileSync('docs/evidence/model-set-oracle-input.json', JSON.stringify({environment: {host: hostname(), node: process.version}, cases}) + '\n');
