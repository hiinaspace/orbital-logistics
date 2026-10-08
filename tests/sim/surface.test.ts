import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ascent from '../../fixtures/model-sets/selene-ascent.json';
import {Runner} from '../../src/sim/runner';
import {validateBundle,type Bundle} from '../../src/sim/schema';
import {portState} from '../../src/sim/logistics';
import {prepareSet,sampleVessel,stockAt,type ModelSet} from '../../src/model-set/model';
const baseline=validateBundle(ascent.vessels[0].bundle),launch=.3;
function bundle(){return structuredClone(baseline);}
function rejected(b:Bundle,detail?:RegExp){const r=new Runner(b),s=r.advanceTo(launch);assert.equal(s.status,'operation-rejected');assert.equal(s.logistics?.dockedPortId,'Cairn');assert.equal(s.propellant,1.4);assert.equal(s.logistics?.cargoMass,.1);assert.equal(s.logistics?.service,undefined);assert.equal(r.snapshot().anchor.thrustCursor,0);assert.equal(r.snapshot().anchor.logistics?.operationCursor,2);assert.deepEqual(s.y,r.portState('Cairn',launch));assert.ok(!r.ledger.some(e=>e.kind==='launch'||e.kind==='thrust-start'));if(detail)assert.match(s.detail,detail);return r;}
test('supported loading, atomic release, inherited rotation, no instantaneous state/fuel jump',()=>{
 const r=new Runner(baseline);for(const t of [0,.017,.15,.29999]){const s=r.sample(t);assert.deepEqual(s.y,r.portState('Cairn',t));assert.equal(s.propellant,1.2);assert.equal(s.logistics?.cargoMass,0);assert.equal(s.thrust,undefined);}
 const s=r.advanceTo(launch);assert.equal(s.status,'running');assert.equal(s.logistics?.dockedPortId,undefined);assert.deepEqual(s.y,r.portState('Cairn',launch));assert.equal(s.propellant,1.4);assert.equal(s.logistics?.cargoMass,.1);assert.equal(s.thrust?.force,5);
 assert.deepEqual(r.ledger.filter(e=>e.t===launch).map(e=>e.kind),['transfer','launch','thrust-start']);
 assert.equal(r.eventBoundaries.find(e=>e.t===launch)?.before.logistics?.dockedPortId,'Cairn');
 assert.ok(r.sample(.301).y[1]>s.y[1]);
});
test('release rejection uses post-service mass, heading, throttle, acceleration cap and fuel atomically',()=>{
 for(const change of [(b:Bundle)=>b.scenario.ship.engine!.maxThrust=2.4,(b:Bundle)=>b.scenario.ship.engine!.maxAcceleration=.9,(b:Bundle)=>b.program.thrustArcs![0].throttle=0,(b:Bundle)=>b.program.thrustArcs![0].direction=[1,0,0]]){const b=bundle();change(b);rejected(b,/outward/);}
 const empty=bundle();empty.scenario.ship.propellant=0;const load=empty.program.operations!.find(o=>o.kind==='transfer')!;if(load.kind==='transfer')load.propellant=0;
 const r=new Runner(empty),s=r.sample(launch);assert.equal(s.status,'operation-rejected');assert.equal(s.propellant,0);assert.equal(s.logistics?.dockedPortId,'Cairn');assert.ok(!r.ledger.some(e=>e.kind==='launch'));
 const servicing=bundle();servicing.scenario.logistics!.ports[0].serviceDuration=.4;const serviceRunner=new Runner(servicing);assert.equal(serviceRunner.advanceTo(launch).logistics?.dockedPortId,'Cairn');assert.match(serviceRunner.current.detail,/Service/);
});
test('surface interface rejects ordinary undock, later landing, wrong reference and nonexact initial attachment',()=>{
 const undock=bundle();undock.program.operations![2]={id:'depart',kind:'undock',t:launch,portId:'Cairn'};rejected(undock,/powered launch/);
 const wrong=bundle();const op=wrong.program.operations![2];if(op.kind==='launch')op.thrustArcId='pitch-2';assert.throws(()=>validateBundle(wrong),/launch/);
 const late=bundle();late.program.operations!.push({id:'landing',kind:'dock',t:5,portId:'Cairn'});const r=new Runner(late);assert.equal(r.sample(5).status,'operation-rejected');
 const near=bundle();near.scenario.ship.state[0]+=1e-12;assert.match(new Runner(near).current.detail,/exact initial/);
 const exact=bundle();exact.scenario.ship.state=[0,1,0,0,0,0];assert.equal(new Runner(exact).current.status,'collision');
});
test('physical support validation and legacy gates preserve old schemas',()=>{
 for(const field of ['centerHeight','rate','bodyId']){const b=bundle(),rail=b.scenario.logistics!.ports[0].rail; if(rail.kind==='surface'){if(field==='centerHeight')rail.centerHeight=0;if(field==='rate')rail.rate=1;if(field==='bodyId')rail.bodyId='missing';}assert.throws(()=>validateBundle(b));}
 for(const v of [1,2]){const b=JSON.parse(JSON.stringify(baseline));b.scenario.schemaVersion=v;b.scenario.modelVersion=`rk4-canonical-v${v}`;b.program.schemaVersion=v;assert.throws(()=>validateBundle(b),/Surface features/);}
 const b=bundle();b.scenario.logistics!.modelVersion='kinematic-ports-v1';assert.throws(()=>validateBundle(b));
 const shifted=bundle();shifted.scenario.epoch=2;shifted.program.operations!.forEach(o=>o.t+=2);shifted.program.thrustArcs!.forEach(a=>{a.start+=2;a.end+=2;});shifted.scenario.ship.state=portState(shifted.scenario.logistics!.ports[0],2);assert.deepEqual(new Runner(shifted).sample(2.1).y,portState(shifted.scenario.logistics!.ports[0],2.1));
});
test('surface replay partitions/snapshots and before-change legacy snapshots are identical',()=>{
 const reference=new Runner(baseline);reference.advanceTo(6);
 const r=new Runner(baseline);for(const t of [.01,.3,.300001,.8,1.5,6,.2,launch,2])assert.deepEqual(r.seek(t),reference.sample(t));
 for(const t of [.2,launch,.300001,1,6]){r.seek(t);const restored=Runner.deserialize(r.serialize());assert.deepEqual(restored.snapshot(),r.snapshot());assert.deepEqual(restored.advanceTo(6),reference.sample(6));}
 const retained=JSON.parse(fs.readFileSync('docs/design/surface-ascent/legacy-snapshots.json','utf8'));for(const row of retained)assert.deepEqual(Runner.restore(row.bundle,row.snapshot).snapshot(),row.snapshot);
});
test('inward turn after release retains paid safe prefix; early depletion is paid',()=>{
 const inward=bundle();inward.program.operations=inward.program.operations!.slice(0,3);inward.program.thrustArcs=inward.program.thrustArcs!.slice(0,2);inward.program.thrustArcs[1].direction=[0,-1,0];inward.program.thrustArcs[1].end=2;
 const r=new Runner(inward),s=r.advanceTo(3);assert.equal(s.status,'unsupported-approach');assert.ok(s.propellant<1.4);assert.ok(Math.hypot(...s.y.slice(0,3))>1);assert.deepEqual(new Runner(inward).advanceTo(3),s);
 const empty=bundle();empty.program.operations=empty.program.operations!.slice(0,3);empty.scenario.ship.propellant=.001;const load=empty.program.operations[1];if(load.kind==='transfer')load.propellant=0;const depleted=new Runner(empty).advanceTo(1);assert.equal(depleted.status,'fuel-depleted');assert.ok(depleted.propellant<1e-14);assert.ok(depleted.fuelUsed!>0);
});
test('complete surface freight set conserves stock and berth ownership; close display interpolation bounded',()=>{
 const run=prepareSet(ascent as unknown as ModelSet),v=run.vessels[0],r=new Runner(v.bundle);r.advanceTo(6);
 assert.equal(stockAt(run,.299)[0].occupied,1);assert.equal(stockAt(run,.3)[0].occupied,0);assert.equal(stockAt(run,6)[1].occupied,1);assert.equal(stockAt(run,6)[1].cargo,.1);assert.equal(r.sample(6).logistics?.cargoMass,0);
 for(const t of [0,.3,.7,1.5,2.1,6]){const s=r.sample(t),stocks=stockAt(run,t);assert.ok(Math.abs(stocks.reduce((n,p)=>n+p.cargo,0)+s.logistics!.cargoMass-.2)<1e-12);assert.ok(Math.abs(stocks.reduce((n,p)=>n+p.propellant,0)+s.propellant+s.fuelUsed!-3.2)<1e-12);} 
 let max=0;for(let i=0;i<v.samples.length-1;i++){const a=v.samples[i],b=v.samples[i+1],t=(a.t+b.t)/2;if(t<launch||t>1.721)continue;const y=sampleVessel(v,t).y,physical=r.sample(t).y;max=Math.max(max,Math.hypot(...y.slice(0,3).map((x,j)=>x-physical[j])));}
 assert.ok(max*1e6<.25,`display error ${max*1e6} px`);
});
