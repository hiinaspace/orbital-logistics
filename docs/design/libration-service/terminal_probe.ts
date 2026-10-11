import fs from 'node:fs';
import assert from 'node:assert/strict';
import {prepareCourier} from '../../../src/libration/prepare';
import {courierLastCycle,courierSample,sampleLibration} from '../../../src/libration/query';
const d=JSON.parse(fs.readFileSync('fixtures/model-sets/aster-selene-beacon.json','utf8'));
const p=prepareCourier(d.source.source.source.scenario,d.station,d.courier),s=p.schedule;
let assertions=0,sampleCount=0;
for(const frontier of [999967,999968,999969,999999,1_000_000]){
 const oldest=frontier-128,end=Math.min(s.maxEpoch,frontier+32);
 const first=Math.floor(oldest/s.period),last=courierLastCycle(s,end);
 assert.equal(last,31249);assertions++;
 const rows=[];
 for(let k=first;k<=last;k++){
  const samples=p.template.samples.map(q=>courierSample(s,p.template,k*s.period+q.t,p.sample));
  assert.equal(samples[0].t,k*s.period);assert.equal(samples.at(-1)!.t,(k+1)*s.period);assertions+=2;
  rows.push(...samples);sampleCount+=samples.length;
 }
 const samples=rows.filter(q=>q.t>=oldest&&q.t<=end);
 const view={...p.template,libration:{...s,template:p.template},samples};
 if(samples.at(-1)!.t!==end)samples.push(courierSample(s,p.template,end,p.sample));
 const q=sampleLibration(view,end);
 assert.equal(q.t,end);assert.equal(q.logistics!.dockedPortId,d.courier.pad.id);assertions+=2;
}
const before=courierSample(s,p.template,s.maxEpoch,p.sample,true),after=courierSample(s,p.template,s.maxEpoch,p.sample);
assert.equal(before.propellant,after.propellant);assert.equal(before.logistics!.cargoMass,after.logistics!.cargoMass);assert.equal(before.fuelUsed,after.fuelUsed);assertions+=3;
const seamError=Math.max(...before.y.map((v,i)=>Math.abs(v-after.y[i])));
assert.ok(seamError<1e-9);assertions++;
assert.throws(()=>courierSample(s,p.template,s.maxEpoch+1,p.sample),/outside calendar/);assertions++;
console.log(JSON.stringify({assertions,sampleCount,terminalIndex:courierLastCycle(s,s.maxEpoch),seamError,finalFuel:after.propellant,finalCargo:after.logistics!.cargoMass,finalUsed:after.fuelUsed}));
