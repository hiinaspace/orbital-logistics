import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/model-sets/aster-selene-beacon.json';
import {LibrationEngine,type LibrationDefinition} from '../../src/libration/engine';
import {LibrationViewStore} from '../../src/libration/view';
import {prepareCourier} from '../../src/libration/prepare';
import {sampleVessel,stockAt,displayPortState} from '../../src/model-set/model';
import {portState} from '../../src/sim/logistics';
import {derivative} from '../../src/sim/dynamics';
import {rotate,rotateState} from '../../src/expedition/query';
import {courierLastCycle} from '../../src/libration/query';
import {Runner} from '../../src/sim/runner';
test('libration relay shares the fleet clock with funded, paid periodic lunar visits',()=>{
 const e=new LibrationEngine(fixture as LibrationDefinition),store=new LibrationViewStore(e.definition),d=e.definition.courier,p=e.courier.schedule;
 e.advanceTo(0);let packet=e.delta();store.ingest(packet);assert.ok(packet.template);assert.equal(packet.stats.cacheCompilations,2);
 for(const k of [0,1,17,9000])for(const local of [0,1,1.3,10.5,11,12,14,20,23.7,24,30,31.8]){
  const t=k*p.period+local,q=e.sample(t),raw=e.courier.sample(local),angle=k*p.period*p.rate;
  assert.ok(Math.max(...q.y.map((x,i)=>Math.abs(x-rotateState(raw.y,angle)[i])))<1e-9);
  assert.ok(Math.abs(q.fuelUsed!-(k*p.spent+raw.fuelUsed!))<1e-9);
  if(q.thrust){const f=derivative(e.base.seed.prepared.definition.scenario,t,q.y).slice(3),base=rotate(derivative(e.base.seed.prepared.definition.scenario,local,raw.y).slice(3),angle);assert.ok(Math.max(...f.map((x,i)=>Math.abs(x-base[i])))<2e-9);}
  if(local===11)assert.equal(q.logistics?.dockedPortId,'Beacon');
  if(local===24)assert.equal(q.logistics?.dockedPortId,'Haven');
  if(local===12){assert.equal(q.logistics!.cargoMass,0);assert.equal(e.sample(t,true).logistics!.cargoMass,.15);}
  if(local===30){assert.equal(q.propellant,6);assert.equal(e.sample(t,true).propellant,6-p.spent);}
 }
 for(let t=1;t<=620;t++){
  e.advanceTo(t);packet=e.delta();assert.equal(packet.template,undefined);store.ingest(packet);
  const resource=packet.resources.at(-1)!,q=e.sample(t),ships=[...e.base.schedules.map((_,i)=>e.base.sample(i,t)),q];
  assert.ok(Math.abs(18+resource.fuelImported-ships.reduce((n,s)=>n+s.propellant+s.fuelUsed!,0))<1e-10);
  assert.ok(Math.abs(.15+resource.cargoImported-resource.cargoExported-q.logistics!.cargoMass)<1e-12);
  assert.equal(resource.stocks.find(s=>s.id==='Beacon')!.cargo,0);
  if(t%16===0){
   const scene=store.view(t),v=scene.vessels.find(v=>v.id==='Kestrel')!;
   assert.equal(scene.vessels.length,4);assert.equal(scene.stations.length,5);assert.ok(stockAt(scene,t).every(s=>s.occupied<=1));
   assert.deepEqual(sampleVessel(v,t),q);assert.deepEqual(displayPortState(scene.world.ports.find(p=>p.id==='Beacon')!,scene.portSamples,t),portState(e.definition.station,t));
   for(const b of v.boundaries)assert.ok(v.samples.some(q=>q.t===b.t));
  }
 }
 const held=store.oldest,pose=store.view(held).vessels.map(v=>sampleVessel(v,held)),stocks=stockAt(store.view(held),held);
 e.advanceTo(621);store.ingest(e.delta(),true);assert.deepEqual(store.view(held).vessels.map(v=>sampleVessel(v,held)),pose);assert.deepEqual(stockAt(store.view(held),held),stocks);store.release();
 assert.equal(courierLastCycle(p,1_000_000),31249);assert.equal(courierLastCycle(p,999999),31249);
 assert.ok(e.courier.capture.deltaV<1e-8&&e.courier.landing.deltaV<1e-8);
 const frontier=e.frontier;assert.throws(()=>e.advanceTo(frontier+9),/budget/);assert.equal(e.frontier,frontier);
 assert.throws(()=>store.view(held),/history/);
});
test('actual-field station certification rejects false targets and courier controls converge',()=>{
 const d=fixture as LibrationDefinition,s=d.source.source.source.scenario;
 const bad=structuredClone(d.station);if(bad.rail.kind!=='circular')throw Error('rail');bad.rail.radius+=.01;
 assert.throws(()=>prepareCourier(s,bad,d.courier),/equilibrium/);
 const stock=structuredClone(d.courier);stock.pad.cargo=1;assert.throws(()=>prepareCourier(s,d.station,stock),/supply ownership/);
 const invalid=structuredClone(d.courier);invalid.pad.rail={...d.station.rail};assert.throws(()=>prepareCourier(s,d.station,invalid),/provider/);
 for(const epoch of [0,9000*32]){
  const stationWorld=structuredClone(s);delete stationWorld.logistics;delete stationWorld.rendezvous;stationWorld.epoch=epoch;stationWorld.duration=8;stationWorld.policy={step:1/512,maxNodes:8192,maxSubdivision:20};stationWorld.ship={id:d.station.id,state:portState(d.station,epoch),dryMass:1,cargoMass:0,propellant:0,tankCapacity:0,exhaustVelocity:1};
  const r=new Runner({scenario:stationWorld,program:{schemaVersion:3,id:'equilibrium-check',burns:[]}}),last=r.advanceTo(epoch+8),expected=portState(d.station,epoch+8);
  assert.equal(last.status,'horizon');assert.ok(Math.max(...last.y.map((x,i)=>Math.abs(x-expected[i])))<1e-8);
 }
 const input=structuredClone(d.courier),prepared=prepareCourier(s,d.station,input),owned=prepared.sample(1.3);input.period=40;input.arcs[0].steering!.keys[1].direction=[0,0,1];assert.deepEqual(prepared.sample(1.3),owned);
 for(const [start,end,cargo,fuel,arcs,runner] of [[d.courier.launch,d.courier.arrival,.15,6,d.courier.arcs.slice(0,2),prepared.outbound],[d.courier.departure,d.courier.landing,0,prepared.capture.propellantAfter,d.courier.arcs.slice(2),prepared.returning]] as const){
  const fine=structuredClone(s);delete fine.logistics;delete fine.rendezvous;fine.bodies[0].radius+=.2;fine.epoch=start;fine.duration=end-start;fine.policy={step:1/4096,maxNodes:65536,maxSubdivision:20};fine.ship={...d.courier.ship,cargoMass:cargo,propellant:fuel,state:portState(start===d.courier.launch?d.courier.pad:d.station,start)};
  const r=new Runner({scenario:fine,program:{schemaVersion:4,id:'convergence',burns:[],thrustArcs:arcs}}),last=r.advanceTo(end),base=runner.sample(end);
  assert.equal(last.status,'horizon');assert.ok(Math.max(...last.y.map((x,i)=>Math.abs(x-base.y[i])))<1e-8);assert.ok(Math.abs(last.propellant-base.propellant)<1e-12);
 }
});
