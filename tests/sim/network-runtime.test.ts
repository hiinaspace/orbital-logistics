import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {NetworkEngine} from '../../src/network/engine';
import {NetworkViewStore} from '../../src/network/view';
import {sampleVessel,displayPortState,stockAt} from '../../src/model-set/model';
import {transform} from '../../src/model-set/frames';
const fixture=JSON.parse(readFileSync('fixtures/traffic/orison-relay-network.json','utf8'));
const drain=(e:NetworkEngine,t:number,budget=4096)=>{let calls=0;while(e.advanceTo(t,budget).yielded){assert.ok(++calls<100000);}assert.equal(e.halt,undefined);return e;};
test('network publication is atomic across yields, partitions, input order and exact origin reuse',()=>{
 const a=drain(new NetworkEngine(fixture),64),shuffled=structuredClone(fixture);shuffled.lanes.reverse();
 const b=new NetworkEngine(shuffled,{cache:false}),store=new NetworkViewStore(shuffled);let after=-1;
 for(const t of [0,5.125,20.5,24.12345,32,52.5,54.5,64])while(true){const r=b.advanceTo(t,7);if(b.initialized){const p=b.delta(after);assert.equal(p.lanes.length,2);for(const l of p.lanes){assert.equal(l.frontier,p.frontier);assert.equal(l.current.t,p.frontier);assert.ok(l.visits.every(v=>v.knownAt<=p.frontier));assert.ok(l.chunks.every(c=>c.knownAt<=p.frontier));assert.ok(l.events.every(e=>e.t<=p.frontier));}assert.ok(p.resources.every(r=>r.t<=p.frontier));assert.ok(Math.abs(p.stats.fuelBalanceError)<1e-12);store.ingest(p);after=p.frontier;}if(!r.yielded)break;}
 const pa=a.delta(),pb=b.delta();assert.deepEqual(pb.lanes.map(l=>l.current),pa.lanes.map(l=>l.current));assert.deepEqual(pb.lanes.map(l=>l.events),pa.lanes.map(l=>l.events));assert.deepEqual(pb.lanes.map(l=>l.visits.map(v=>v.plan)),pa.lanes.map(l=>l.visits.map(v=>v.plan)));assert.deepEqual(pb.resources,pa.resources);
 const view=store.view(24.12345);assert.equal(view.vessels.length,2);assert.equal(view.stations.length,3);assert.equal(stockAt(view,24.12345).find(p=>p.id==='Equator')!.occupied,0);
 const pose=view.vessels.map(v=>sampleVessel(v,24.12345));store.view(64);assert.deepEqual(store.view(24.12345).vessels.map(v=>sampleVessel(v,24.12345)),pose);
 assert.ok(pa.stats.originCacheHits>100);assert.equal(pb.stats.originCacheHits,0);assert.ok(pa.stats.maxTransientNodes<=400000);assert.ok(pa.stats.maxRetainedNodes<=140000);assert.ok(store.stats.viewBytes<=16000000);
});
test('simultaneous refuel requests compete for one imported stock and recover without ghost credit',()=>{
 const d=structuredClone(fixture);d.lanes[1].reference=structuredClone(d.lanes[0].reference);d.lanes[1].relay.ship.state=structuredClone(d.lanes[0].relay.ship.state);
 for(const l of d.lanes){l.stations[0].propellant=0;l.stations[0].tankCapacity=.32;l.stations[0].propellantRate=.006;}
 const e=drain(new NetworkEngine(d),55),p=e.delta(),refuels=p.lanes.flatMap(l=>l.events).filter(e=>e.kind==='transfer'&&e.portId==='Equator');
 assert.equal(refuels.length,1);assert.equal(refuels[0].shipId,'Ibis');assert.equal(p.lanes[1].current.ships[0].activity?.kind,'service');assert.ok(p.lanes[1].events.some(e=>e.detail==='Equator fuel unavailable'));assert.equal(p.stats.completed,2);assert.ok(Math.abs(p.stats.fuelBalanceError)<1e-12);
 drain(e,104);const later=e.delta(),all=later.lanes.flatMap(l=>l.events).filter(e=>e.kind==='transfer'&&e.portId==='Equator');assert.equal(all.length,2);assert.equal(all[1].shipId,'Tern');assert.ok(all[1].t>all[0].t);assert.ok(Math.abs(later.stats.fuelBalanceError)<1e-12);
});
test('a failed coupled dependency invalidates only its assigned pair while the other service continues',()=>{
 for(const shipId of ['Ibis','Tern'])for(const failAt of ['capture','transfer','release'] as const){
  const e=drain(new NetworkEngine(fixture,{failures:{[shipId]:failAt}}),128),p=e.delta(),i=e.definition.lanes.findIndex(l=>l.vessels[0].id===shipId),failed=p.lanes[i],healthy=p.lanes[1-i];
  if(shipId==='Tern'&&failAt==='capture')writeFileSync('docs/design/multiship-service/fault-display.json',JSON.stringify(p)+'\n');
  assert.match(failed.halt!,new RegExp(failAt));assert.equal(healthy.halt,undefined);assert.ok(healthy.stats.completed>=1);assert.ok(Math.abs(p.stats.fuelBalanceError)<1e-12);assert.ok(failed.events.every(e=>e.t<=failed.frontier));assert.equal(failed.stats.fuelDelivered,failAt==='release'?failed.visits[0].plan.delivery:0);
  const store=new NetworkViewStore(fixture);store.ingest(p);const view=store.view(120),stationId=e.definition.lanes[i].relay.id,station=view.maintained![stationId],s=sampleVessel(station,120);
  assert.equal(s.activity?.knownEpoch,failed.frontier);assert.equal(s.activity?.kind,'fault');assert.equal(s.propellant,failed.stats.stationFuel);assert.ok(view.portSamples[stationId].every(s=>s.t<=failed.frontier));assert.throws(()=>displayPortState(view.world.ports.find(p=>p.id===stationId)!,view.portSamples,120),/validity/);assert.throws(()=>transform(view,s.y,120,stationId),/validity/);
  assert.equal(sampleVessel(view.vessels.find(v=>v.id===shipId)!,120).activity?.kind,'fault');assert.ok(sampleVessel(view.vessels.find(v=>v.id!==shipId)!,120).activity?.kind!=='fault');
  if(shipId==='Tern'&&failAt==='capture'){drain(e,224);const fresh=new NetworkViewStore(fixture);fresh.ingest(e.delta());const late=fresh.view(224);assert.ok(fresh.oldest>failed.frontier);assert.equal(sampleVessel(late.maintained![stationId],224).activity?.knownEpoch,20);}
  const past=store.view(0);assert.equal(sampleVessel(past.maintained![stationId],0).activity?.kind,undefined);assert.equal(sampleVessel(store.view(failed.frontier).maintained![stationId],failed.frontier+1).activity?.kind,'fault');
 }
});
