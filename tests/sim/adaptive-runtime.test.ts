import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AdaptiveEngine} from '../../src/adaptive/engine';
import {AdaptiveViewStore} from '../../src/adaptive/view';
import {sampleVessel} from '../../src/model-set/model';
const fixture=JSON.parse(readFileSync('fixtures/traffic/orison-flexible-service.json','utf8'));
const drain=(e:AdaptiveEngine,t:number,budget=4096)=>{let calls=0;while(e.advanceTo(t,budget).yielded){if(++calls>100000)throw Error('Job exceeded bounded progress');}return e;};

test('coupled dependencies halt at their actual event-left fuel and mass without ghost station credits',()=>{
 for(const failAt of ['capture','transfer','release'] as const){const e=drain(new AdaptiveEngine(fixture,{failAt}),64),p=e.delta(),trip=p.visits[0];
  assert.match(e.halt!,new RegExp(failAt));assert.ok(e.frontier<64);assert.ok(Math.abs(p.stats.fuelBalanceError)<1e-12);
  assert.equal(p.stats.fuelDelivered,failAt==='release'?trip.plan.delivery:0);assert.equal(p.events.some(x=>x.t>e.frontier),false);
  const held=e.snapshot();e.advanceTo(128);assert.deepEqual(e.snapshot(),held);
  const store=new AdaptiveViewStore(e.definition);store.ingest(p);const view=store.view(e.frontier),station=sampleVessel(view.maintained!.Meridian,e.frontier);
  assert.equal(view.window.end,e.frontier);assert.equal(station.propellant,p.stats.stationFuel);assert.equal(view.vessels[0].samples.some(s=>s.t>e.frontier),false);
  assert.equal(sampleVessel(view.vessels[0],e.frontier).activity?.kind,'fault');
 }
});

test('request sizes, solver yields, exact paused heads and forecast visibility preserve admitted physical plans',()=>{
 const a=drain(new AdaptiveEngine(fixture),64),b=new AdaptiveEngine(fixture),store=new AdaptiveViewStore(b.definition);let after=-1;
 for(const t of [0,5.125,20.5,24.12345,32,52.5,54.5,64]){
  while(true){const r=b.advanceTo(t,7);if(b.initialized){store.ingest(b.delta(after));after=b.frontier;}if(!r.yielded)break;}
 }
 const pa=a.delta(),pb=b.delta();assert.deepEqual(pb.current,pa.current);assert.deepEqual(pb.events,pa.events);assert.deepEqual(pb.visits.map(v=>v.plan),pa.visits.map(v=>v.plan));assert.ok(Math.abs(pb.stats.fuelBalanceError)<1e-12);
 const trip=pb.visits[0],pre=store.view(0);assert.equal(pre.vessels[0].ledger.some(e=>e.t>40),false);
 const past=store.view(24.12345),ship=sampleVessel(past.vessels[0],24.12345),pose=structuredClone(ship.y);store.view(52.5);assert.deepEqual(sampleVessel(store.view(24.12345).vessels[0],24.12345).y,pose);
 assert.equal(ship.logistics?.dockedPortId,'Meridian');assert.equal(ship.thrust,undefined);
 // A cursor before the later admission cannot acquire its route/controls.
 const later=pb.visits.find(v=>v.knownAt>0);if(later){const before=store.view(later.knownAt-.01);assert.ok(before.vessels[0].arcs.every(arc=>!arc.id.startsWith(later.id)));}
 assert.ok(trip.events.filter(e=>e.kind==='thrust-end').length===4);
});
