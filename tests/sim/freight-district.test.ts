import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/traffic/orison-freight-district.json';
import latitude from '../../fixtures/model-sets/orison-latitude-shuttle.json';
import {validateBundle,type Bundle,type Vec3} from '../../src/sim/schema';
import {Runner} from '../../src/sim/runner';
import {portState,surfaceNormal} from '../../src/sim/logistics';
import {rocketAxis} from '../../src/view/rocket';
import {prepareSet,sampleVessel,type ModelSet} from '../../src/model-set/model';
import {admitEpisode,nextWindow,validateTraffic,flightCacheLimits,localAt,CALENDAR_LIMIT,type TrafficDefinition} from '../../src/traffic/planner';
import {WholeFlightCache} from '../../src/traffic/prepared';
import {TrafficEngine} from '../../src/traffic/engine';
import {TrafficViewStore} from '../../src/traffic/view';
const d=fixture as TrafficDefinition;
const advance=(e:TrafficEngine,t:number,b=256)=>{while(e.frontier<t)e.advanceTo(t,b);};
function balance(e:TrafficEngine){
 const a=e.snapshot(),r=a.resources;
 const fuel=r.stocks.reduce((n,s)=>n+s.propellant,0)+a.current.ships.reduce((n,s)=>n+s.propellant+s.fuelUsed!,0)+r.fuelExported-r.fuelImported;
 const cargo=r.stocks.reduce((n,s)=>n+s.cargo,0)+a.current.ships.reduce((n,s)=>n+s.logistics!.cargoMass,0)+r.cargoExported-r.cargoImported;
 assert.ok(Math.abs(fuel-e.definition.stations.reduce((n,s)=>n+s.propellant,0)-e.definition.vessels.reduce((n,s)=>n+s.propellant,0))<1e-10);
 assert.ok(Math.abs(cargo-e.definition.stations.reduce((n,s)=>n+s.cargo,0))<1e-10);
}
test('latitude ports follow small circles with correct velocity and radial launch release',()=>{
 const b=validateBundle(latitude.vessels[0].bundle),pad=b.scenario.logistics!.ports[0];
 for(const t of [0,.5,17,1000]){
  const y=portState(pad,t),normal=surfaceNormal(pad,t),eps=1e-4,a=portState(pad,t-eps),z=portState(pad,t+eps);
  assert.ok(Math.abs(Math.hypot(...y.slice(0,3))-1.000001)<3e-16);
  assert.ok(Math.abs(Math.atan2(y[2],Math.hypot(y[0],y[1]))-20*Math.PI/180)<1e-15);
  assert.ok(Math.hypot(...y.slice(3).map((v,i)=>v-(z[i]-a[i])/(2*eps)))<1e-9);
  assert.ok(Math.abs(Math.hypot(...normal)-1)<3e-16);
 }
 const old=structuredClone(b);old.scenario.logistics!.modelVersion='surface-ports-v3';assert.throws(()=>validateBundle(old),/Latitude requires/);
 for(const lat of [NaN,Math.PI,undefined]){const bad=structuredClone(b);if(bad.scenario.logistics!.ports[0].rail.kind==='surface')bad.scenario.logistics!.ports[0].rail.latitude=lat;assert.throws(()=>validateBundle(bad));}
 const marginal=structuredClone(b),rail=marginal.scenario.logistics!.ports[0].rail;
 if(rail.kind!=='surface')throw Error('pad');
 rail.latitude=80*Math.PI/180;marginal.scenario.ship.state=portState(marginal.scenario.logistics!.ports[0],0);
 marginal.scenario.ship.engine!.maxAcceleration=.995;
 const a=marginal.program.thrustArcs![0];a.direction=surfaceNormal(marginal.scenario.logistics!.ports[0],.5);a.steering=undefined;
 const r=new Runner(marginal),at=r.advanceTo(.5);assert.equal(at.status,'operation-rejected');assert.match(at.detail,/outward/);assert.equal(at.logistics!.dockedPortId,'Northport');assert.equal(at.propellant,6);assert.ok(!r.ledger.some(e=>e.kind==='launch'));
});
test('northern shuttle certifies complete six-state launches and landings with paid captures and spatial attitude',()=>{
 const run=prepareSet(latitude as unknown as ModelSet),v=run.vessels[0],r=new Runner(v.bundle),last=r.advanceTo(17);
 assert.equal(last.status,'horizon');assert.equal(last.logistics!.dockedPortId,'Northport');assert.equal(last.logistics!.cargoMass,0);assert.ok(last.propellant>.4);
 const captures=r.ledger.filter(e=>e.kind==='dock'||e.kind==='land');assert.equal(captures.length,3);
 for(const e of captures){assert.ok(e.positionError!<1e-8);assert.ok(e.deltaV<1e-8);const side=r.eventBoundaries.find(b=>b.t===e.t);if(side)assert.deepEqual(side.after.y,r.portState(e.portId!,e.t));}
 assert.ok(Math.abs(r.sample(1).y[5])>.01);
 for(const t of [0,.49,1,15.9]){const at=sampleVessel(v,t),axis=rocketAxis(v,at,t);if(at.logistics?.dockedPortId==='Northport')assert.deepEqual(axis,surfaceNormal(v.ports[0],t));if(at.thrust)assert.deepEqual(axis,at.thrust.direction);}
 for(const t of [.49,.5,2.454677006919614,13.749399215612783,15.804939824450713]){
  const a=new Runner(v.bundle);a.seek(t);const restored=Runner.deserialize(a.serialize());assert.deepEqual(restored.advanceTo(17),last);
 }
});
test('all six district routes reuse full flights and preserve actual captures and event epochs through the last windows',()=>{
 const cache=new WholeFlightCache(flightCacheLimits(d));
 for(const t of d.templates)for(const after of [.2,512,CALENDAR_LIMIT-40]){
  const w=nextWindow(d,t,after),e=admitEpisode(d,t,'check',0,0,w,t.cargo,t.propellant,cache),fresh=admitEpisode(d,t,'fresh',0,0,w,t.cargo,t.propellant);
  for(let i=0;i<=24;i++){const epoch=t.duration*i/24,a=e.runner.sample(epoch),b=fresh.runner.sample(epoch);assert.ok(Math.hypot(...a.y.map((v,j)=>v-b.y[j]))<3e-8);assert.ok(Math.abs(a.propellant-b.propellant)<3e-10);}
  for(const arc of e.bundle.program.thrustArcs!)for(const local of [arc.start,arc.end])assert.equal(localAt(e,e.departure+local),local);
  for(const event of e.runner.ledger){assert.equal(localAt(e,e.departure+event.t),Math.max(0,event.t));}
  const boundary=e.runner.eventBoundaries.find(b=>b.t===t.duration)!;assert.deepEqual(boundary.after.y,portState(e.bundle.scenario.logistics!.ports.find(p=>p.id===t.destination)!,t.duration));
  assert.equal('advanceTo' in e.runner,false);assert.equal('fork' in e.runner,false);
 }
 const stats=cache.stats();assert.equal(stats.flightCacheEntries,6);assert.equal(stats.flightCacheHits,12);assert.ok(stats.flightCacheNodes<16000);assert.ok(stats.flightCacheSerializedBytes<12_000_000);
 // An inclined endpoint cannot be silently substituted into a planar cache.
 const t=d.templates[0],e=admitEpisode(d,t,'negative',0,0,{index:0,departure:t.referenceDeparture},t.cargo,t.propellant);
 const bad=structuredClone(e.bundle),destination=bad.scenario.logistics!.ports.find(p=>p.id===t.destination)!;
 if(destination.rail.kind!=='circular')throw Error('depot');
 destination.rail.u=[Math.cos(.1),0,Math.sin(.1)] as Vec3;
 assert.throws(()=>new WholeFlightCache().get('negative',bad,0,()=>e.runner as Runner,t.source,t.destination),/Powered transfer admission failed/);
 const unsupported=structuredClone(d);unsupported.world.scenario.logistics!.ports[1].rail=destination.rail;assert.throws(()=>validateTraffic(unsupported));
});
test('connected service conserves shared stocks, counts only final delivery and stays bounded for 1024 units',()=>{
 const e=new TrafficEngine(d),store=new TrafficViewStore(e.definition);store.ingest(e.delta());let maxView=0;
 assert.equal(e.snapshot().unloaded.Crown,0);
 for(let t=8;t<=1024;t+=8){const previous=e.frontier;advance(e,t);const delta=e.delta(previous);store.ingest(delta);balance(e);
  assert.ok(delta.events.every(e=>!['fault','unavailable'].includes(e.kind)&&!(e.kind==='planning-failed'&&e.detail?.includes('Transfer planning failed'))));
  assert.ok(delta.stats.denseSamples<=65536);assert.ok(delta.stats.runnerNodes<16000);
  maxView=Math.max(maxView,new TextEncoder().encode(JSON.stringify(store.view(t))).byteLength);
 }
 const a=e.snapshot(),stats=e.delta().stats;assert.equal(stats.flightCacheEntries,6);assert.ok(a.unloaded.Meridian>.5&&a.unloaded.Lantern>.5);assert.ok(a.unloaded.Crown>stats.delivered);
 assert.equal(stats.delivered,a.unloaded.Meridian+a.unloaded.Lantern);assert.ok(maxView<8_000_000);assert.ok(a.ships.every(s=>s.voyage>40));
 const cursor=store.oldest+1,held=sampleVessel(store.view(cursor).vessels[0],cursor),previous=e.frontier;advance(e,1025);store.ingest(e.delta(previous),true);
 assert.deepEqual(sampleVessel(store.view(cursor).vessels[0],cursor),held);
});
test('onward service waits when ground supply stops; a failed freighter keeps its cargo while other routes continue',()=>{
 const scarce=structuredClone(d);scarce.stations[0].cargo=.05;scarce.stations[0].cargoRate=0;
 const e=new TrafficEngine(scarce);advance(e,160);balance(e);const a=e.snapshot();assert.equal(a.unloaded.Crown,.05);assert.equal(a.unloaded.Meridian+a.unloaded.Lantern,.05);assert.ok(a.ships.every(s=>s.stage==='waiting'));assert.ok(a.ships.every(s=>s.voyage===2));
 const failed=new TrafficEngine(d,{episodeAdapter:episode=>{if(episode.shipId!=='Ibis')return episode.runner;const b=structuredClone(episode.bundle);b.program.operations=b.program.operations!.filter(o=>o.id!==episode.arrivalOperationId);return new Runner(b);}});
 advance(failed,160);balance(failed);const f=failed.snapshot();assert.equal(f.ships[1].stage,'fault');assert.equal(f.ships[1].cargo,.025);assert.ok(f.unloaded.Lantern>.1);assert.ok(f.ships[0].voyage>10);
 const partition=new TrafficEngine(d),whole=new TrafficEngine(d);advance(whole,96);for(let t=1;t<=96;t++)advance(partition,t,7);assert.deepEqual(partition.snapshot(),whole.snapshot());
});


test('exact synodic windows survive service completion roundoff without premature departures',()=>{
 for(const t of d.templates){
  const initial=nextWindow(d,t,.2),period=2*Math.PI/Math.abs((d.world.scenario.logistics!.ports.find(p=>p.id===t.source)!.rail as {rate:number}).rate-(d.world.scenario.logistics!.ports.find(p=>p.id===t.destination)!.rail as {rate:number}).rate);
  for(const index of [0,1,3,17,123,9999]){const departure=t.referenceDeparture+index*period;assert.equal(nextWindow(d,t,departure).departure,departure);assert.equal(nextWindow(d,t,departure+.00001).index,index+1);assert.ok(nextWindow(d,t,departure-.00001).departure>=departure-.00001);}
  assert.ok(initial.departure>=.2);
 }
 // Delayed refuelling at Equator retries service just ahead of the index3
 // window, then catches that exact window instead of index4.
 const scarce=structuredClone(d);scarce.stations[0].propellant=0;scarce.stations[0].propellantRate=.17;
 const e=new TrafficEngine(scarce);advance(e,38);const launch=e.delta().events.find(e=>e.shipId==='Tern'&&e.kind==='launch');assert.equal(launch?.t,37.923553943263286);balance(e);
});
