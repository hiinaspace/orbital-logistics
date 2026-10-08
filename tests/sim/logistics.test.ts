import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Runner } from '../../src/sim/runner';
import { validateBundle } from '../../src/sim/schema';
import { logisticsResult } from '../../src/sim/logistics';
import { predict } from '../../src/planning/predict';
import { EditorSession } from '../../src/editor/session';
const fixture = (name = 'm3-round-trip') => validateBundle(JSON.parse(readFileSync(new URL(`../../fixtures/${name}.json`, import.meta.url), 'utf8')));

test('round trip delivers finite cargo, refuels, returns empty and reconciles every resource', () => {
  const b = fixture(), runner = new Runner(b), end = runner.advanceTo(24), l = end.logistics!, spec = b.scenario.logistics!;
  assert.equal(end.status, 'horizon'); assert.equal(logisticsResult(spec,l,end.propellant).complete,true);
  assert.equal(l.cargoMass,0); assert.deepEqual(l.ports.map(p => p.cargo),[0.8,0.2]);
  const initialCargo = spec.ports.reduce((s,p) => s+p.cargo, b.scenario.ship.cargoMass);
  assert.equal(l.ports.reduce((s,p) => s+p.cargo,l.cargoMass),initialCargo);
  const initialFuel = spec.ports.reduce((s,p) => s+p.propellant,b.scenario.ship.propellant);
  const fuelUsed = runner.ledger.reduce((s,e) => s+e.fuelUsed,0);
  assert.ok(Math.abs(end.propellant+l.ports.reduce((s,p)=>s+p.propellant,0)+fuelUsed-initialFuel)<1e-14);
  assert.ok(Math.abs(l.fuelUsed-fuelUsed)<1e-14); assert.ok(fuelUsed>0.13);
  assert.equal(runner.ledger.filter(e=>e.kind==='transfer').length,2);
  assert.equal(runner.ledger.filter(e=>e.kind==='burn').length,4);
  assert.ok(runner.ledger.filter(e=>e.kind==='dock').every(e=>e.deltaV<spec.capture.velocity));
});
test('load/unload commits only at service completion; undock and burn then use the new cargo mass', () => {
  const b=fixture(), runner=new Runner(b);
  const started=runner.sample(0); assert.equal(started.logistics!.cargoMass,0); assert.equal(started.logistics!.ports[0].cargo,1); assert.equal(started.logistics!.service!.end,0.25);
  assert.equal(runner.sample(0.249).logistics!.cargoMass,0);
  assert.equal(runner.sample(0.25).logistics!.cargoMass,0.2);
  const outbound=runner.advanceTo(0.5), burn=runner.ledger.find(e=>e.id==='outbound')!;
  const expected=(b.scenario.ship.dryMass+0.2+b.scenario.ship.propellant)*-Math.expm1(-burn.deltaV/b.scenario.ship.exhaustVelocity);
  assert.ok(Math.abs(burn.fuelUsed-expected)<1e-14); assert.equal(outbound.logistics!.dockedPortId,undefined);
  assert.deepEqual(runner.ledger.filter(e=>e.t===0.5).map(e=>e.kind),['undock','burn']);
});
test('mistimed capture and early departure stop atomically with readable diagnostics', () => {
  const missed=fixture(); missed.program.operations!.find(o=>o.id==='dock-depot')!.t-=0.1;
  const a=new Runner(missed), stop=a.advanceTo(24); assert.equal(stop.status,'operation-rejected'); assert.match(stop.detail,/Capture Depot: miss/);
  assert.equal(stop.logistics!.ports[1].cargo,0); assert.equal(a.ledger.filter(e=>e.kind==='transfer').length,1);
  const early=fixture(); early.program.operations!.find(o=>o.id==='leave-home')!.t=0.1;
  const b=new Runner(early), failed=b.advanceTo(24); assert.equal(failed.status,'operation-rejected'); assert.match(failed.detail,/Service load finishes/);
  assert.equal(failed.logistics!.cargoMass,0); assert.equal(failed.propellant,early.scenario.ship.propellant);
});
test('over-capacity, exhausted stocks, duplicate transfers and burn while docked are rejected', () => {
  for (const kind of ['capacity','stock','duplicate','docked-burn'] as const) {
    const b=fixture();
    if(kind==='capacity') Object.assign(b.program.operations![1],{cargo:0.3});
    if(kind==='stock') b.scenario.logistics!.ports[0].cargo=0.1;
    if(kind==='duplicate') b.program.operations!.splice(2,0,{id:'duplicate',kind:'transfer',t:0.1,portId:'Home',cargo:0.2,propellant:0});
    if(kind==='docked-burn') b.program.operations=b.program.operations!.filter(o=>o.id!=='leave-home');
    const runner=new Runner(b), end=runner.advanceTo(24); assert.equal(end.status,'operation-rejected',kind);
    assert.ok(end.logistics!.ports.every(p=>p.cargo>=0&&p.propellant>=0));
    assert.equal(end.logistics!.ports[1].cargo,0);
  }
});
test('delivery alone, depleted return fuel and cargo left onboard do not satisfy reusable return', () => {
  const outbound=fixture('m3-delivery'), a=new Runner(outbound).sample(24);
  assert.match(logisticsResult(outbound.scenario.logistics!,a.logistics!,a.propellant).reason,/Return to Home/);
  const low=fixture(); low.scenario.logistics!.objective.minPropellant=0.3;
  const b=new Runner(low).sample(24); assert.match(logisticsResult(low.scenario.logistics!,b.logistics!,b.propellant).reason,/Return fuel/);
  const l=structuredClone(b.logistics!); l.cargoMass=0.01;
  assert.equal(logisticsResult(low.scenario.logistics!,l,0.4).complete,false);
  // Delivery is net inventory gained at the sink, not a counter exploitable by reload/unload.
  l.ports[1].cargo=0; assert.equal(logisticsResult(low.scenario.logistics!,l,0.4).delivered,0);
});
test('capture residual is charged and tightening the interface preserves the known solution', () => {
  const b=fixture(); b.scenario.ship.state[3]=1e-6;
  const runner=new Runner(b), first=runner.current, dock=runner.ledger[0];
  assert.equal(dock.kind,'dock'); assert.equal(dock.deltaV,1e-6); assert.ok(dock.fuelUsed>0);
  assert.ok(first.propellant<b.scenario.ship.propellant);
  const tight=fixture(); tight.scenario.logistics!.capture={position:1e-8,velocity:1e-8};
  assert.equal(new Runner(tight).sample(24).status,'horizon');
  assert.equal(predict(tight,0,24,true).accuracy!.status,'converged');
});
test('warp, display queries, save/reload and undo preserve physical and discrete event results', () => {
  const b=fixture(), direct=new Runner(b), expected=direct.advanceTo(24);
  const partitioned=new Runner(b);
  for(let t=0;t<24;t+=0.137){partitioned.sample(Math.min(24,t+0.06));partitioned.advanceTo(t);}
  assert.deepEqual(partitioned.advanceTo(24),expected);assert.deepEqual(partitioned.ledger,direct.ledger);
  for(const t of [0,0.1,0.25,0.5,4.7,15.6,20]){
    const runner=new Runner(b);runner.advanceTo(t);const saved=Runner.restore(b,runner.snapshot());
    assert.deepEqual(saved.advanceTo(24),expected);assert.deepEqual(saved.ledger,direct.ledger);
  }
  const editor=new EditorSession(b), original=editor.draft;
  const changed=editor.draft;changed.operations=changed.operations!.filter(o=>o.id!=='return-home');editor.change(changed);
  editor.undo();assert.deepEqual(editor.draft,original);editor.redo();assert.deepEqual(editor.draft,changed);
  editor.undo();editor.execute();editor.execution.advanceTo(24);
  const restored=EditorSession.deserialize(editor.serialize(19)).session;assert.deepEqual(restored.execution.current,expected);
  assert.deepEqual(restored.execution.ledger,direct.ledger);
});
test('operation JSON validates duration, identity, finite stock and simultaneous ordering', () => {
  const b=fixture(), bad:any=structuredClone(b);bad.program.operations[1].cargo=Infinity;assert.throws(()=>validateBundle(bad));
  bad.program.operations[1].cargo=0.2;bad.program.operations[1].t=24;assert.throws(()=>validateBundle(bad));
  const duplicate=fixture();duplicate.program.operations![1].id='outbound';assert.throws(()=>validateBundle(duplicate));
  const rail=fixture();rail.scenario.logistics!.ports[1].rail.rate=0;assert.throws(()=>validateBundle(rail));
  const clearance=fixture();clearance.scenario.bodies[0].radius=1-1e-6;assert.throws(()=>validateBundle(clearance));
});
test('a missing arrival impulse cannot be supplied by docking, and capture fuel failure is atomic', () => {
  const b=fixture();b.program.burns=b.program.burns.filter(b=>b.id!=='arrival');
  const failed=new Runner(b).sample(24);assert.equal(failed.status,'operation-rejected');assert.match(failed.detail,/Capture Depot.*speed/);
  assert.equal(failed.logistics!.ports[1].cargo,0);
  const empty=fixture();empty.scenario.ship.propellant=0;empty.scenario.ship.state[3]=1e-6;
  const runner=new Runner(empty), stop=runner.current;assert.equal(stop.status,'operation-rejected');assert.match(stop.detail,/fuel for capture/);
  assert.deepEqual(stop.y,empty.scenario.ship.state);assert.equal(stop.propellant,0);assert.equal(stop.logistics!.dockedPortId,undefined);
});
test('refueling checks finite stock and tank room; no future action can hide a failed plan', () => {
  for(const value of [0.3,0.6]) {
    const b=fixture();const transfer=b.program.operations!.find(o=>o.id==='unload-refuel')!;
    if(transfer.kind==='transfer')transfer.propellant=value;
    const runner=new Runner(b), stop=runner.sample(24);assert.equal(stop.status,'operation-rejected');
    assert.equal(stop.logistics!.ports[1].cargo,0);assert.equal(stop.logistics!.ports[1].propellant,0.25);
  }
  const b=fixture();b.program.operations!.push({id:'bad-after-return',t:23,kind:'dock',portId:'Depot'});
  const prediction=predict(b,0,24,true);assert.equal(prediction.terminal.status,'operation-rejected');assert.equal(prediction.logistics!.complete,false);
  const sample=predict(fixture(),0).samples.find(s=>s.t===0.25)!;assert.equal(sample.logistics!.cargoMass,0.2);
});
