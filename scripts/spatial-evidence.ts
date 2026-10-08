import {writeFileSync,readFileSync} from 'node:fs';
import {hostname} from 'node:os';
import {Runner} from '../src/sim/runner';
import {validateBundle,type Bundle} from '../src/sim/schema';
import {logisticsResult} from '../src/sim/logistics';
import {spatialCases,spatialLogistics} from './spatial-fixtures';
const cases=spatialCases().map(({label,bundle})=>({label,bundle,steps:[1/128,1/256,1/512].map(step=>run(bundle,step))}));
function run(bundle:Bundle,step:number) {
  const b=structuredClone(bundle);b.scenario.policy.step=step;b.scenario.policy.maxNodes=65536;
  const r=new Runner(b),end=b.scenario.epoch+b.scenario.duration,terminal=r.advanceTo(end);
  if(terminal.status!=='horizon')throw new Error(`${b.scenario.id}: ${terminal.status}`);
  const times=[...new Set([...Array.from({length:121},(_,i)=>b.scenario.epoch+b.scenario.duration*i/120),...r.ledger.map(e=>e.t)])].sort((a,b)=>a-b);
  return {step,samples:times.map(t=>r.sample(t)),terminal,ledger:r.ledger,boundaries:r.eventBoundaries,
    ...(terminal.logistics?{result:logisticsResult(b.scenario.logistics!,terminal.logistics,terminal.propellant,terminal.t)}:{})};
}
writeFileSync('docs/evidence/spatial-oracle-input.json',JSON.stringify({environment:{host:hostname(),node:process.version},cases})+'\n');
const bundle=spatialLogistics();
writeFileSync('docs/evidence/spatial-logistics-oracle-input.json',JSON.stringify({cases:[{label:'inclined-paid-round-trip',bundle,steps:[1/512,1/1024,1/2048].map(h=>run(bundle,h))}]})+'\n');
// Summarize compatibility without replacing the immutable v1 reference.
const baseline=JSON.parse(readFileSync('docs/evidence/spatial-planar-baseline.json','utf8'));let maxState=0,maxFuel=0;
for(const c of baseline.cases) {
 const [path,name]=c.label.split(':'),raw=JSON.parse(readFileSync(path,'utf8')),b=validateBundle(name?raw.vessels.find((v:any)=>v.name===name).bundle:raw),r=new Runner(b);
 for(const s of c.samples){const a=r.sample(s.t),old=[s.y[0],s.y[1],0,s.y[2],s.y[3],0];maxState=Math.max(maxState,Math.hypot(...a.y.map((v,i)=>v-old[i])));maxFuel=Math.max(maxFuel,Math.abs(a.propellant-s.propellant));}
}
writeFileSync('docs/evidence/spatial-parity-report.json',JSON.stringify({sourceRevision:baseline.revision,cases:baseline.cases.length,maxState,maxFuel},null,2)+'\n');
