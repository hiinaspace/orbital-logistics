import { readFileSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { Runner } from '../src/sim/runner';
import { validateBundle } from '../src/sim/schema';
import { logisticsResult } from '../src/sim/logistics';
const fixture = validateBundle(JSON.parse(readFileSync('fixtures/m3-round-trip.json','utf8')));
const cases = [];
for (const label of ['round-trip', 'missed-capture', 'early-undock', 'empty-source', 'tight-capture'] as const) {
  const bundle = structuredClone(fixture);
  if (label === 'missed-capture') bundle.program.operations!.find(o=>o.id==='dock-depot')!.t -= 0.1;
  if (label === 'early-undock') bundle.program.operations!.find(o=>o.id==='leave-home')!.t = 0.1;
  if (label === 'empty-source') bundle.scenario.logistics!.ports[0].cargo = 0.1;
  if (label === 'tight-capture') bundle.scenario.logistics!.capture = {position: 1e-8, velocity: 1e-8};
  const times = [...new Set([0,24,...bundle.program.burns.map(b=>b.t),...bundle.program.operations!.flatMap(o=>[o.t,o.t+1e-8]),...Array.from({length:241},(_,i)=>i/10)])].sort((a,b)=>a-b);
  const steps = [1,2,4].map(divisor=>{
    const b = structuredClone(bundle); b.scenario.policy.step /= divisor;
    const runner = new Runner(b), samples = times.map(t=>runner.sample(t));
    const terminal = runner.advanceTo(24);
    return {step:b.scenario.policy.step,samples,terminal,ledger:runner.ledger,result:logisticsResult(b.scenario.logistics!,terminal.logistics!,terminal.propellant)};
  });
  cases.push({label,bundle,steps});
}
writeFileSync('docs/evidence/m3-oracle-input.json',JSON.stringify({environment:{host:hostname(),node:process.version},cases})+'\n');
writeFileSync('docs/evidence/m3-before.json',readFileSync('fixtures/m3-delivery.json'));
const runner=new Runner(fixture);runner.advanceTo(24);writeFileSync('docs/evidence/m3-after.json',runner.serialize());
