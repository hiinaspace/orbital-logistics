import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AdaptiveEngine} from '../../src/adaptive/engine';
import {AdaptiveViewStore} from '../../src/adaptive/view';
import {CoupledTrip} from '../../src/adaptive/plan';
import {sampleVessel} from '../../src/model-set/model';
import {surfaceDuration,surfaceDeltaV,surfaceSample,surfaceFuel,surfaceInterface,groundState,rotate,descentReserve,admitSurfaceFlight} from '../../src/surface-flexible/contracts';
const fixture=JSON.parse(readFileSync('fixtures/traffic/orison-surface-flexible.json','utf8'));
const drain=(e:AdaptiveEngine,t:number,budget=256)=>{let calls=0;while(e.advanceTo(t,budget).yielded){if(++calls>100000)throw Error('Bounded progress failed');if(e.halt)break;}return e;};

test('surface contracts preserve geometry across load, pay mass law, and reject saturation/depletion',()=>{
 for(const leg of ['ascent','descent'] as const)for(const rotation of [0,1.4,4.9]){
  const low=leg==='descent'?descentReserve()+.01:3;
  const f={leg,start:0,rotation,fuel:6,used:2,id:'test'},g={...f,fuel:low};
  for(const t of [0,.135,.7,1.5,surfaceDuration]){
   const a=surfaceSample(f,t),b=surfaceSample(g,t);assert.deepEqual(a.y,b.y);
   assert.ok(Math.abs((a.propellant+1.05)/(f.fuel+1.05)-(b.propellant+1.05)/(g.fuel+1.05))<1e-14);
   assert.ok(Math.abs(a.fuelUsed!-(2+6-a.propellant))<1e-13);
   if(a.thrust){assert.equal(a.thrust.acceleration,3);assert.equal(a.thrust.force,3*a.mass!);}
  }
 }
 const f={leg:'descent' as const,start:0,rotation:0,fuel:descentReserve()+.1,used:0,id:'admission'};
 assert.throws(()=>admitSurfaceFlight(f,{maxThrust:5,maxAcceleration:3}),/force ceiling/);
 assert.throws(()=>admitSurfaceFlight({...f,fuel:.1}),/reserve/);
 assert.throws(()=>surfaceSample({...f,fuel:7},0),/envelope/);assert.throws(()=>surfaceSample({...f,hash:'wrong'},0),/hash/);
 assert.ok(surfaceFuel(6,2*surfaceDeltaV)>.7);
});

test('composed tours land before refuelling, preserve load ownership and history across fine event epochs',()=>{
 const e=drain(new AdaptiveEngine(fixture),0),p=e.delta(),v=p.visits[0],trip=new CoupledTrip(e.definition,v.plan);
 assert.ok(v.plan.surface!.launch>=v.knownAt);assert.equal(v.arrival,v.plan.surface!.touchdown);assert.equal(v.end,v.arrival+2);
 assert.ok(trip.home.propellantAfter>.05);assert.ok(trip.capture.propellantAfter>trip.afterTransferFuel);
 assert.ok(trip.events.some(e=>e.kind==='handoff'&&e.id.endsWith('ascent-exit')));
 const store=new AdaptiveViewStore(e.definition);store.ingest(p);
 for(const t of [v.departure,v.departure+.121,v.plan.schedule.departure-.000001,v.plan.schedule.departure,v.arrival-.000001,v.arrival,v.end]){
  drain(e,t,7);store.ingest(e.delta());const view=store.view(t),a=sampleVessel(view.vessels[0],t),b=trip.sample(t);
  assert.ok(Math.hypot(...a.y.map((x,i)=>x-b.y[i]))<1e-12);
  assert.ok(Math.abs(a.propellant-(t===v.end?6:b.propellant))<1e-12);
  assert.ok(Math.abs(e.delta().stats.fuelBalanceError)<1e-10);
  if(t<v.arrival&&t>=v.plan.schedule.homeArrival)assert.equal(a.logistics?.dockedPortId,undefined);
 }
 assert.equal(e.delta().stats.completed,1);assert.equal(e.delta().current.ships[0].propellant,6);
 const held=v.departure+.1234,pose=sampleVessel(store.view(held).vessels[0],held).y;
 drain(e,80);store.ingest(e.delta(),true);
 assert.deepEqual(sampleVessel(store.view(held).vessels[0],held).y,pose);
 store.release();drain(e,160);store.ingest(e.delta());assert.ok(e.delta().stats.completed>=2);assert.equal(e.delta().stats.controllerFailed,0);
 assert.ok(store.stats.viewBytes<8_000_000);assert.ok(store.stats.surfaceCacheBytes<600000);
 const invalid=structuredClone(v.plan);invalid.surface!.launch=-1;
 assert.throws(()=>new CoupledTrip(e.definition,invalid),/schedule/);
 const mismatch=structuredClone(v.plan);mismatch.inbound.scenario.ship.state[0]+=.001;
 assert.throws(()=>new CoupledTrip(e.definition,mismatch),/mismatch/);
});

test('surface coupled faults preserve immutable admission, paid prefix, and past forecast knowledge',()=>{
 for(const failAt of ['capture','transfer','release'] as const){
  const e=drain(new AdaptiveEngine(fixture,{failAt}),90),p=e.delta(),v=p.visits[0];
  assert.match(e.halt!,new RegExp(failAt));assert.ok(Math.abs(p.stats.fuelBalanceError)<1e-10);
  assert.ok(v.samples.some(s=>s.t>e.frontier));assert.ok(v.events.some(s=>s.t>e.frontier));
  const store=new AdaptiveViewStore(e.definition);store.ingest(p);
  const fault=store.view(e.frontier);assert.equal(sampleVessel(fault.vessels[0],e.frontier).activity?.kind,'fault');
  assert.equal(fault.window.end,e.frontier);assert.equal(sampleVessel(fault.maintained!.Meridian,e.frontier).propellant,p.stats.stationFuel);
  const past=store.view(Math.max(v.departure,e.frontier-8));assert.ok(past.window.end>e.frontier);
  assert.ok(past.vessels[0].arcs.some(a=>a.start>e.frontier));assert.notEqual(sampleVessel(past.vessels[0],e.frontier+1).activity?.kind,'fault');assert.equal(past.vessels[0].ledger.some(e=>e.kind==='fault'),false);
 }
});
