import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {certifiedCoast} from '../src/sim/dynamics';
import {massLaw} from '../src/sim/propulsion';
import {prepareSet,sampleVessel,type ModelSet} from '../src/model-set/model';
const set=JSON.parse(readFileSync('fixtures/model-sets/orison-steered.json','utf8')) as ModelSet,bundle=set.vessels[0].bundle;
const steps=[1/32,1/64,1/128,1/256,1/512,1/1024,1/2048].map(step=>{
 const b=structuredClone(bundle);b.scenario.policy.step=step;const r=new Runner(b),terminal=r.advanceTo(24);
 if(terminal.status!=='horizon')throw Error(terminal.detail);
 const safe=structuredClone(b);safe.scenario.bodies[0].radius+=.5;
 if(new Runner(safe).advanceTo(24).status!=='horizon')throw Error('Expanded surface safety failed');
 const segments=r.coastSegments(24);if(!segments.every(s=>certifiedCoast(b.scenario,s.t0,s.y0,s.t1-s.t0,s.massLaw?(1+2e-12)*.14:0)))throw Error('Uncertified powered interval');
 const keys=b.program.thrustArcs!.flatMap(a=>a.steering!.keys.map(k=>a.start+k.offset)),caps=b.program.thrustArcs!.flatMap(a=>{const s=r.sample(a.start),cap=massLaw(b.scenario.ship.engine!,a,b.scenario.ship.dryMass+s.logistics!.cargoMass,s.propellant,b.scenario.ship.exhaustVelocity).capEpoch;return cap!==undefined&&cap>a.start&&cap<a.end?[cap]:[];});
 const times=[...new Set([...Array.from({length:241},(_,i)=>i/10),...r.ledger.map(e=>e.t),...keys,...caps])].sort((a,b)=>a-b);
 return {step,terminal,ledger:r.ledger,boundaries:r.eventBoundaries,nodes:r.retainedNodes,certifiedIntervals:segments.length,keys,caps,samples:times.map(t=>r.sample(t))};
});
writeFileSync('docs/evidence/steering-oracle-input.json',JSON.stringify({bundle,steps})+'\n');
const view=prepareSet(set),v=view.vessels[0],r=new Runner(bundle);let maxInterpolation=0,maxHeading=0;
for(let i=0;i<v.samples.length-1;i++)for(const u of [.25,.5,.75]){const t=v.samples[i].t+u*(v.samples[i+1].t-v.samples[i].t),a=sampleVessel(v,t),b=r.sample(t);maxInterpolation=Math.max(maxInterpolation,Math.hypot(...a.y.slice(0,3).map((x,j)=>x-b.y[j])));if(a.thrust&&b.thrust)maxHeading=Math.max(maxHeading,Math.hypot(...a.thrust.direction.map((x,j)=>x-b.thrust!.direction[j])));}
if(maxInterpolation*500>.01 || maxHeading>1e-12)throw Error('Steered drawing gate failed');
writeFileSync('docs/evidence/steering-display.json',JSON.stringify({maxInterpolation,maxPixelsAt500:maxInterpolation*500,maxHeading,samples:v.samples.length,note:'Full3D norm bounds orthographic position error; drawing direction uses the physical steering law at cursor time.'},null,2)+'\n');
