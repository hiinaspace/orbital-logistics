import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareAtmosphericMission,validateAtmosphericMission} from '../../src/model-set/atmospheric-mission';
import {atmosphericStateAt,prepareAtmosphericLeg} from '../../src/sim/atmospheric-propulsion';
import {sampleVessel,stockAt,isPresent} from '../../src/model-set/model';
import {massLaw,massAt} from '../../src/sim/propulsion';
const fixture=()=>JSON.parse(readFileSync('fixtures/model-sets/aster-launch.json','utf8'));
const run=prepareAtmosphericMission(fixture());
test('atmospheric ascent accounts for drag while both engines obey independent fuel laws',()=>{
 const d=structuredClone(run.stack.definition);d.atmosphere.density=0;const vacuum=prepareAtmosphericLeg(d);
 const actual=atmosphericStateAt(run.stack,d.end),free=atmosphericStateAt(vacuum,d.end);
 assert.ok(Math.hypot(...actual.slice(0,6).map((x,i)=>x-free[i]))>.001);
 assert.ok(run.stack.maxima.pressure>2);assert.ok(run.stack.maxima.acceleration<=3+1e-12);
 const s=d.scenario,law=massLaw(s.ship.engine!,d.arcs[0],s.ship.dryMass+s.ship.cargoMass,s.ship.propellant,s.ship.exhaustVelocity);
 assert.ok(Math.abs(actual[6]-(massAt(law,d.end)-law.nonfuel))<2e-9);
 assert.ok(run.stack.nodes.some(n=>n.t===law.capEpoch));
 assert.equal(actual[6],free[6]); // drag consumes momentum, never propellant directly
});
test('zero-kick separation conserves wet mass, momentum, freight and reserved upper tank',()=>{
 const d=run.definition,split=d.separation.t,record=run.view.staging!.separation,p=run.view.vessels[0],b=run.view.vessels[1],u=run.view.vessels[2];
 assert.equal(isPresent(p,split),false);assert.equal(isPresent(b,split),true);assert.equal(isPresent(u,split),true);
 assert.deepEqual(sampleVessel(b,split).y,record.state);assert.deepEqual(sampleVessel(u,split).y,record.state);
 assert.equal(sampleVessel(u,split).propellant,d.payload.propellant);
 assert.ok(Math.abs(record.beforeMass-record.afterMass)<1e-12);assert.deepEqual(record.momentumBefore,record.momentumAfter);
 assert.equal(sampleVessel(b,split).logistics!.cargoMass,0);assert.equal(sampleVessel(u,split).logistics!.cargoMass,.1);
});
test('station service transfers freight exactly once, undocks actual fuel and both ocean recoveries retain their tanks',()=>{
 const d=run.definition,u=run.view.vessels[2],arrival=d.programs.payload.operations![0].t,unload=arrival+.3,departure=d.programs.payload.operations![2].t;
 assert.ok(run.capture.deltaV+1e-8<1e-7);assert.ok(run.capture.positionError+1e-8<1e-7);
 assert.equal(sampleVessel(u,arrival).logistics!.dockedPortId,'Lantern');
 const boundary=u.boundaries.find(b=>b.t===unload)!;assert.equal(boundary.before.logistics!.cargoMass,.1);assert.equal(boundary.after.logistics!.cargoMass,0);
 assert.ok(Math.abs(boundary.before.mass!-boundary.after.mass!-.1)<1e-12);assert.equal(boundary.before.propellant,boundary.after.propellant);
 assert.equal(sampleVessel(u,departure).propellant,run.capture.propellantAfter);assert.equal(sampleVessel(u,departure).logistics!.dockedPortId,undefined);
 assert.equal(u.ledger.filter(e=>e.kind==='transfer').length,1);assert.equal(stockAt(run.view,12).find(s=>s.id==='Lantern')!.cargo,.1);
 assert.ok(stockAt(run.view,12).every(s=>s.occupied===0));
 for(const v of run.view.vessels.slice(1)){
  const t=v.entry!.recovery.t,b=v.boundaries.find(b=>b.t===t)!;
  assert.deepEqual(b.before.y.slice(0,3),b.after.y.slice(0,3));assert.equal(b.before.propellant,b.after.propellant);
  assert.ok(b.after.propellant>.15);assert.equal(sampleVessel(v,t).thrust,undefined);assert.equal(sampleVessel(v,t).entryPhase,'recovered');
  assert.equal(sampleVessel(v,12).propellant,b.after.propellant);
 }
});
test('phase-scoped drawing preserves ascent thrust, unloaded recovery mass, clone and rewind',()=>{
 const u=run.view.vessels[2],copy=structuredClone(u),t=1.05;
 assert.equal(sampleVessel(u,t).thrust!.id,'insertion');assert.equal(sampleVessel(u,t).entryPhase,undefined);
 const onReturn=sampleVessel(u,7);assert.ok(Math.abs(onReturn.mass!-(.25+onReturn.propellant))<1e-14);
 const before=JSON.stringify(run.view),epochs=[1.05,1.8,3.9145470726907767,4.5,7,9,12];
 const samples=epochs.map(t=>sampleVessel(u,t));
 for(const t of [...epochs].reverse())assert.deepEqual(sampleVessel(copy,t),samples[epochs.indexOf(t)]);
 assert.equal(JSON.stringify(run.view),before);
 assert.ok(run.work.nodes<40000&&run.work.bytes<12000000&&run.work.evaluations<2097152);
});
test('unsupported physics, impulses, spin mismatch and conflicting manifests reject',()=>{
 for(const change of [(d:any)=>d.ascentAero.dragCoefficient=1,(d:any)=>d.booster.state=[1,0,0,0,0,0],(d:any)=>d.atmosphere.spin[2]=.04,(d:any)=>d.programs.payload.operations[1].cargo=-.2,(d:any)=>d.separation.kick=[.1,0,0]]){
  const d=fixture();change(d);assert.throws(()=>validateAtmosphericMission(d));
 }
});
test('a changed atmosphere cannot silently reuse a vacuum insertion, and load failures do not publish partial state',()=>{
 const d=fixture();d.atmosphere.density*=2;const before=JSON.stringify(d);
 assert.throws(()=>prepareAtmosphericMission(d),/Capture|capture/);assert.equal(JSON.stringify(d),before);
 const load=fixture();load.limits.dynamicPressure=.001;assert.throws(()=>prepareAtmosphericMission(load),/load limit/);
 const speed=fixture();speed.recovery.maxSpeed=.001;assert.throws(()=>prepareAtmosphericMission(speed),/recovery speed/);
});
