import {test} from 'node:test';
import assert from 'node:assert/strict';
import definition from '../../fixtures/traffic/selene-service.json';
import {TrafficEngine,DENSE_SAMPLE_BUDGET} from '../../src/traffic/engine';
import {TrafficViewStore} from '../../src/traffic/view';
import {validateTraffic,nextWindow,admitEpisode,localAt,CALENDAR_LIMIT,type TrafficDefinition} from '../../src/traffic/planner';
import {Runner} from '../../src/sim/runner';
import {sampleVessel,stateAt} from '../../src/model-set/model';
import {portState} from '../../src/sim/logistics';
const d=definition as TrafficDefinition;
function advance(e:TrafficEngine,t:number,budget=256){while(e.frontier<t)e.advanceTo(t,budget);}
function conservation(e:TrafficEngine) {
 const a=e.snapshot(),r=a.resources,ships=a.current.ships;
 const cargo=r.stocks.reduce((n,p)=>n+p.cargo,0)+ships.reduce((n,s)=>n+s.logistics!.cargoMass,0)+r.cargoExported-r.cargoImported;
 const fuel=r.stocks.reduce((n,p)=>n+p.propellant,0)+ships.reduce((n,s)=>n+s.propellant+s.fuelUsed!,0)+r.fuelExported-r.fuelImported;
 assert.ok(Math.abs(cargo-d.stations.reduce((n,p)=>n+p.cargo,0))<1e-10);
 assert.ok(Math.abs(fuel-d.stations.reduce((n,p)=>n+p.propellant,0)-d.vessels.reduce((n,v)=>n+v.propellant,0))<1e-10);
}

