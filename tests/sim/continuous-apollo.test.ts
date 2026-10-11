import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/model-sets/aster-selene-service.json';
import {ExpeditionEngine,type ExpeditionDefinition} from '../../src/expedition/engine';
import {ExpeditionViewStore} from '../../src/expedition/view';
import {sampleVessel,stateAt,stockAt} from '../../src/model-set/model';
import {portState} from '../../src/sim/logistics';
import {rotateState} from '../../src/expedition/query';
test('continuous expedition reuses physical cache with paid turnover and bounded rewind',()=>{
 const e=new ExpeditionEngine(fixture as ExpeditionDefinition),p=e.schedule,store=new ExpeditionViewStore(e.definition);
 e.advanceTo(32);const initial=e.delta();assert.ok(initial.template);store.ingest(initial);
 const before=p.period-2-1e-7,refuel=p.period-2;
 for(const t of [p.recovery+1.5,p.recovery+2.5,p.recovery+4.5,before,refuel,p.period+.5,2*p.period+22]){
  e.advanceTo(t);const packet=e.delta();assert.equal(packet.template,undefined);assert.ok(packet.stats.packetBytes<15000);
  store.ingest(packet);const v=store.view(t).vessels[0],q=sampleVessel(v,t),actual=e.sample(t);
  assert.ok(Math.max(...q.y.map((x,i)=>Math.abs(x-actual.y[i])))<3e-6);
  assert.ok(Math.abs(q.propellant-actual.propellant)<1e-6);
  assert.deepEqual(stateAt(v,t),q.y);
  const imported=packet.resources.at(-1)!.fuelImported;
  assert.ok(Math.abs(p.fuel+imported-actual.propellant-actual.fuelUsed!)<1e-10);
  assert.ok(stockAt(store.view(t),t).every(s=>s.occupied>=0&&s.occupied<=1));
 }
 assert.ok(e.sample(p.recovery+1.5).opacity!<1);
 assert.equal(e.sample(p.recovery+2.5).opacity,0);
 assert.equal(e.sample(p.recovery+4.5).logistics?.dockedPortId,p.pad.id);
 const transport=p.recovery+p.transport;
 assert.equal(e.sample(transport,true).logistics?.dockedPortId,undefined);
 assert.equal(e.sample(transport).logistics?.dockedPortId,p.pad.id);
 assert.equal(e.sample(p.recovery+3).frameOrigin?.[0],e.sample(p.recovery+5).frameOrigin?.[0]);
 assert.equal(e.sample(before).propellant,p.fuel-p.spent);
 assert.equal(e.sample(refuel).propellant,p.fuel);
 assert.equal(e.sample(refuel,true).propellant,p.fuel-p.spent);
 assert.ok(Math.max(...e.sample(p.period+.5).y.map((x,i)=>Math.abs(x-rotateState(e.prepared.sample(.5).y,p.angle)[i])))<1e-12);
 const heldEpoch=e.frontier-10,held=sampleVessel(store.view(heldEpoch).vessels[0],heldEpoch);
 e.advanceTo(e.frontier+1);store.ingest(e.delta(),true);
 assert.deepEqual(sampleVessel(store.view(heldEpoch).vessels[0],heldEpoch),held);
 store.release();
 for(let t=e.frontier+512;t<17000;t+=512){e.advanceTo(t);store.ingest(e.delta());const view=store.view(t);
  assert.ok(view.traffic!.stats.viewCycles<=4);
  for(const b of view.vessels[0].boundaries)assert.ok(view.vessels[0].samples.some(q=>q.t===b.t));assert.ok(view.vessels[0].samples.length<=110000);
  assert.ok(view.traffic!.resources.length<=4);assert.ok(e.delta().events.length<=2);
 }
 const epoch=e.frontier,view=store.view(epoch),v=view.vessels[0];
 assert.ok(epoch>100*p.period);assert.equal(e.delta().stats.cacheCompilations,1);
 const old=Math.max(view.window.start,Math.floor(epoch/p.period)*p.period-10);
 assert.deepEqual(sampleVessel(v,old),sampleVessel(store.view(old).vessels[0],old));
 const recovery=Math.floor(epoch/p.period)*p.period+p.recovery;
 if(recovery<=view.window.end){const q=sampleVessel(v,recovery+.5);assert.equal(q.entryPhase,'recovered');}
 assert.throws(()=>store.view(store.oldest-1),/Cursor outside/);
 assert.throws(()=>e.advanceTo(epoch+5000),/budget/);
 const late=e.sample(9000*p.period+.5);
 assert.ok(Math.max(...late.y.map((x,i)=>Math.abs(x-rotateState(e.prepared.sample(.5).y,(9000*p.angle)%(2*Math.PI))[i])))<1e-8);
 const fineResources=e.delta().resources.at(-1)!;
 const finiteHead=e.frontier;assert.throws(()=>e.advanceTo(finiteHead+5000));assert.deepEqual(e.delta().resources.at(-1),fineResources);
 for(let t=e.frontier+4096;t<p.maxEpoch;t+=4096)e.advanceTo(t);
 e.advanceTo(p.maxEpoch);store.ingest(e.delta());const terminal=store.view(p.maxEpoch);
 assert.equal(terminal.window.end,p.maxEpoch);assert.equal(terminal.traffic!.halt,'Exhibit calendar ended');
 const contact=e.sample(p.recovery+p.transport+1).y;
 assert.deepEqual(contact,portState(p.pad,p.recovery+p.transport+1));
});
test('unsupported symmetry and undersupplied turnaround refuse before publication',()=>{
 const d=structuredClone(fixture) as ExpeditionDefinition;d.source.entry.atmosphere.spin[0]=.01;
 assert.throws(()=>new ExpeditionEngine(d),/symmetry/);
 const short=structuredClone(fixture) as ExpeditionDefinition;short.maxImport=3;assert.throws(()=>new ExpeditionEngine(short),/supply budget/);
});
