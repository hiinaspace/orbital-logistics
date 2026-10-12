import {readFileSync,writeFileSync} from 'node:fs';
import {preparePassThrough} from '../../../../src/cycler/prepare';
import type {PassThroughProfile} from '../../../../src/cycler/types';
import {STEP} from '../../../../src/compact/physics';
const value=JSON.parse(readFileSync('fixtures/model-sets/pass-through-profile.json','utf8')) as PassThroughProfile;
const result=[];
for(const step of [STEP,STEP/2,STEP/4]){
 const p=preparePassThrough(value,step);
 result.push({step,work:p.template.work,cost:p.template.cost,carrierFinal:p.carrierFinal,captures:p.template.events.filter(e=>e.kind==='land'||e.kind==='dock'),flows:p.template.flows});
 console.log(step,p.template.work,p.template.cost,p.template.events.filter(e=>e.kind==='land').map(e=>[e.t,e.afterFuel]));
}
writeFileSync('docs/design/compact-cycler/redesign/native.json',JSON.stringify(result,null,2)+'\n');
