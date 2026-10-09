import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {NetworkEngine} from '../../../src/network/engine';
const through=Number(process.argv[2]??1536),start=performance.now(),engine=new NetworkEngine(JSON.parse(readFileSync('fixtures/traffic/orison-relay-network.json','utf8')));
const baseline=JSON.parse(readFileSync('docs/design/multiship-service/replay-512.json','utf8'));
const plans=baseline.lanes.map((l:any)=>new Map(l.plans.map((p:any)=>[p.id,p])));
const resources=new Map(baseline.resources.map((r:any)=>[r.t,r]));let prefixPlans=0,prefixResources=0;
const rows=[];let after=-1;
for(let target=0;target<=through;target+=8){
 while(engine.advanceTo(target,4096).yielded){}
 const p=engine.delta(after);after=p.frontier;
 assert.ok(Math.abs(p.stats.fuelBalanceError)<1e-10);
 p.lanes.forEach((l,i)=>l.visits.forEach(v=>{if(v.knownAt<=512){assert.deepEqual(v.plan,plans[i].get(v.id));prefixPlans++;}}));
 p.resources.forEach(r=>{if(r.t<=512){assert.deepEqual(r,resources.get(r.t));prefixResources++;}});
 if(target%64===0||engine.halt){const row={target,frontier:p.frontier,seconds:(performance.now()-start)/1000,halt:engine.halt,stats:p.stats};rows.push(row);console.log(JSON.stringify(row));}
 if(engine.halt)break;
}
writeFileSync(process.argv[3]??'docs/design/network-robustness/baseline.json',JSON.stringify({through,prefixPlans,prefixResources,rows},null,2)+'\n');
assert.equal(engine.halt,undefined);
