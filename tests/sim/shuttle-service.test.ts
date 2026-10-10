import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/traffic/orison-shuttle-service.json';
import {admitEpisode,nextWindow,validateTraffic,CALENDAR_LIMIT,type TrafficDefinition} from '../../src/traffic/planner';
import {WholeFlightCache} from '../../src/traffic/prepared';
import {TrafficEngine} from '../../src/traffic/engine';
import {TrafficViewStore} from '../../src/traffic/view';
import {Runner} from '../../src/sim/runner';
import {paidCapture} from '../../src/sim/capture';
import {portState} from '../../src/sim/logistics';
import {sampleVessel} from '../../src/model-set/model';
const d=fixture as TrafficDefinition;
const advance=(e:TrafficEngine,t:number,b=256)=>{while(e.frontier<t)e.advanceTo(t,b);};
function balance(e:TrafficEngine){
 const a=e.snapshot(),r=a.resources;
 const fuel=r.stocks.reduce((n,s)=>n+s.propellant,0)+a.current.ships.reduce((n,s)=>n+s.propellant+s.fuelUsed!,0)+r.fuelExported-r.fuelImported;
 const cargo=r.stocks.reduce((n,s)=>n+s.cargo,0)+a.current.ships.reduce((n,s)=>n+s.logistics!.cargoMass,0)+r.cargoExported-r.cargoImported;
 assert.ok(Math.abs(fuel-d.stations.reduce((n,s)=>n+s.propellant,0)-d.vessels.reduce((n,s)=>n+s.propellant,0))<1e-10);
 assert.ok(Math.abs(cargo-d.stations.reduce((n,s)=>n+s.cargo,0))<1e-10);
}
test('whole-flight rotations agree with fresh integration and pay actual phase captures through the last window',()=>{
 const cache=new WholeFlightCache();
 for(const t of d.templates)for(const after of [.2,400, CALENDAR_LIMIT-20]){
  const w=nextWindow(d,t,after),r=admitEpisode(d,t,'test',0,0,w,t.cargo,t.propellant,cache),fresh=admitEpisode(d,t,'fresh',0,0,w,t.cargo,t.propellant);
  for(let i=0;i<65;i++){const epoch=t.duration*i/65,a=r.runner.sample(epoch),b=fresh.runner.sample(epoch);assert.ok(Math.hypot(...a.y.map((v,j)=>v-b.y[j]))<2e-8);assert.ok(Math.abs(a.propellant-b.propellant)<2e-10);}
  const boundary=r.runner.eventBoundaries.find(e=>e.t===t.duration)!,port=r.bundle.scenario.logistics!.ports.find(p=>p.id===t.destination)!;
  const target=portState(port,t.duration),cap=paidCapture(boundary.before.y,target,{...r.bundle.scenario.ship,propellant:boundary.before.propellant},{position:1e-7,velocity:1e-7},'test');
  assert.deepEqual(boundary.after.y,target);assert.equal(boundary.after.propellant,cap.propellantAfter);
  assert.equal(boundary.after.fuelUsed,t.propellant-cap.propellantAfter);
  assert.equal(r.runner.ledger.at(-1)!.fuelUsed,cap.fuelUsed);assert.ok(cap.deltaV<1e-7);
  assert.equal('advanceTo' in r.runner,false);assert.equal('fork' in r.runner,false);
 }
 assert.equal(cache.stats().flightCacheEntries,2);assert.equal(cache.stats().flightCacheHits,4);assert.ok(cache.stats().flightCacheNodes<10000);
});
test('unsupported guidance and mutable cache identities reject before operations',()=>{
 for(const mutate of [(v:TrafficDefinition)=>v.templates[0].arcs[0].steering!.keys[1].direction=[0,1,0],(v:TrafficDefinition)=>v.world.scenario.bodies.push({...v.world.scenario.bodies[0],id:'moon'}),(v:TrafficDefinition)=>v.world.scenario.ship.engine!.maxAcceleration=3]){
  const bad=structuredClone(d);mutate(bad);assert.throws(()=>validateTraffic(bad));
 }
 const e=new TrafficEngine(d);assert.throws(()=>e.definition.templates[0].propellant=5);assert.throws(()=>e.definition.world.scenario.ship.engine!.maxThrust=31);balance(e);
});
test('cache query partitions, event sides and rebuilt old cursors preserve physical states',()=>{
 const a=new TrafficEngine(d),b=new TrafficEngine(d),store=new TrafficViewStore(b.definition);store.ingest(b.delta());
 advance(a,160);
 for(let t=8;t<=160;t+=8){const previous=b.frontier;advance(b,t,7);store.ingest(b.delta(previous));balance(b);}
 assert.deepEqual(a.snapshot(),b.snapshot());
 for(const record of store.episodes.filter(r=>r.source.departure<146).slice(-4)){
  const source=record.source,fresh=new Runner(source.bundle);fresh.advanceTo(source.bundle.scenario.epoch+source.bundle.scenario.duration);
  const middle=source.departure+.7;
  for(const cursor of [middle,middle+12]){
   const scene=store.view(cursor),v=scene.vessels.find(v=>v.id===source.shipId)!;
   for(const offset of [-1e-6,0,1e-6]){
    const t=middle+offset,sample=sampleVessel(v,t),truth=fresh.sample(.7+offset);
    assert.ok(Math.hypot(...sample.y.slice(0,3).map((x,i)=>x-truth.y[i]))<1e-10);
    assert.ok(Math.hypot(...sample.y.slice(3).map((x,i)=>x-truth.y[i+3]))<1e-8);
   }
  }
 }
 const cursor=store.oldest;const held=sampleVessel(store.view(cursor).vessels[0],cursor);const previous=b.frontier;advance(b,161);store.ingest(b.delta(previous),true);assert.deepEqual(sampleVessel(store.view(cursor).vessels[0],cursor),held);store.release();
});
test('resource retries and missing arrival faults leave the other cached shuttle active',()=>{
 const scarce=structuredClone(d);scarce.stations[0].propellant=0;scarce.stations[0].propellantRate=.1;
 const wait=new TrafficEngine(scarce);advance(wait,80);assert.ok(wait.delta().events.some(e=>e.kind==='planning-failed'));assert.ok(wait.snapshot().ships[1].voyage>0);
 const e=new TrafficEngine(d,{episodeAdapter:episode=>{if(episode.shipId!=='Tern')return episode.runner;const b=structuredClone(episode.bundle);b.program.operations=b.program.operations!.filter(o=>o.id!==episode.arrivalOperationId);return new Runner(b);}});
 advance(e,80);balance(e);assert.equal(e.snapshot().ships[0].stage,'fault');assert.ok(e.snapshot().ships[1].voyage>4);assert.equal(e.delta().events.filter(e=>e.kind==='fault').length,1);
 const view=new TrafficViewStore(e.definition);view.ingest(e.delta());assert.equal(sampleVessel(view.view(80).vessels[0],80).activity?.kind,'fault');
});
test('two ships retain bounded cache/history for 1024 units without planning failures',()=>{
 const e=new TrafficEngine(d),store=new TrafficViewStore(e.definition);store.ingest(e.delta());
 let entries=0,maxView=0;
 for(let target=8;target<=1024;target+=8){const previous=e.frontier;advance(e,target);const delta=e.delta(previous);store.ingest(delta);balance(e);
  assert.ok(delta.stats.denseSamples<=65536);assert.ok(delta.stats.runnerNodes<20000);assert.ok(delta.stats.flightCacheEntries>=entries);entries=delta.stats.flightCacheEntries;
  assert.ok(delta.events.every(e=>!['fault','unavailable','planning-failed'].includes(e.kind)));
  maxView=Math.max(maxView,new TextEncoder().encode(JSON.stringify(store.view(target))).byteLength);
 }
 assert.equal(entries,2);assert.ok(e.delta().stats.flightCacheHits>150);assert.ok(e.snapshot().ships.every(s=>s.voyage>=80));assert.ok(maxView<8_000_000);
});
