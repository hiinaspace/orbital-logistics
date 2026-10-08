import {readFileSync,writeFileSync} from 'node:fs';
import {prepareSet,sampleVessel,stockAt} from '../src/model-set/model';
import {Runner} from '../src/sim/runner';
import {validateBundle} from '../src/sim/schema';
import {certifiedCoast} from '../src/sim/dynamics';
import {thrustBound} from '../src/sim/propulsion';
const set=JSON.parse(readFileSync('fixtures/model-sets/selene-ascent.json','utf8')),bundle=validateBundle(set.vessels[0].bundle);
const steps=[1/512,1/1024,1/2048].map(step=>{
 const b=structuredClone(bundle);b.scenario.policy.step=step;const r=new Runner(b),terminal=r.advanceTo(6),ledger=r.ledger;
 if(terminal.status!=='horizon')throw new Error(terminal.detail);
 const segments=r.coastSegments(6);let clearanceLowerBound=Infinity;
 for(const seg of segments){if(!certifiedCoast(b.scenario,seg.t0,seg.y0,seg.t1-seg.t0,thrustBound(seg.massLaw)))throw new Error('Uncertified retained interval');clearanceLowerBound=Math.min(clearanceLowerBound,(Math.hypot(...seg.y0.slice(0,3))-1)/2);}
 const times=[...new Set([...Array.from({length:181},(_,i)=>i/30),...ledger.map(e=>e.t),.3000001,.30001,.3001,.301])].sort((a,b)=>a-b);
 return {step,terminal,ledger,samples:times.map(t=>r.sample(t)),nodes:r.retainedNodes,certifiedIntervals:segments.length,clearanceLowerBound};
});
const view=prepareSet(set),v=view.vessels[0],r=new Runner(bundle);r.advanceTo(6);let displayPositionError=0;
for(let i=0;i<v.samples.length-1;i++){const t=(v.samples[i].t+v.samples[i+1].t)/2;if(t<.3 || t>1.721)continue;const drawing=sampleVessel(v,t).y,physical=r.sample(t).y;displayPositionError=Math.max(displayPositionError,Math.hypot(...drawing.slice(0,3).map((x,j)=>x-physical[j])));}
writeFileSync('docs/evidence/surface-oracle-input.json',JSON.stringify({bundle,steps})+'\n');
writeFileSync('docs/evidence/surface-display-report.json',JSON.stringify({displayPositionError,maxZoom:1e6,maxPixelError:displayPositionError*1e6,samples:v.samples.length,initialStocks:stockAt(view,0),finalStocks:stockAt(view,6)},null,2)+'\n');
console.log(steps.map(s=>({step:s.step,nodes:s.nodes,clearance:s.clearanceLowerBound,capture:s.ledger.find(e=>e.id==='arrival')})));
