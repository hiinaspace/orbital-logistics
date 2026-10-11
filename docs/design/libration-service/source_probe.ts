import fs from 'node:fs';
import assert from 'node:assert/strict';
import {prepareCourier} from '../../../src/libration/prepare';
import {courierSample} from '../../../src/libration/query';
import {sampleVessel} from '../../../src/model-set/model';
const d=JSON.parse(fs.readFileSync('fixtures/model-sets/aster-selene-beacon.json','utf8'));
const p=prepareCourier(d.source.source.source.scenario,d.station,d.courier);
let assertions=0,maxDisplayError=0;
for(const k of [0,1,17,31000])for(const local of [d.courier.launch,d.courier.arrival,d.courier.unload,d.courier.departure,d.courier.landing,d.courier.refill]){
 const t=k*d.courier.period+local;
 const actual=courierSample(p.schedule,p.template,t,p.sample);
 const before=courierSample(p.schedule,p.template,t,p.sample,true);
 const view={...p.template,libration:{...p.schedule,template:p.template},samples:[{...p.template.samples[0],t:k*d.courier.period},{...p.template.samples.at(-1)!,t:(k+1)*d.courier.period}]};
 const display=sampleVessel(view,t);
 maxDisplayError=Math.max(maxDisplayError,...actual.y.map((v,i)=>Math.abs(v-display.y[i])));
 assert.equal(actual.logistics!.cargoMass,display.logistics!.cargoMass);assertions++;
 assert.equal(actual.logistics!.dockedPortId,display.logistics!.dockedPortId);assertions++;
 assert.equal(actual.propellant,display.propellant);assertions++;
 if(local===d.courier.refill){assert.equal(before.logistics!.cargoMass,0);assert.equal(actual.logistics!.cargoMass,.15);assertions+=2;}
}
console.log(JSON.stringify({assertions,maxDisplayError,physicalNodes:p.work.nodes,physicalBytes:p.work.physicsBytes,stationCapture:p.capture,surfaceCapture:p.landing},null,2));
