import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {prepareAtmosphericMission} from '../src/model-set/atmospheric-mission';
import {atmosphericStateAt} from '../src/sim/atmospheric-propulsion';
import {entryStateAt} from '../src/model-set/entry';
import {sampleVessel,stockAt} from '../src/model-set/model';
const definition=JSON.parse(readFileSync('fixtures/model-sets/aster-launch.json','utf8')),cases=[];
for(const step of [1/512,1/1024,1/2048]){
 const d=structuredClone(definition);d.world.policy.step=step;const started=performance.now(),r=prepareAtmosphericMission(d);
 const legs=Object.fromEntries(['stack','boostback','insertion','deorbit'].map(key=>{
  const leg=r[key as 'stack'],start=leg.definition.start,end=leg.definition.end;
  return [key,{start,end,maxima:leg.maxima,samples:Array.from({length:301},(_,i)=>{const t=start+(end-start)*i/300;return {t,z:atmosphericStateAt(leg,t)};})}];
 }));
 const entries=Object.fromEntries(['boosterEntry','payloadEntry'].map(key=>{
  const e=r[key as 'boosterEntry'],offset=key==='boosterEntry'?d.entryStarts.booster:d.entryStarts.payload;
  return [key,{offset,maxima:e.maxima,contact:e.contact,samples:Array.from({length:301},(_,i)=>{const local=(e.contact.t-1e-6)*i/300;return {t:offset+local,z:entryStateAt(e,local)};})}];
 }));
 cases.push({step,elapsedMs:performance.now()-started,work:r.work,capture:r.capture,legs,entries});
 if(step===1/2048){
  const before=JSON.stringify(r.view),clone=structuredClone(r.view),epochs=[.3,.6007,.9,1.111,1.4145470726907767,1.8,3,3.9145470726907767,5.345,8.3322,11.7];
  for(const t of epochs)for(const v of r.view.vessels)if(t>=v.samples[0].t&&t<=v.samples.at(-1)!.t){
   if(JSON.stringify(sampleVessel(v,t))!==JSON.stringify(sampleVessel(clone.vessels.find(c=>c.id===v.id)!,t)))throw new Error('Clone changed view');
  }
  if(before!==JSON.stringify(r.view))throw new Error('Queries mutated view');
  const display=[];
  for(const v of r.view.vessels){
   let position=0,velocity=0;
   for(let i=1;i<3000;i++){
    const t=v.samples[0].t+(v.samples.at(-1)!.t-v.samples[0].t)*i/3000,s=sampleVessel(v,t);
    let expected:number[]|undefined;
    const leg=v.id===d.stack.id?r.stack:v.id===d.booster.id&&t<d.entryStarts.booster?r.boostback:v.id===d.payload.id&&t<d.programs.payload.operations[0].t?r.insertion:v.id===d.payload.id&&t>=d.programs.payload.operations[2].t&&t<d.entryStarts.payload?r.deorbit:undefined;
    if(leg&&t>=leg.definition.start)expected=atmosphericStateAt(leg,t);
    else if(v.entry&&t>=(v.entry.activeFrom??0)&&t<v.entry.recovery.t){const e=v.id===d.booster.id?r.boosterEntry:r.payloadEntry;expected=entryStateAt(e,t-v.entry.activeFrom!);}
    if(expected){position=Math.max(position,Math.hypot(...s.y.slice(0,3).map((x,i)=>x-expected![i])));velocity=Math.max(velocity,Math.hypot(...s.y.slice(3).map((x,i)=>x-expected![i+3])));}
   }
   if(position*1e6>.25)throw new Error('Close-view display error exceeded .25px');
   display.push({id:v.id,maxPositionError:position,maxVelocityError:velocity,pixelsAtMaximumZoom:position*1e6});
  }
  writeFileSync('docs/evidence/atmospheric-mission-display.json',JSON.stringify({work:r.work,recoveries:r.view.recoveries,capture:r.capture,display,finalStocks:stockAt(r.view,12)},null,2)+'\n');
 }
}
writeFileSync('docs/evidence/atmospheric-mission-oracle-input.json',JSON.stringify({definition,cases},null,2)+'\n');
console.log(JSON.stringify(cases.map(c=>({step:c.step,work:c.work,capture:c.capture.deltaV,elapsedMs:c.elapsedMs})),null,2));
