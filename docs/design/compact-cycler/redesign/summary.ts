import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {preparePassThrough} from '../../../../src/cycler/prepare';
import {createPassThroughView,passThroughResources} from '../../../../src/cycler/view';
import {cubicBound} from '../../../../src/sim/cubic';
import {samplePassThrough} from '../../../../src/cycler/query';
import type {PassThroughProfile,PassThroughDefinition} from '../../../../src/cycler/types';
const raw=readFileSync('fixtures/model-sets/pass-through-profile.json','utf8');
const v=JSON.parse(raw) as PassThroughProfile;
const d=JSON.parse(readFileSync('fixtures/model-sets/aster-selene-pass-through.json','utf8')) as PassThroughDefinition;
const p=preparePassThrough(v).template,scene=createPassThroughView(p,d);
const powered=p.phases[1].filter(q=>q.control);
const summary={sha256:createHash('sha256').update(raw).digest('hex'),period:p.period,duration:p.duration,work:p.work,
 carrierDeltaV:p.events.filter(e=>e.actor===0).reduce((n,e)=>n+e.deltaV,0),fuelSpent:p.cost,
 connectionDeltaV:p.events.filter(e=>e.actor===1&&e.kind==='thrust-end'&&e.t>=49&&e.t<=56).reduce((n,e)=>n+e.deltaV,0),
 accelerationEnvelope:Math.max(...powered.map(q=>cubicBound(q.control!))),forceEnvelope:Math.max(...powered.map(q=>cubicBound(q.control!)*(p.hardware[1].dryMass+q.cargo+q.fuel))),
 captures:p.events.filter(e=>e.kind==='dock'||e.kind==='land'),
 finalResources:passThroughResources(p,p.duration),finalShips:[0,1].map(actor=>samplePassThrough({template:p,actor},p.duration)),
 drawingSamples:scene.vessels.reduce((n,v)=>n+v.samples.length,0),replyBytes:new TextEncoder().encode(JSON.stringify(scene)).byteLength};
writeFileSync('docs/evidence/pass-through-numeric.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
