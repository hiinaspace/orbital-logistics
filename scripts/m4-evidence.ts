import {readFileSync,writeFileSync} from 'node:fs';
import {hostname} from 'node:os';
import {validateBundle} from '../src/sim/schema';
import {Runner} from '../src/sim/runner';
import {logisticsResult} from '../src/sim/logistics';
import {puzzles} from '../src/puzzles/catalog';
const cases=[];
for(const label of ['patient','express','express-deadline','patient-too-late','express-tight'] as const){
  const bundle=validateBundle(JSON.parse(readFileSync('fixtures/m4-'+(label.startsWith('patient')?'patient':'express')+'-solution.json','utf8')));
  if(label==='express-deadline'||label==='patient-too-late')bundle.scenario=structuredClone(puzzles[1].bundle.scenario);
  if(label==='express-tight')bundle.scenario.logistics!.capture={position:1e-8,velocity:1e-8};
  const times=[...new Set([0,24,...bundle.program.burns.map(b=>b.t),...bundle.program.operations!.flatMap(o=>[o.t,o.t+1e-8]),...Array.from({length:241},(_,i)=>i/10)])].sort((a,b)=>a-b);
  const steps=[1,2,4].map(divisor=>{
    const b=structuredClone(bundle);b.scenario.policy.step/=divisor;
    const runner=new Runner(b),samples=times.map(t=>runner.sample(t)),terminal=runner.advanceTo(24);
    return {step:b.scenario.policy.step,samples,terminal,ledger:runner.ledger,result:logisticsResult(b.scenario.logistics!,terminal.logistics!,terminal.propellant,terminal.t)};
  });cases.push({label,bundle,steps});
}
writeFileSync('docs/evidence/m4-oracle-input.json',JSON.stringify({environment:{host:hostname(),node:process.version},cases})+'\n');