test('surface service domain is explicit and rejects uncalibrated hardware, targets and extra ships',()=>{
 for(const change of [(v:TrafficDefinition)=>delete v.domain,(v:TrafficDefinition)=>v.world.scenario.ship.engine!.maxThrust=4,(v:TrafficDefinition)=>v.vessels.push({...v.vessels[0],id:'other'}),(v:TrafficDefinition)=>v.templates[0].arcs.pop()]){const v=structuredClone(d);change(v);assert.throws(()=>validateTraffic(v));}
});
test('support prelude remains private; exact launch/arrival survives last admissible calendar window',()=>{
 for(const template of d.templates) {
  const period=2*Math.PI/Math.abs(.7155417527999327-.003),last=Math.floor((CALENDAR_LIMIT-template.duration-template.referenceDeparture)/period);
  const w=nextWindow(d,template,0,last),e=admitEpisode(d,template,'swift',0,0,w,template.cargo,template.propellant);
  assert.equal(e.arrival,w.departure+template.duration);assert.equal(localAt(e,e.arrival),e.captureLocalEpoch);
  for(const local of e.localEpochs)assert.equal(localAt(e,e.departure+local),local);
  assert.throws(()=>nextWindow(d,template,0,last+1),/Calendar/);assert.ok(e.facts.every(f=>f.t>=0));
  const capture=e.facts.find(f=>f.id===e.arrivalOperationId)!;assert.ok(capture.positionError!+1e-8<1e-7);assert.ok(capture.deltaV+1e-8<1e-7);
  if(template.source==='Cairn') {
   assert.equal(e.bundle.scenario.epoch,-d.world.scenario.policy.step);assert.equal(e.runner.ledger[0].t,e.bundle.scenario.epoch);
   assert.deepEqual(e.facts.filter(f=>f.t===0).map(f=>f.kind),['launch','thrust-start']);
   const actual=e.runner.sample(0),target=portState(d.world.scenario.logistics!.ports[0],w.departure);
   assert.ok(Math.hypot(...actual.y.map((x,i)=>x-target[i]))<1e-12);assert.equal(actual.propellant,template.propellant);
  } else assert.equal(capture.kind,'land');
 }
});
test('recurring launches/landings conserve real service resources and exact berth/event ownership',()=>{
 const e=new TrafficEngine(d);advance(e,48);conservation(e);const p=e.delta(),events=p.events;
 assert.ok(e.snapshot().ships[0].voyage>=6);assert.ok(events.every(f=>f.t>=0));
 assert.equal(events.filter(f=>f.kind==='dock'&&f.portId==='Cairn').length,1);
 assert.equal(events.filter(f=>f.kind==='undock'&&f.portId==='Cairn').length,0);
 const launch=events.find(f=>f.kind==='launch')!;assert.deepEqual(events.filter(f=>f.t===launch.t).map(f=>f.kind),['transfer','launch','thrust-start']);
 for(const landing of events.filter(f=>f.kind==='land')) {
  assert.deepEqual(events.filter(f=>f.t===landing.t).map(f=>f.kind),['thrust-end','land','transfer-start']);
  assert.equal(landing.localEpoch,d.templates[1].duration);
  assert.ok(landing.fuelUsed>0);
 }
 const ids=events.filter(f=>f.kind==='transfer').map(f=>f.id);assert.equal(new Set(ids).size,ids.length);
 const store=new TrafficViewStore(d);store.ingest(p);
 const arrival=events.find(f=>f.kind==='land')!.t;
 assert.equal(sampleVessel(store.view(arrival-1e-8).vessels[0],arrival-1e-8).logistics?.dockedPortId,undefined);
 assert.equal(sampleVessel(store.view(arrival).vessels[0],arrival).logistics?.dockedPortId,'Cairn');
 assert.equal(sampleVessel(store.view(arrival).vessels[0],arrival).logistics?.service?.portId,'Cairn');
});
test('fleet partitions, dense drawing queries and backward views cannot alter physics',()=>{
 const a=new TrafficEngine(d),b=new TrafficEngine(d);advance(a,40);
 const store=new TrafficViewStore(d);store.ingest(b.delta());
 for(const t of [.3,.300001,1.7207514043249135,9.986868695074584,17,28.1,40]) {const after=b.frontier;advance(b,t,7);store.ingest(b.delta(after));for(const q of [0,Math.max(0,t-.1),t])sampleVessel(store.view(q).vessels[0],q);conservation(b);}
 assert.deepEqual(b.snapshot(),a.snapshot());
});
test('failed launch admission and stock shortage retry without free release or repeated service charges',()=>{
 const bad=structuredClone(d);bad.templates[0].arcs[0].direction=[0,-1,0];
 const e=new TrafficEngine(bad);advance(e,32);conservation(e);const events=e.delta().events;
 assert.ok(events.filter(e=>e.kind==='planning-failed').length>=3);assert.equal(events.filter(e=>e.kind==='transfer').length,1);assert.equal(events.filter(e=>e.kind==='launch').length,0);assert.equal(e.snapshot().current.ships[0].logistics?.dockedPortId,'Cairn');
 const scarce=structuredClone(d);scarce.stations[0].propellant=0;scarce.stations[0].propellantRate=.025;
 const wait=new TrafficEngine(scarce);advance(wait,64);assert.ok(wait.delta().events.some(e=>e.kind==='planning-failed'));assert.ok(wait.snapshot().ships[0].voyage>=2);
});
test('divergent execution history uses its paid actual prefix while old cursors retain their original forecast',()=>{
 let actual:Runner|undefined;
 const e=new TrafficEngine(d,{episodeAdapter:episode=>{const b=structuredClone(episode.bundle);b.program.thrustArcs![0].throttle=.9;actual=new Runner(b);return actual;}});
 advance(e,40);const state=e.snapshot();assert.equal(state.ships[0].stage,'fault');assert.ok(state.ships[0].used>0);conservation(e);
 const store=new TrafficViewStore(d);store.ingest(e.delta());const view=store.view(.35),sample=sampleVessel(view.vessels[0],.35),expected=actual!.sample(.35-.3);
 assert.ok(Math.hypot(...sample.y.map((x,i)=>x-expected.y[i]))<2e-7);assert.ok(Math.abs(sample.propellant-expected.propellant)<1e-7);assert.equal(sample.thrust?.force,4.5);
 assert.ok(view.vessels[0].ledger.some(f=>f.kind==='dock'&&f.portId==='Lantern'&&f.t>.35));
 const final=store.view(40);assert.equal(sampleVessel(final.vessels[0],40).activity?.kind,'fault');assert.throws(()=>stateAt(final.vessels[0],40),/no state/);
 assert.ok(state.resources.fuelImported>1);
});
test('missing designated arrival faults once instead of spinning the global event queue',()=>{
 const e=new TrafficEngine(d,{episodeAdapter:episode=>{const b=structuredClone(episode.bundle);b.program.operations=b.program.operations!.filter(o=>o.id!==episode.arrivalOperationId);return new Runner(b);}});advance(e,8);
 assert.equal(e.snapshot().ships[0].stage,'fault');assert.equal(e.delta().events.filter(e=>e.kind==='fault').length,1);assert.ok(e.snapshot().ships[0].used>0);
});
test('rolling dense coverage stays bounded after eviction and one held pending reply',()=>{
 const e=new TrafficEngine(d),store=new TrafficViewStore(d);store.ingest(e.delta());
 for(let t=8;t<=160;t+=8){const after=e.frontier;advance(e,t);store.ingest(e.delta(after));conservation(e);assert.ok(e.delta(t).stats.denseSamples<=DENSE_SAMPLE_BUDGET);}
 assert.equal(store.oldest,32);assert.ok(store.episodes.length<=16);assert.throws(()=>store.view(31.999),/outside/);
 const cursor=store.oldest,after=e.frontier;advance(e,161);store.ingest(e.delta(after),true);assert.equal(store.oldest,cursor);assert.doesNotThrow(()=>store.view(cursor));store.release();assert.equal(store.oldest,33);
 const historical=store.view(80.123);assert.ok(historical.vessels[0].samples.length<12000);assert.ok(store.view(33).vessels[0].samples.length<12000);
});
