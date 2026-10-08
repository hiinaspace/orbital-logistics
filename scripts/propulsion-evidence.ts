import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {validateBundle} from '../src/sim/schema';
import {fixture} from '../tests/sim/helpers';
import {logisticsResult} from '../src/sim/logistics';
const cases=[];
for(const name of ['orison-powered','selene-powered']) {
 const set=JSON.parse(readFileSync(`fixtures/model-sets/${name}.json`,'utf8'));
 for(const v of set.vessels) {
  const bundle=validateBundle(v.bundle),end=bundle.scenario.epoch+bundle.scenario.duration;
  const steps=[4,2,1].map(factor=>{
   const b=structuredClone(bundle),step=b.scenario.policy.step*=factor;
   b.scenario.logistics!.ports.forEach(p=>{if(p.rail.kind==='ballistic')p.rail.policy.step=step;});
   const r=new Runner(b),terminal=r.advanceTo(end),ledger=r.ledger;
   if(terminal.status!=='horizon')throw new Error(`${v.name} ${step} ${terminal.status}`);
   const safe=structuredClone(b);safe.scenario.bodies.forEach(body=>body.radius+=.03);
   safe.scenario.logistics!.ports.forEach(p=>{if(p.rail.kind==='ballistic')p.rail.minClearance=0;});
   if(new Runner(safe).advanceTo(end).status!=='horizon')throw new Error('Whole-trip clearance certificate failed');
   const times=[...new Set([...Array.from({length:161},(_,i)=>end*i/160),...ledger.map(e=>e.t)])].sort((a,b)=>a-b);
   return {step,clearanceCertified:true,terminal,ledger,boundaries:r.eventBoundaries,samples:times.map(t=>r.sample(t)),
    result:logisticsResult(b.scenario.logistics!,terminal.logistics!,terminal.propellant,end)};
  });
  cases.push({label:v.name,set:name,bundle,steps});
 }
}
const calibrations=['cap','depletion'].map(kind=>{
 const b=fixture([2,0,0,0,.5,.1],1/1024);b.scenario.duration=2;b.scenario.ship.cargoMass=0;
 b.scenario.ship.propellant=kind==='cap'?1:.1;b.scenario.ship.tankCapacity=1;
 b.scenario.ship.engine={maxThrust:1,...(kind==='cap'?{maxAcceleration:.6}:{})};
 b.program.burns=[];b.program.thrustArcs=[{id:kind,start:.123,end:kind==='cap'?1.623:1,direction:[1/3,2/3,2/3],throttle:1}];
 const steps=[4,2,1].map(factor=>{
  const bundle=structuredClone(b);bundle.scenario.policy.step*=factor;const r=new Runner(bundle),terminal=r.advanceTo(2);
  const times=[...new Set([...Array.from({length:81},(_,i)=>Math.min(terminal.t,i/40)),terminal.t,.123,...(kind==='cap'?[1.123,1.623]:[])])].sort((a,b)=>a-b);
  return {step:bundle.scenario.policy.step,terminal,ledger:r.ledger,samples:times.map(t=>r.sample(t))};
 });return {label:kind,bundle:b,steps};
});
writeFileSync('docs/evidence/propulsion-oracle-input.json',JSON.stringify({cases,calibrations})+'\n');
