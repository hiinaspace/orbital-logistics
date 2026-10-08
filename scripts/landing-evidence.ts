import {readFileSync,writeFileSync} from 'node:fs';
import {prepareSet,sampleVessel,stockAt} from '../src/model-set/model';
import {transform} from '../src/model-set/frames';
import {Runner} from '../src/sim/runner';
import {validateBundle} from '../src/sim/schema';
import {certifiedCoast} from '../src/sim/dynamics';
import {thrustBound} from '../src/sim/propulsion';
const set=JSON.parse(readFileSync('fixtures/model-sets/selene-return.json','utf8')),bundle=validateBundle(set.vessels[0].bundle),end=bundle.scenario.duration;
const steps=[1/512,1/1024,1/2048].map(step=>{
 const b=structuredClone(bundle);b.scenario.policy.step=step;const r=new Runner(b),terminal=r.advanceTo(end),ledger=r.ledger;
 if(terminal.status!=='horizon')throw new Error(terminal.detail);
 const segments=r.coastSegments(end);let clearanceLowerBound=Infinity;
 for(const seg of segments){if(!certifiedCoast(b.scenario,seg.t0,seg.y0,seg.t1-seg.t0,thrustBound(seg.massLaw)))throw new Error('Uncertified retained interval');clearanceLowerBound=Math.min(clearanceLowerBound,(Math.hypot(...seg.y0.slice(0,3))-1)/2);}
 const arrival=ledger.find(e=>e.kind==='land')!.t;
 const times=[...new Set([...Array.from({length:331},(_,i)=>end*i/330),...ledger.map(e=>e.t),.3000001,.30001,.301,arrival-1e-7,arrival-1e-5,arrival-1e-3])].sort((a,b)=>a-b);
 return {step,terminal,ledger,samples:times.map(t=>r.sample(t)),boundaries:r.eventBoundaries,nodes:r.retainedNodes,certifiedIntervals:segments.length,clearanceLowerBound};
});
const view=prepareSet(set),v=view.vessels[0],r=new Runner(bundle);r.advanceTo(end);
let positionError=0,pathError=0,checked=0;
const frames=['inertial','Selene','Cairn','Lantern','rotating','swift'];
for(let i=0;i<v.samples.length-1;i++) {
 const a=v.samples[i],b=v.samples[i+1];if(a.logistics?.dockedPortId)continue;
 const left=v.boundaries.find(e=>e.t===b.t)?.before??b;
 for(const u of [.25,.5,.75]) {
  const t=a.t+(b.t-a.t)*u,physical=r.sample(t).y,drawing=sampleVessel(v,t).y;
  positionError=Math.max(positionError,Math.hypot(...drawing.slice(0,3).map((x,j)=>x-physical[j])));checked++;
  for(const frame of frames) {
   const start=transform(view,a.y,a.t,frame),stop=transform(view,left.y,b.t,frame),actual=transform(view,physical,t,frame);
   // Include the sampled reference origin's own error for a ship-follow view.
   if(frame==='swift')actual[0]=actual[1]=actual[2]=0;
   pathError=Math.max(pathError,Math.hypot(...start.slice(0,3).map((x,j)=>x+u*(stop[j]-x)-actual[j])));
  }
 }
}
if(Math.max(positionError,pathError)*1e6>=.25)throw new Error(`Close-view error exceeds .25px: ${positionError}, ${pathError}`);
writeFileSync('docs/evidence/landing-oracle-input.json',JSON.stringify({bundle,steps})+'\n');
writeFileSync('docs/evidence/landing-display-report.json',JSON.stringify({positionError,pathError,maxZoom:1e6,maxPixelError:Math.max(positionError,pathError)*1e6,checked,frames,domain:'Every free-flight sample interval, quarter/mid/three-quarter interior points; exact event-left endpoints.',samples:v.samples.length,initialStocks:stockAt(view,0),finalStocks:stockAt(view,end)},null,2)+'\n');
console.log(steps.map(s=>({step:s.step,nodes:s.nodes,clearance:s.clearanceLowerBound,landing:s.ledger.find(e=>e.kind==='land')})));
