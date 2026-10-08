import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {validateBundle} from '../src/sim/schema';
import {logisticsResult} from '../src/sim/logistics';
const set=JSON.parse(readFileSync('fixtures/model-sets/selene-freight.json','utf8'));
const cases=set.vessels.map((v:any)=>{
  const bundle=validateBundle(v.bundle);
  const steps=[1/1024,1/2048,1/4096].map(step=>{
    const b=structuredClone(bundle);b.scenario.policy.step=step;
    b.scenario.logistics!.ports.forEach(p=>{if(p.rail.kind==='ballistic')p.rail.policy.step=step;});
    const r=new Runner(b),terminal=r.advanceTo(12),ledger=r.ledger;
    if(terminal.status!=='horizon')throw new Error(`${v.name} ${step} ${terminal.status}`);
    const safe=structuredClone(b);safe.scenario.bodies.forEach(body=>body.radius+=.03);
    safe.scenario.logistics!.ports.forEach(p=>{if(p.rail.kind==='ballistic')p.rail.minClearance=0;});
    if(new Runner(safe).advanceTo(12).status!=='horizon')throw new Error('Whole-trip clearance certificate failed');
    const times=[...new Set([...Array.from({length:121},(_,i)=>i/10),...ledger.map(e=>e.t)])].sort((a,b)=>a-b);
    return {step,clearanceCertified:true,terminal,ledger,boundaries:r.eventBoundaries,samples:times.map(t=>r.sample(t)),
      result:logisticsResult(b.scenario.logistics!,terminal.logistics!,terminal.propellant,12)};
  });
  return {label:v.name,bundle,steps};
});
writeFileSync('docs/evidence/lunar-freight-oracle-input.json',JSON.stringify({cases})+'\n');
