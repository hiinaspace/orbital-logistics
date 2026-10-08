import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {validateBundle,type Bundle} from '../src/sim/schema';
import {distance,relativeSpeed} from '../src/sim/vectors';
const input=JSON.parse(readFileSync('docs/design/lunar-freight/input.json','utf8'));
const search=JSON.parse(readFileSync('docs/design/lunar-freight/shooting-report.json','utf8'));
const rows:any[]=[],cases:any[]=[];
for(const [index,candidate] of search.solutions.entries()) {
  const bundle=validateBundle(candidate.bundle),arrival=bundle.program.burns[1].t;
  const steps=[1/1024,1/2048,1/4096].map(step=>{
    const b=structuredClone(bundle),target=validateBundle(input.target);b.scenario.policy.step=step;target.scenario.policy.step=step;
    const visitor=new Runner(b),station=new Runner(target),terminal=visitor.advanceTo(12);
    if(terminal.status!=='horizon' || station.advanceTo(12).status!=='horizon')throw new Error('Lunar coast unresolved');
    // Re-run with enlarged surfaces: canonical certificates prove the declared
    // clearance margin, not just sampled minima from the independent search.
    for(const test of [b,target]) {
      const clear=structuredClone(test);clear.scenario.bodies.forEach(body=>body.radius+=input.minClearance);
      if(new Runner(clear).advanceTo(12).status!=='horizon')throw new Error('Declared clearance unresolved');
    }
    const matched=visitor.sample(arrival),other=station.sample(arrival),later=visitor.sample(arrival+.75),targetLater=station.sample(arrival+.75);
    if(distance(matched.y,other.y)>1e-8 || relativeSpeed(matched.y,other.y)>1e-8 || distance(later.y,targetLater.y)>1e-7)throw new Error('Capture or dwell unresolved');
    rows.push({candidate:index,step,phase:candidate.summary.phase,duration:candidate.summary.duration,
      position:distance(matched.y,other.y),velocity:relativeSpeed(matched.y,other.y),postArrival:distance(later.y,targetLater.y),fuel:terminal.propellant});
    return {step,terminal,ledger:visitor.ledger,boundaries:visitor.eventBoundaries,
      samples:[...new Set([...Array.from({length:121},(_,i)=>i/10),...bundle.program.burns.map(b=>b.t)])].sort((a,b)=>a-b).map(t=>visitor.sample(t))};
  });
  cases.push({label:`visitor-${index}`,bundle,steps});
}
const target=validateBundle(input.target),r=new Runner(target);r.advanceTo(12);
cases.push({label:'DRO-target',bundle:target,steps:[{step:target.scenario.policy.step,terminal:r.current,ledger:r.ledger,boundaries:r.eventBoundaries,samples:Array.from({length:121},(_,i)=>r.sample(i/10))}]});
writeFileSync('docs/evidence/lunar-rendezvous-oracle-input.json',JSON.stringify({cases})+'\n');
writeFileSync('docs/evidence/lunar-rendezvous-canonical-report.json',JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows,null,2));
