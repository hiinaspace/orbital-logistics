import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/model-sets/aster-selene-crossings.json';
import {ExpeditionFleetEngine,type ExpeditionFleetDefinition} from '../../src/expedition/fleet';
import {ExpeditionFleetViewStore} from '../../src/expedition/fleet-view';
import {sampleVessel,stateAt,stockAt} from '../../src/model-set/model';
import {portState} from '../../src/sim/logistics';
import {bodyState,derivative} from '../../src/sim/dynamics';
import {rotate,rotateState} from '../../src/expedition/query';
import {OrbiterStream} from '../../src/expedition/orbiter';
import {Runner} from '../../src/sim/runner';
test('two expeditions share compilation, preserve shifted seams and independently fund tanks',()=>{
 const e=new ExpeditionFleetEngine(fixture as ExpeditionFleetDefinition),store=new ExpeditionFleetViewStore(e.definition),p=e.schedules[1],delta=p.instance!.epochOffset;
 e.advanceTo(0);const initial=e.delta();store.ingest(initial);assert.ok(initial.template);assert.equal(initial.stats.cacheCompilations,1);
 const waiting=e.sample(1,0);assert.equal(waiting.propellant,6);assert.equal(waiting.fuelUsed,0);assert.equal(waiting.logistics?.dockedPortId,'Farpoint');assert.deepEqual(waiting.y,portState(p.pad,0));
 const field=e.seed.prepared.definition.scenario.bodies;
 for(const t of [.3,4,22,38.7,65,82]){
  const actual=e.sample(1,delta+t),canonical=e.seed.prepared.sample(t);
  assert.ok(Math.max(...actual.y.map((x,i)=>Math.abs(x-rotateState(canonical.y,p.instance!.rotationOffset)[i])))<1e-12);
  for(const b of field)assert.ok(Math.max(...bodyState(b,delta+t).map((x,i)=>Math.abs(x-rotateState(bodyState(b,t),p.instance!.rotationOffset)[i])))<1e-13);
  const g=derivative(e.seed.prepared.definition.scenario,delta+t,actual.y).slice(3),base=rotate(derivative(e.seed.prepared.definition.scenario,t,canonical.y).slice(3),p.instance!.rotationOffset);
  assert.ok(Math.max(...g.map((x,i)=>Math.abs(x-base[i])))<1e-12);
 }
 for(let t=1;t<=360;t++){
  e.advanceTo(t);const packet=e.delta();assert.equal(packet.template,undefined);store.ingest(packet);
  const fuel=packet.current.reduce((n,q)=>n+q.propellant+q.fuelUsed!,0);
  assert.ok(Math.abs(12+packet.resources.at(-1)!.fuelImported-fuel)<1e-10);
  const physical=e.orbiter.sample(t);assert.equal(physical.t,t);
  if(t%16===0){const view=store.view(t);
   assert.equal(view.vessels.length,3);assert.ok(view.traffic!.stats.viewCycles<=8);
   assert.ok(stockAt(view,t).every(q=>q.occupied<=1));
   for(const v of view.vessels.slice(0,2)){for(const b of v.boundaries)assert.ok(v.samples.some(q=>q.t===b.t));const i=e.definition.actors.findIndex(a=>a.id===v.id),q=sampleVessel(v,t);
    assert.ok(Math.max(...q.y.map((x,j)=>Math.abs(x-e.sample(i,t).y[j])))<3e-6);
   }
  }
 }
 const heldAt=store.frontier-80,held=store.view(heldAt).vessels.map(v=>sampleVessel(v,heldAt));
 e.advanceTo(361);store.ingest(e.delta(),true);assert.deepEqual(store.view(heldAt).vessels.map(v=>sampleVessel(v,heldAt)),held);store.release();
 const v=store.view(361).vessels[1],refill=delta+3*p.period-p.refuelLead;
 // Query the forecast exact indexed refill and its physical left state.
 assert.equal(e.sample(1,refill).propellant,6);assert.equal(e.sample(1,refill,true).propellant,6-p.spent);
 assert.equal(v.expedition!.instance!.id,'Argosy');
 const entry=e.seed.prepared.view.vessels[0].entry!;
 for(const [actor,cycle] of [[0,1],[1,10]]){
  const schedule=e.schedules[actor],offset=schedule.instance!.epochOffset+cycle*schedule.period;
  assert.equal(e.sample(actor,offset+entry.brakingEpoch).entryPhase,'braking');
  assert.equal(e.sample(actor,offset+entry.entryEpoch).entryPhase,'entry');
  assert.equal(e.sample(actor,offset+(schedule.recovery+2)).opacity,0);
 }
 const hide=delta+p.period+(p.recovery+2);assert.equal(e.sample(1,hide).opacity,0);

 const head=e.frontier,imports=e.delta().resources;assert.throws(()=>e.advanceTo(head+9),/budget/);assert.equal(e.frontier,head);assert.deepEqual(e.delta().resources,imports);
});
test('local coast chunks are request independent and isolate a fault while expeditions continue',()=>{
 const d=fixture as ExpeditionFleetDefinition,scenario=d.source.source.scenario,top=scenario.bodies[0].radius+d.source.source.entry.atmosphere.topHeight;
 const a=new OrbiterStream(scenario,d.orbiter,top),b=new OrbiterStream(scenario,d.orbiter,top);
 a.extend(16);for(let t=1;t<=16;t++)b.extend(t);assert.deepEqual(a.sample(16),b.sample(16));
 const s=structuredClone(scenario);s.epoch=0;s.duration=16;s.policy={step:1/256,maxNodes:8192,maxSubdivision:20};s.bodies[0].radius=top;s.ship={id:d.orbiter.id,state:d.orbiter.state,dryMass:1,cargoMass:0,propellant:0,tankCapacity:0,exhaustVelocity:1};
 const continuous=new Runner({scenario:s,program:{schemaVersion:3,id:'uninterrupted',burns:[]}});
 assert.ok(Math.max(...a.sample(16).y.map((x,i)=>Math.abs(x-continuous.sample(16).y[i])))<1e-13);
 const fine=structuredClone(s);fine.policy.step=1/512;fine.policy.maxNodes=16384;
 const oracle=new Runner({scenario:fine,program:{schemaVersion:3,id:'fine',burns:[]}});
 assert.ok(Math.max(...a.sample(16).y.map((x,i)=>Math.abs(x-oracle.sample(16).y[i])))<1e-8);
 const fault=structuredClone(d);fault.orbiter.state=[1.01,0,0,0,0,0];const engine=new ExpeditionFleetEngine(fault),store=new ExpeditionFleetViewStore(fault);
 engine.advanceTo(32);store.ingest(engine.delta());for(let t=40;t<=200;t+=8){engine.advanceTo(t);store.ingest(engine.delta());}
 assert.equal(engine.halt,undefined);const view=store.view(200),ship=view.vessels[2];assert.equal(sampleVessel(ship,200).activity?.knownEpoch,0);assert.throws(()=>stateAt(ship,200),/no state/);assert.throws(()=>engine.orbiter.sample(200),/after fault/);
 assert.ok(view.traffic!.stats.refills>=2);assert.ok(view.traffic!.stats.completedTrips>=2);
 const overlap=structuredClone(d);overlap.actors[1].phase=.001;assert.throws(()=>new ExpeditionFleetEngine(overlap),/Invalid expedition fleet/);
});
