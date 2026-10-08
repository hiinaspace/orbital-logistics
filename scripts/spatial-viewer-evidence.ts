import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {certifiedCoast} from '../src/sim/dynamics';
import {prepareSet,sampleVessel,type ModelSet} from '../src/model-set/model';
const set=JSON.parse(readFileSync('fixtures/model-sets/crossing-planes.json','utf8')) as ModelSet,view=prepareSet(set);
const cases=set.vessels.map(v=>({label:v.name,bundle:v.bundle,steps:[1/512,1/1024,1/2048].map(step=>{
 const b=structuredClone(v.bundle);b.scenario.policy.step=step;const r=new Runner(b),terminal=r.advanceTo(24);
 if(terminal.status!=='horizon')throw Error(terminal.detail);
 const segments=r.coastSegments(24);if(!segments.every(s=>certifiedCoast(b.scenario,s.t0,s.y0,s.t1-s.t0)))throw Error('Uncertified coast');
 const times=[...new Set([...Array.from({length:241},(_,i)=>i/10),...r.ledger.map(e=>e.t)])].sort((a,b)=>a-b);
 return {step,terminal,ledger:r.ledger,boundaries:r.eventBoundaries,nodes:r.retainedNodes,certifiedIntervals:segments.length,samples:times.map(t=>r.sample(t))};
})}));
let maxInterpolation=0;
for(const v of view.vessels){const r=new Runner(set.vessels.find(x=>x.name===v.name)!.bundle);for(let i=0;i<v.samples.length-1;i++)for(const u of [.25,.5,.75]){const t=v.samples[i].t+u*(v.samples[i+1].t-v.samples[i].t),a=sampleVessel(v,t).y,b=r.sample(t).y;maxInterpolation=Math.max(maxInterpolation,Math.hypot(...a.slice(0,3).map((x,j)=>x-b[j])));}}
if(maxInterpolation*500>.01)throw Error('Fit-scale drawing gate failed');
writeFileSync('docs/evidence/spatial-viewer-oracle-input.json',JSON.stringify({cases})+'\n');
writeFileSync('docs/evidence/spatial-viewer-display.json',JSON.stringify({maxInterpolation,maxPixelsAt500:maxInterpolation*500,samples:view.vessels.map(v=>({id:v.id,count:v.samples.length})),note:'Full 3D position interpolation discrepancy, invariant upper bound on any orthographic projection; not a close-zoom guarantee.'},null,2)+'\n');
