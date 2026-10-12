import legacy from '../fixtures/compact-cycler-v1.json';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import profile from '../../fixtures/model-sets/compact-cycler-profile.json';
import fixture from '../../fixtures/model-sets/aster-selene-cycler-service.json';
import {prepareCompact} from '../../src/compact/prepare';
import {CompactEngine} from '../../src/compact/engine';
import {CompactViewStore} from '../../src/compact/store';
import {ownSample,sampleCompact,rotateState,rotate} from '../../src/compact/query';
import {resourcesAt} from '../../src/compact/view';
import {integrate,STEP} from '../../src/compact/physics';
import type {CompactProfile,CompactDefinition} from '../../src/compact/types';
const source=profile as CompactProfile,d=fixture as CompactDefinition;
const prepared=prepareCompact(source),p=prepared.template;
test('native full coupled cycle agrees with independent DOP853, converges and closes with paid resources',()=>{
 let worst=0;for(const step of [STEP/2,STEP/4]){const fine=prepareCompact(source,step);for(let k=0;k<prepared.traces.length;k++){const a=prepared.traces[k].rows.at(-1)!,b=fine.traces[k].rows.at(-1)!;worst=Math.max(worst,...a.slice(1).map((x,i)=>Math.abs(x-b[i+1])));}assert.deepEqual(fine.template.events.map(e=>[e.t,e.kind]),p.events.map(e=>[e.t,e.kind]));}
 assert.ok(worst<1e-8);assert.ok(p.work.oraclePosition<1e-8&&p.work.oracleVelocity<1e-8);assert.ok(p.events.filter(e=>e.kind==='land'||e.kind==='dock').every(e=>e.deltaV>0&&e.positionError!<1e-7));
 for(let t=0;t<=2*p.period;t+=.125){const s=[0,1].map(actor=>sampleCompact({template:p,actor,oldest:0,end:2*p.period,maxEpoch:2*p.period},t)),r=resourcesAt(p,t);assert.ok(Math.abs(9+r.fuelImported-s.reduce((n,q)=>n+q.propellant+q.fuelUsed!,0))<1e-9);assert.ok(Math.abs(.15+r.cargoImported-r.cargoExported-s.reduce((n,q)=>n+q.logistics!.cargoMass,0))<1e-12);}
 for(const actor of [0,1])for(const t of [0,...Object.values(source.times),p.period]){const a=ownSample(p,actor,t),b=sampleCompact({template:p,actor,oldest:0,end:2*p.period,maxEpoch:2*p.period},t+p.period);assert.ok(Math.max(...rotateState(a.y,p.rate*p.period).map((x,i)=>Math.abs(x-b.y[i])))<1e-12);assert.equal(a.propellant,b.propellant);}
 assert.equal(ownSample(p,0,source.times.boardIn+1).mass,ownSample(p,0,source.times.boardIn+1).propellant+4);const ride=sampleCompact({template:p,actor:0,oldest:0,end:p.period,maxEpoch:p.period},source.times.boardIn+1);assert.equal(ride.mass!,ownSample(p,0,source.times.boardIn+1).mass!+ownSample(p,1,source.times.boardIn+1).mass!);
 console.log('compact convergence',JSON.stringify({worst,work:p.work,fuelPerCycle:p.cost}));
});
test('rotated controls propagate at a late absolute epoch without phase accumulation',()=>{
 const index=Math.floor(999900/p.period),offset=index*p.period,angle=p.rate*offset%(2*Math.PI);let worst=0;
 for(const s of prepared.source.segments){const c=s.control?structuredClone(s.control):undefined;if(c){c.start+=offset;c.end+=offset;c.keys=c.keys.map(k=>[k[0]+offset,...rotate(k.slice(1),angle)]);c.coefficients=c.coefficients.map(q=>q.map(v=>rotate(v,angle)));}
  const trace=prepared.traces.find(q=>q.start===s.start&&q.end===s.end)!,initial=rotateState(trace.initial,angle),late=integrate(s.start+offset,s.end+offset,initial,c,STEP,c?3:0),expected=rotateState(trace.rows.at(-1)!.slice(1,7),angle);worst=Math.max(worst,...late.rows.at(-1)!.slice(1,7).map((x,i)=>Math.abs(x-expected[i])));}
 assert.ok(worst<1e-8);console.log('compact late absolute epoch residual',worst);
});
test('bounded continuous publication, resource counts, held scrubbing and faults',()=>{
 const e=new CompactEngine(d,source),s=new CompactViewStore(d);e.advanceTo(32);s.ingest(e.delta());let maxBytes=0;
 for(let t=40;t<=2048;t+=8){e.advanceTo(t);const packet=e.delta();s.ingest(packet);maxBytes=Math.max(maxBytes,packet.stats.packetBytes);assert.ok(packet.stats.retainedCycles<=5&&packet.stats.retainedDrawingSamples<40000);assert.ok(Math.abs(packet.resources.at(-1)!.cargoExported-.15*packet.stats.deliveries)<1e-12);const scene=s.view(t);assert.equal(scene.vessels.length,2);assert.ok(scene.window.end-scene.window.start<=128);}
 const oldest=s.oldest,held=s.view(oldest).vessels.map(v=>sampleCompact(v.compact!,oldest));e.advanceTo(2049);s.ingest(e.delta(),true);assert.deepEqual(s.view(oldest).vessels.map(v=>sampleCompact(v.compact!,oldest)),held);s.release();assert.throws(()=>s.view(oldest),/history/);
 const prior=s.frontier,bad=structuredClone(e.delta());bad.frontier=2050;bad.cycles=[{...bad.cycles[0],index:-1}];assert.throws(()=>s.ingest(bad),/cycle/);assert.equal(s.frontier,prior);
 for(const faults of [{importCap:0},{rejectCaptureAt:source.times.moonLand}]){const x=new CompactEngine(d,source,faults),store=new CompactViewStore(d);x.advanceTo(32);store.ingest(x.delta());for(let t=40;t<=source.period&&!x.halt;t+=8){x.advanceTo(t);store.ingest(x.delta());}assert.ok(x.halt);const scene=store.view(x.frontier);assert.equal(scene.window.end,x.frontier);assert.ok(scene.vessels.flatMap(v=>v.ledger).every(op=>op.t<=x.frontier));assert.throws(()=>sampleCompact(scene.vessels[1].compact!,x.frontier+1),/retained/);}
 const f=new CompactEngine(d,source,{packetLimit:16_000_000});f.advanceTo(32);const first=f.delta();f.faults.packetLimit=1;assert.throws(()=>f.advanceTo(33),/packet budget/);assert.equal(f.frontier,32);assert.deepEqual(f.delta(),first);assert.throws(()=>f.advanceTo(34),/permanently/);
 console.log('compact rollout max packet bytes',maxBytes);
});
test('known bad controls, funding and model identities cannot enter the cache',()=>{
 for(const mutate of [(v:CompactProfile)=>v.rate=.03,(v:CompactProfile)=>v.exhaustVelocity=2,(v:CompactProfile)=>v.segments[0].control!.coefficients[0][0][0]=20,(v:CompactProfile)=>v.segments[3].oracle[0][1]+=1]){const bad=structuredClone(source);mutate(bad);assert.throws(()=>prepareCompact(bad));}
});

