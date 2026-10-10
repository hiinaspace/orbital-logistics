import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {prepareEntry,entryStateAt} from '../src/model-set/entry';
import {stateAt,sampleVessel} from '../src/model-set/model';
import {norm,type Vec3} from '../src/sim/vectors';
const original=JSON.parse(readFileSync('fixtures/model-sets/aster-entry.json','utf8'));
const cases=[];
for(const step of [1/512,1/1024,1/2048]){
 const d=structuredClone(original);d.scenario.policy.step=step;
 const start=performance.now(),run=prepareEntry(d),elapsedMs=performance.now()-start;
 const times=[...Array.from({length:601},(_,i)=>run.contact.t*i/600),3.333321,4.100023,4.37500009].filter(t=>t<=run.contact.t);
 cases.push({step,elapsedMs,nodes:run.nodes.length,work:run.work,contact:run.contact,maxima:run.maxima,samples:times.map(t=>({t,z:entryStateAt(run,t,true)}))});
 if(step===1/2048){
  const v=run.view.vessels[0];let error=0;
  for(let i=1;i<=12000;i++){const t=run.contact.t*(i-.37)/12000,y=entryStateAt(run,t).slice(0,3),drawing=stateAt(v,t).slice(0,3);error=Math.max(error,Math.hypot(...y.map((x,j)=>x-drawing[j])));}
  assert.ok(error<2.5e-7,'close display position error at 1e6 pixels/R');
  const report={schemaVersion:1,displayChecks:12000,maxPositionError:error,pixelsAtMaximumZoom:error*1e6,maxZoom:1e6,samples:v.samples.length,packetBytes:Buffer.byteLength(JSON.stringify(run.view)),physicalNodes:run.nodes.length,preparationMs:elapsedMs,work:run.work,fuelUsed:d.scenario.ship.propellant-run.contact.before[6],impactSpeed:run.contact.relativeSpeed,waterEnergy:run.contact.waterEnergy};
  writeFileSync('docs/evidence/entry-display.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }
}
writeFileSync('docs/evidence/entry-oracle-input.json',JSON.stringify({definition:original,tolerances:{state:3e-7,fineState:2e-8,event:1e-7,display:2.5e-7,peak:5e-4},cases},null,2)+'\n');
