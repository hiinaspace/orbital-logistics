import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/model-sets/aster-selene-system.json';
import {AsterSystemEngine,type AsterSystemDefinition,type AsterSystemDelta} from '../../src/aster-system/engine';
import {AsterSystemViewStore} from '../../src/aster-system/view';
import {sampleVessel,stateAt,stockAt} from '../../src/model-set/model';
import {Runner} from '../../src/sim/runner';
import {StagedServiceEngine} from '../../src/staged-service/engine';
import {CourierService} from '../../src/libration/service';
import {OrbiterStream} from '../../src/expedition/orbiter';
import {planMarkers} from '../../src/view/plan-markers';
const d=fixture as AsterSystemDefinition;
test('full service preserves shared resources, stage ownership, bounded rollouts and held history',()=>{
 const e=new AsterSystemEngine(d),s=new AsterSystemViewStore(d);e.advanceTo(32);let p=e.delta();s.ingest(p);const initialPacket=p;
 const initial=Object.values(d.source.source.hardware).reduce((n,h)=>n+h.propellant,0)+d.courier.ship.propellant;
 let maxBytes=0,maxNodes=0,maxPacket=0;
 for(let t=32;t<=1024;t+=8){
  if(t>32){e.advanceTo(t);p=e.delta();s.ingest(p);}
  const resources=p.resources.at(-1)!,a=e.staged.accounts(t),q=e.courier.sample(t);
  assert.ok(Math.abs(initial+resources.fuelImported-a.remainingFuel-a.consumedFuel-q.propellant-q.fuelUsed!)<2e-9);
  assert.ok(Math.abs(.15+resources.cargoImported-resources.cargoExported-q.logistics!.cargoMass)<2e-12);
  assert.equal(p.stats.orbiterFaults,0);
  const scene=s.view(t);assert.equal(scene.vessels.length,7);assert.equal(scene.stations.length,4);assert.ok(stockAt(scene,t).every(r=>r.occupied<=1));
  assert.deepEqual(sampleVessel(scene.vessels.find(v=>v.id==='Kestrel')!,t),q);
  for(const o of e.orbiters){const actual=o.sample(t).y,display=stateAt(scene.vessels.find(v=>v.id===o.definition.id)!,t);assert.ok(Math.max(...actual.map((x,i)=>Math.abs(x-display[i])))<1e-12);}
  maxBytes=Math.max(maxBytes,p.stats.physicsBytes);maxNodes=Math.max(maxNodes,p.stats.physicalNodes);maxPacket=Math.max(maxPacket,p.stats.packetBytes);
 }
 assert.ok(maxBytes<70_000_000&&maxNodes<200000&&maxPacket<64_000_000);
 // A fresh frontend at a three-cycle cold start counts template + every row.
 const coldStage=new StagedServiceEngine(d.source,()=>e.staged.prepared),coldCourier=new CourierService(e.courier.scenario,d.station,d.courier);
 coldStage.advanceTo(205);const coldBase=coldStage.delta();for(let t=0;t<=200;t+=8)coldCourier.advanceTo(t,Math.max(0,t-128));coldCourier.advanceTo(205,77);
 const cd=coldCourier.drawing(77,205),coldOrbiters=d.orbiters.map(def=>{const o=new OrbiterStream(e.courier.scenario,def,1.2);for(let t=8;t<=200;t+=8){o.extend(t+32);o.delta(t-8,Math.max(0,t-128),t);}o.extend(237);const row=o.delta(77,77,205);return {...row,id:def.id,bytes:new TextEncoder().encode(JSON.stringify(row)).byteLength};});
 const cold={domain:'aster-system-v1' as const,frontier:205,oldest:77,base:coldBase,courier:{template:coldCourier.courier.template,schedule:coldCourier.courier.schedule,cycles:cd.cycles,current:coldCourier.sample(205)},orbiters:coldOrbiters,resources:coldCourier.resources(coldBase.resources,77,205),stats:{...p.stats,packetBytes:0}};
 cold.stats.packetBytes=new TextEncoder().encode(JSON.stringify(cold)).byteLength;assert.ok(cold.stats.packetBytes<64_000_000);assert.equal(coldBase.preparedCycles.length,3);const coldStore=new AsterSystemViewStore(d);coldStore.ingest(cold);assert.equal(coldStore.view(180).vessels.length,7);console.log('three-cycle cold packet bytes',cold.stats.packetBytes);
 const warm=new AsterSystemViewStore(d);warm.ingest(initialPacket);const heldPoses=warm.view(20).vessels.map(v=>sampleVessel(v,20));
 const oversized={...cold,base:{...cold.base,template:undefined,preparedCycles:cold.base.preparedCycles.map(c=>({...c,bytes:28_000_000}))},courier:{...cold.courier,template:undefined,cycles:cold.courier.cycles.filter(c=>c.index>=3).map(c=>({...c,row:{...c.row,bytes:2_000_000}}))}};
 oversized.stats={...oversized.stats,packetBytes:0};oversized.stats.packetBytes=new TextEncoder().encode(JSON.stringify(oversized)).byteLength;assert.ok(oversized.stats.packetBytes<48_000_000);
 assert.throws(()=>warm.ingest(oversized),/combined drawing/);assert.equal(warm.frontier,32);assert.deepEqual(warm.view(20).vessels.map(v=>sampleVessel(v,20)),heldPoses);


 const held=s.oldest,scene=s.view(held),poses=scene.vessels.map(v=>sampleVessel(v,held)),stocks=stockAt(scene,held);
 e.advanceTo(1025);s.ingest(e.delta(),true);assert.deepEqual(s.view(held).vessels.map(v=>sampleVessel(v,held)),poses);assert.deepEqual(stockAt(s.view(held),held),stocks);
 s.release();assert.throws(()=>s.view(held),/history/);
 console.log('full-service bounds',JSON.stringify({maxBytes,maxNodes,maxPacket,frontier:s.frontier,stats:s.stats}));
});
test('publication rejection poisons private engines and invalid ingestion leaves visible backing intact',()=>{
 class Rejecting extends AsterSystemEngine {reject=false;protected override validatePacket(p:AsterSystemDelta){super.validatePacket(p);if(this.reject)throw Error('forced final publication rejection');}}
 const e=new Rejecting(d),s=new AsterSystemViewStore(d);e.advanceTo(32);s.ingest(e.delta());const previous=s.view(12),stocks=stockAt(previous,12),poses=previous.vessels.map(v=>sampleVessel(v,12));
 const bad={...e.delta(),frontier:33,base:{...e.delta().base,frontier:33,template:undefined,preparedCycles:[]},courier:{...e.delta().courier,template:undefined,cycles:[]},orbiters:e.delta().orbiters.map((o,i)=>({...o,id:i===1?'wrong-id':o.id}))};
 assert.throws(()=>s.ingest(bad),/orbiter/i);assert.equal(s.frontier,32);assert.deepEqual(stockAt(s.view(12),12),stocks);assert.deepEqual(s.view(12).vessels.map(v=>sampleVessel(v,12)),poses);
 e.reject=true;assert.throws(()=>e.advanceTo(33),/forced/);assert.equal(e.frontier,32);assert.throws(()=>e.advanceTo(34),/stopped/);assert.throws(()=>e.delta(),/stopped/);assert.equal(s.frontier,32);
});
test('passive fault is isolated and retains invalid physical/frame epochs after history eviction',()=>{
 const bad=structuredClone(d);bad.orbiters[1].state=[1.21,0,0,-.8,0,0];const e=new AsterSystemEngine(bad),s=new AsterSystemViewStore(bad);
 for(let t=32;t<=184;t+=8){e.advanceTo(t);s.ingest(e.delta());}
 assert.equal(e.delta().stats.orbiterFaults,1);assert.ok(e.courier.sample(184));const v=s.view(184).vessels.find(v=>v.id==='Solace')!;
 assert.equal(sampleVessel(v,184).activity?.kind,'fault');assert.throws(()=>stateAt(v,184),/no state/);assert.ok(v.ledger.some(e=>e.kind==='fault'));assert.ok(e.orbiters[1].fault!.t<s.oldest);
});
test('new inclined Selene satellite converges against a finer canonical rollout',()=>{
 const e=new AsterSystemEngine(d),o=e.orbiters[1];o.extend(128);let initial=d.orbiters[1].state,worst=0;
 for(const start of [0,64]){const scenario=structuredClone(o.scenario);delete scenario.logistics;delete scenario.rendezvous;scenario.epoch=start;scenario.duration=64;scenario.bodies[0].radius=1.2;scenario.policy={step:1/512,maxNodes:65536,maxSubdivision:20};scenario.ship={id:'fine-Solace',state:initial,dryMass:1,cargoMass:0,propellant:0,tankCapacity:0,exhaustVelocity:1};
  const fine=new Runner({scenario,program:{schemaVersion:3,id:'fine',burns:[]}}),last=fine.advanceTo(start+64);assert.equal(last.status,'horizon');initial=last.y;
  for(let t=start;t<=start+64;t+=.5)worst=Math.max(worst,...fine.sample(t).y.map((x,i)=>Math.abs(x-o.sample(t).y[i])));
 }
 assert.ok(worst<1e-6);console.log('Solace h/2 worst six-state residual',worst);
});
test('prepared plan markers retain epochs and positions through clipping, extension, eviction and reverse',()=>{
 const e=new AsterSystemEngine(d),s=new AsterSystemViewStore(d);e.advanceTo(32);s.ingest(e.delta());const v=s.view(20).vessels.find(v=>v.id==='Odyssey')!;
 const a=planMarkers(v,20,28,.125),b=planMarkers(v,20.37,28.37,.125),back=planMarkers(v,20,28,.125);assert.deepEqual(back,a);assert.deepEqual(b.filter(q=>q.t<=28),a.filter(q=>q.t>20.37));
 e.advanceTo(40);s.ingest(e.delta());assert.deepEqual(planMarkers(s.view(20).vessels.find(v=>v.id==='Odyssey')!,20,28,.125),a);
 for(let t=48;t<=160;t+=8){e.advanceTo(t);s.ingest(e.delta());}
 const current=s.view(140).vessels.find(v=>v.id==='Odyssey')!,points=planMarkers(current,140,148,.125);e.advanceTo(168);s.ingest(e.delta());assert.deepEqual(planMarkers(s.view(140).vessels.find(v=>v.id==='Odyssey')!,140,148,.125),points);
 for(const epoch of [20.05,20.13,20.71])assert.doesNotThrow(()=>planMarkers(v,epoch,epoch+32,.125));
 const reassembly=e.staged.schedule.period-3;
 const compare=(cursor:number)=>planMarkers(s.view(cursor).vessels.find(v=>v.id==='Atlas-stack')!,reassembly,reassembly+.7,.125);
 assert.deepEqual(compare(reassembly-.1),compare(reassembly+.3));assert.deepEqual(compare(reassembly+.3),compare(reassembly-.1));
 assert.throws(()=>planMarkers(v,0,40,.125),/budget/);assert.equal(planMarkers(s.view(140).vessels.find(v=>v.id==='Atlas-stack')!,140,148,.125).length,0);
});
