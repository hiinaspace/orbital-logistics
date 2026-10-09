import {readFileSync,writeFileSync} from 'node:fs';
import {prepareStaged,stagedAccounts,type StagedFlight} from '../src/model-set/staging';
import {sampleVessel} from '../src/model-set/model';
import {certifiedCoast} from '../src/sim/dynamics';
import {thrustBound} from '../src/sim/propulsion';
const definition=JSON.parse(readFileSync('fixtures/model-sets/selene-staging.json','utf8')) as StagedFlight;
const steps=[1/512,1/1024,1/2048].map(step=>{
 const d=structuredClone(definition);d.world.policy.step=step;const m=prepareStaged(d),end=d.world.duration;
 const segments=[m.stack,m.booster,m.payload].map((r,index)=>{
  const through=index===0?d.separation.t:end,bundle=r.bundle,ledger=r.ledger,s=bundle.scenario;
  const times=[...new Set([s.epoch,through,...Array.from({length:129},(_,i)=>s.epoch+(through-s.epoch)*i/128),...ledger.map(e=>e.t)])].filter(t=>t<=through).sort((a,b)=>a-b);
  const intervals=r.coastSegments(through);let clearanceLowerBound=Infinity;
  for(const interval of intervals){if(!certifiedCoast(s,interval.t0,interval.y0,interval.t1-interval.t0,thrustBound(interval.massLaw)))throw Error('Uncertified physical interval');clearanceLowerBound=Math.min(clearanceLowerBound,(Math.hypot(...interval.y0.slice(0,3))-1)/2);}
  return {bundle,samples:times.map(t=>r.sample(t)),ledger,nodes:r.retainedNodes,certifiedIntervals:intervals.length,clearanceLowerBound};
 });
 return {step,separation:m.separation,segments,accounts:[0,.3,d.separation.t-1e-8,d.separation.t,d.separation.t+1e-8,1,2,3,4].map(t=>({t,...stagedAccounts(m,t)}))};
});
const m=prepareStaged(definition);let maxPositionError=0,checked=0;
for(const [i,v] of m.view.vessels.entries()){
 const r=[m.stack,m.booster,m.payload][i],edges=new Set(v.boundaries.map(e=>e.t));
 for(let j=0;j<v.samples.length-1;j++){
  const a=v.samples[j],b=v.samples[j+1];if(a.logistics?.dockedPortId)continue;
  for(const u of [.25,.5,.75]){const t=a.t+u*(b.t-a.t),y=r.sample(t).y,draw=sampleVessel(v,t).y;maxPositionError=Math.max(maxPositionError,Math.hypot(...draw.slice(0,3).map((x,k)=>x-y[k])));checked++;}
  if(edges.has(b.t))sampleVessel(v,b.t);
 }
}
if(maxPositionError*1e6>=.25)throw Error(`Close-view interpolation ${maxPositionError*1e6}px`);
writeFileSync('docs/evidence/staging-oracle-input.json',JSON.stringify({definition,steps})+'\n');
writeFileSync('docs/evidence/staging-display-report.json',JSON.stringify({maxPositionError,pixelsAtMaximumZoom:maxPositionError*1e6,checked,samples:m.view.vessels.map(v=>({id:v.id,count:v.samples.length})),packetBytes:new TextEncoder().encode(JSON.stringify(m.view)).byteLength},null,2)+'\n');
console.log({maxPositionError,checked,steps:steps.map(s=>({step:s.step,nodes:s.segments.map(p=>p.nodes),captures:s.segments.flatMap(p=>p.ledger.filter(e=>e.kind==='land'||e.kind==='dock'))}))});
