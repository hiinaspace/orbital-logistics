import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareSet,validateSet,sampleVessel,stockAt,setEvents,displayPortState,type ModelSet} from '../../src/model-set/model';
import {Runner} from '../../src/sim/runner';
import {validateBundle} from '../../src/sim/schema';
import {resolveBurn} from '../../src/sim/burns';
import {distance,relativeSpeed} from '../../src/sim/vectors';
import {logisticsResult} from '../../src/sim/logistics';
import {transform} from '../../src/model-set/frames';
import {rotated} from '../../scripts/spatial-fixtures';
const set:ModelSet=JSON.parse(readFileSync('fixtures/model-sets/selene-freight.json','utf8'));
const run=prepareSet(set);

test('three paid lunar round trips conserve finite freight and fuel and return home',()=>{
  const events=setEvents(run),ports=run.vessels[0].bundle.scenario.logistics!.ports;
  const cargo=ports.reduce((s,p)=>s+p.cargo,0),fuel=ports.reduce((s,p)=>s+p.propellant,0)+run.vessels.reduce((s,v)=>s+v.bundle.scenario.ship.propellant,0);
  for(const t of new Set([0,12,...events.map(e=>e.t)])) {
    const stocks=stockAt(run,t),ships=run.vessels.map(v=>sampleVessel(v,t));
    assert.ok(Math.abs(stocks.reduce((s,p)=>s+p.cargo,0)+ships.reduce((s,v)=>s+v.logistics!.cargoMass,0)-cargo)<1e-12);
    assert.ok(Math.abs(stocks.reduce((s,p)=>s+p.propellant,0)+ships.reduce((s,v)=>s+v.propellant,0)+events.filter(e=>e.t<=t).reduce((s,e)=>s+e.fuelUsed,0)-fuel)<1e-12);
    assert.ok(stocks.every(s=>s.cargo>=0 && s.propellant>=0 && s.occupied>=0 && s.occupied<=3));
  }
  assert.ok(Math.abs(stockAt(run,12).find(p=>p.id==='Selene Hub')!.cargo-.48)<1e-15);
  for(const v of run.vessels) {
    const last=v.samples.at(-1)!;assert.ok(logisticsResult(v.bundle.scenario.logistics!,last.logistics!,last.propellant,12).complete);
    assert.ok(last.propellant>.05);assert.equal(v.ledger.filter(e=>e.kind==='burn').length,4);
  }
});

test('ballistic stations are canonical safe targets through dock, dwell and undock',()=>{
  const v=run.vessels[0],r=new Runner(v.bundle);r.advanceTo(12);
  for(const boundary of r.eventBoundaries) {
    const undock=v.bundle.program.operations!.find(o=>o.t===boundary.t && o.kind==='undock');
    if(undock) {
      const target=r.portState(undock.portId,boundary.t),burn=v.bundle.program.burns.find(b=>b.t===boundary.t)!;
      assert.equal(distance(boundary.before.y,target),0);assert.equal(relativeSpeed(boundary.before.y,target),0);
      const reference=v.bundle.scenario.bodies.find(b=>b.id===burn.referenceBodyId)!;
      // Cartesian generated burns have no frame/basis ambiguity.
      assert.equal(burn.basis,'inertial-cartesian-v2');
      const dv=resolveBurn(burn,boundary.before.y,boundary.before.y);
      assert.ok(Math.hypot(...dv.map((x,i)=>boundary.after.y[i+3]-boundary.before.y[i+3]-x))<1e-15);
      assert.ok(reference);
    }
  }
  const dock=v.ledger.find(e=>e.id==='dock-selene')!.t,t=dock+.3,port=v.bundle.scenario.logistics!.ports.find(p=>p.id==='Selene Hub')!;
  assert.deepEqual(r.sample(t).y,r.portState(port.id,t));
  assert.deepEqual(sampleVessel(v,t).y,displayPortState(port,run.portSamples,t));
  assert.ok(Math.hypot(...transform(run,sampleVessel(v,t).y,t,port.id))<1e-14);
  assert.throws(()=>r.portState(port.id,12.001),/Epoch outside/);
  const bad=structuredClone(v.bundle);(bad.scenario.logistics!.ports[0].rail as any).validUntil=11;
  assert.throws(()=>validateBundle(bad),/complete scenario/);
  const unsafe=structuredClone(v.bundle);(unsafe.scenario.logistics!.ports[0].rail as any).minClearance=1;
  assert.throws(()=>new Runner(unsafe),/Unsafe ballistic station/);
  const incompatible=structuredClone(set);(incompatible.vessels[1].bundle.scenario.logistics!.ports[0].rail as any).state[0]+=.01;
  assert.throws(()=>validateSet(incompatible),/Incompatible worlds/);
  const state=sampleVessel(v,t);state.y[0]=999;assert.notEqual(sampleVessel(v,t).y[0],999);
});

test('inclined ballistic target capture, departure and replay obey the spatial contract',()=>{
  const b=rotated(run.vessels[0].bundle),r=new Runner(b),end=r.advanceTo(12);
  assert.equal(end.status,'horizon');assert.ok(end.logistics!.dockedPortId);
  assert.deepEqual(Runner.deserialize(r.serialize()).snapshot(),r.snapshot());
  for(const index of [2,5]) {
    const miss=structuredClone(b);miss.scenario.ship.state[index]+=.00002;
    assert.equal(new Runner(miss).current.status,'operation-rejected');
  }
});