test('a held reply crossing a cycle boundary retains the future row needed by Live',()=>{
 const e=new CompactEngine(d,source),s=new CompactViewStore(d);e.advanceTo(32);s.ingest(e.delta());const edge=2*p.period-32-1;for(let t=40;t<edge;t+=8){e.advanceTo(t);s.ingest(e.delta());}e.advanceTo(edge);s.ingest(e.delta());const held=s.view(30).vessels.map(v=>sampleCompact(v.compact!,30));e.advanceTo(edge+1);s.ingest(e.delta(),true);assert.deepEqual(s.view(30).vessels.map(v=>sampleCompact(v.compact!,30)),held);s.release();assert.doesNotThrow(()=>s.view(edge+1));e.advanceTo(edge+2);s.ingest(e.delta());assert.doesNotThrow(()=>s.view(edge+2));
});

test('fractional worker replies retain event resource anchors rather than every reply clock',()=>{
 const e=new CompactEngine(d,source),s=new CompactViewStore(d);e.advanceTo(32);s.ingest(e.delta());for(let i=1;i<=512;i++){e.advanceTo(32+i/128);s.ingest(e.delta());assert.ok(s.view(32).traffic!.resources.length<=32);}
});

test('local connections retain literal zero-thrust coasts and most travel time aboard the carrier',()=>{
 assert.equal(source.modelVersion,'compact-cycler-profile-v2');assert.equal(p.hardware[0].name,'Wayfarer');assert.equal(p.exhaustVelocity,4);
 assert.ok((source.times.coastEnd-source.times.coastStart)/p.period>.85);const rides=p.phases[1].filter(s=>s.kind==='ride').reduce((n,s)=>n+s.end-s.start,0);assert.ok(rides>p.period/2);
 const coasts=p.phases[1].filter(s=>s.kind==='flight'&&!s.control);assert.equal(coasts.length,4);for(const c of coasts){const a=ownSample(p,1,c.start+.1),b=ownSample(p,1,c.end-.1);assert.equal(a.thrust,undefined);assert.equal(a.fuelUsed,b.fuelUsed);assert.ok(Math.hypot(...a.y.slice(0,3).map((x,i)=>x-b.y[i]))>.1);}
 const bad=structuredClone(source),mid=bad.routes![3][1];bad.segments[mid].control=bad.segments[bad.routes![3][0]].control;assert.throws(()=>prepareCompact(bad),/local connection coast/);
});

test('legacy v1 retains the exact singleton, control and zero-phase protocol',()=>{
 const old=legacy as CompactProfile;assert.doesNotThrow(()=>prepareCompact(old));for(const mutate of [(v:CompactProfile)=>v.segments.splice(1,0,structuredClone(v.segments[1])),(v:CompactProfile)=>v.padPhases={Cairn:.1,Haven:0},(v:CompactProfile)=>delete v.segments[0].control]){const bad=structuredClone(old);mutate(bad);assert.throws(()=>prepareCompact(bad),/legacy profile extensions/);}
});
test('directional handoffs remain inside the declared Aster and Selene encounter regions',()=>{
 const y=(t:number)=>ownSample(p,0,t).y,moon=(t:number)=>[5*Math.cos(p.rate*t),5*Math.sin(p.rate*t),0];
 const geometry={asterRelease:Math.hypot(...y(source.times.releaseIn).slice(0,3)),asterBoard:Math.hypot(...y(source.times.boardOut).slice(0,3)),moonBoard:Math.hypot(...y(source.times.boardIn).slice(0,3).map((x,i)=>x-moon(source.times.boardIn)[i])),moonRelease:Math.hypot(...y(source.times.releaseOut).slice(0,3).map((x,i)=>x-moon(source.times.releaseOut)[i]))};
 assert.ok(geometry.asterRelease<3.1&&geometry.asterBoard<3.3&&geometry.moonBoard<1.3&&geometry.moonRelease<2.5);
 assert.ok(source.times.boardIn-source.times.moonLaunch+source.times.asterLand-source.times.releaseIn<source.times.releaseIn-source.times.boardIn);
 console.log('compact directional geometry',JSON.stringify(geometry));
});
