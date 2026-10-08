import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ascent from '../../fixtures/model-sets/selene-ascent.json';
import returned from '../../fixtures/model-sets/selene-return.json';
import {Runner} from '../../src/sim/runner';
import {rk4} from '../../src/sim/dynamics';
import {portState,logisticsResult} from '../../src/sim/logistics';
import {validateBundle,type Bundle,type State} from '../../src/sim/schema';
import {prepareSet,stockAt,type ModelSet} from '../../src/model-set/model';
const baseline=validateBundle(ascent.vessels[0].bundle),full=validateBundle(returned.vessels[0].bundle),t=1e-5;
function micro(miss=0,radial=0,lateral=0,fuel=1,z=0,vz=0):Bundle {
 const b=structuredClone(baseline),pad=b.scenario.logistics!.ports[0],target=portState(pad,t);
 assert.equal(pad.rail.kind,'surface');if(pad.rail.kind!=='surface')throw Error();
 const angle=pad.rail.phase+pad.rail.rate*t,desired=[...target] as State;
 desired[0]+=miss*Math.cos(angle);desired[1]+=miss*Math.sin(angle);
 desired[3]+=radial*Math.cos(angle)-lateral*Math.sin(angle);desired[4]+=radial*Math.sin(angle)+lateral*Math.cos(angle);
 desired[2]+=z;desired[5]+=vz;
 b.scenario.duration=1;b.scenario.ship.state=rk4(b.scenario,t,desired,-t);b.scenario.ship.propellant=fuel;
 b.program.operations=[{id:'land',kind:'land',t,portId:'Cairn'}];b.program.thrustArcs=[];return b;
}
test('landing full-speed/position envelope is paid; exterior below COM and upward residuals are allowed',()=>{
 for(const args of [[.99e-7,0,0],[-.99e-7,0,0],[0,.99e-7,0],[0,0,-.99e-7]]) {
  const b=micro(...args),r=new Runner(b),s=r.advanceTo(t),e=r.ledger.find(e=>e.kind==='land')!;
  assert.equal(s.status,'running',s.detail);assert.equal(s.logistics?.dockedPortId,'Cairn');assert.deepEqual(s.y,r.portState('Cairn',t));
  assert.equal(r.ledger.filter(e=>e.kind==='dock').length,0);assert.equal(s.logistics?.operationCursor,1);
  assert.equal(e.fuelUsed,(1+e.propellantBefore)*-Math.expm1(-e.deltaV/3));assert.equal(s.propellant,1-e.fuelUsed);
 }
});
test('failed attachment preserves input state, resources and cursor, including zero-fuel nonzero residual',()=>{
 for(const args of [[1.01e-7,0,0,1],[0,1.01e-7,0,1],[0,0,1.01e-7,1],[0,.5e-7,0,0],[0,0,0,1,1.01e-7,0],[0,0,0,1,0,1.01e-7]]) {
  const b=micro(...args),free=structuredClone(b);free.program.operations=[];
  const expected=new Runner(free).sample(t),r=new Runner(b),s=r.advanceTo(t);
  assert.equal(s.status,'operation-rejected');assert.deepEqual(s.y,expected.y);assert.equal(s.propellant,expected.propellant);
  assert.deepEqual(s.logistics,expected.logistics);assert.equal(r.ledger.length,1);assert.equal(r.ledger[0].kind,'operation-rejected');
  assert.deepEqual(Runner.deserialize(r.serialize()).current,s);
 }
 // A larger historical capture setting is locally bounded by represented COM clearance.
 const large=micro(2.6e-7);large.scenario.logistics!.capture.position=1e-5;
 assert.equal(new Runner(large).sample(t).status,'operation-rejected');
});
test('landing rejects simultaneous impulse/start/other operations before any mutation; ending thrust is allowed',()=>{
 const cases=[(b:Bundle)=>b.program.burns.push({id:'zero',t,basis:'inertial-cartesian-v2',referenceBodyId:'Selene',deltaVelocity:[0,0,0]}),
  (b:Bundle)=>b.program.thrustArcs!.push({id:'zero',start:t,end:2*t,throttle:0,direction:[0,1,0]}),
  (b:Bundle)=>b.program.operations!.push({id:'other',kind:'transfer',t,portId:'Lantern',cargo:.01,propellant:0}),
  (b:Bundle)=>b.program.operations!.push({id:'other',kind:'land',t,portId:'Cairn'})];
 for(const change of cases){const b=micro();change(b);assert.throws(()=>validateBundle(b),/Conflicting landing|operation order/);}
 const orbital=micro();orbital.program.operations![0].portId='Lantern';assert.throws(()=>validateBundle(orbital),/surface landing/);
 const initial=micro();initial.program.operations![0].t=0;assert.throws(()=>validateBundle(initial),/surface landing/);
 const r=new Runner(full),arrival=full.program.operations!.find(o=>o.kind==='land')!.t;r.advanceTo(arrival);
 assert.deepEqual(r.ledger.filter(e=>e.t===arrival).map(e=>e.kind),['thrust-end','land','transfer-start']);
 const edge=r.eventBoundaries.find(e=>e.t===arrival)!;assert.equal(edge.before.logistics?.dockedPortId,undefined);assert.equal(edge.after.logistics?.dockedPortId,'Cairn');
 assert.ok(r.ledger.find(e=>e.t===arrival&&e.kind==='thrust-end')!.fuelUsed>0);
 // An envelope failure keeps the just-ended descent paid and leaves no attachment.
 const fail=structuredClone(full);fail.scenario.logistics!.capture.velocity=1e-12;const failed=new Runner(fail);const s=failed.advanceTo(arrival);
 assert.equal(s.status,'operation-rejected');assert.equal(s.logistics?.dockedPortId,undefined);
 assert.deepEqual(failed.ledger.filter(e=>e.t===arrival).map(e=>e.kind),['thrust-end','operation-rejected']);assert.ok(s.fuelUsed!>2);
 assert.deepEqual(s.y,edge.before.y);assert.equal(s.propellant,edge.before.propellant);assert.equal(s.logistics?.operationCursor,edge.before.logistics?.operationCursor);
});
test('landing commits separately from a rejected subsequent transfer; service can finish then relaunch',()=>{
 const bad=micro();bad.program.operations!.push({id:'bad',kind:'transfer',t,portId:'Cairn',cargo:.2,propellant:0});
 const r=new Runner(bad),s=r.advanceTo(t);assert.equal(s.status,'operation-rejected');assert.equal(s.logistics?.dockedPortId,'Cairn');assert.equal(s.logistics?.operationCursor,1);
 assert.deepEqual(r.ledger.map(e=>e.kind),['land','operation-rejected']);
 const b=micro(0,.5e-7);b.scenario.duration=1;b.program.operations!.push({id:'load',kind:'transfer',t,portId:'Cairn',cargo:.05,propellant:.1});
 const launch=t+b.scenario.logistics!.ports[0].serviceDuration;b.program.operations!.push({id:'leave',kind:'launch',t:launch,portId:'Cairn',thrustArcId:'lift'});
 b.program.thrustArcs=[{id:'lift',start:launch,end:launch+.01,throttle:1,direction:[0,1,0]}];
 const again=new Runner(b),released=again.advanceTo(launch);assert.equal(released.status,'running',released.detail);assert.equal(released.logistics?.dockedPortId,undefined);assert.equal(released.logistics?.cargoMass,.05);
 assert.deepEqual(again.ledger.filter(e=>e.t===launch).map(e=>e.kind),['transfer','launch','thrust-start']);
});
test('complete round trip conserves stocks, counts one berth arrival and replays exact event sides and retained snapshots',()=>{
 const run=prepareSet(returned as unknown as ModelSet),v=run.vessels[0],r=new Runner(full);r.advanceTo(11);
 const arrival=full.program.operations!.find(o=>o.kind==='land')!.t,final=r.sample(11);
 assert.equal(logisticsResult(full.scenario.logistics!,final.logistics!,final.propellant,11).complete,true);
 assert.equal(final.logistics?.dockedPortId,'Cairn');assert.equal(final.logistics?.cargoMass,0);assert.ok(final.propellant>.05);
 assert.deepEqual(stockAt(run,11).map(s=>s.occupied),[1,0]);assert.equal(stockAt(run,11)[1].cargo,.05);
 const original=new Runner(baseline);for(const time of [.2,.3,.6,1.7207514043249135,2]){const a=r.sample(time),b=original.sample(time);assert.deepEqual(a,b);}
 const queries=[0,.3,2.1,7.829865668956577,9,arrival-1e-8,arrival,arrival+1e-8,10.3,11];
 for(const time of queries){const s=r.seek(time),stocks=stockAt(run,time);assert.ok(Math.abs(stocks.reduce((n,p)=>n+p.cargo,0)+s.logistics!.cargoMass-.2)<1e-12);assert.ok(Math.abs(stocks.reduce((n,p)=>n+p.propellant,0)+s.propellant+s.fuelUsed!-3.2)<1e-12);const restored=Runner.deserialize(r.serialize());assert.deepEqual(restored.current,s);assert.deepEqual(restored.advanceTo(11),final);}
 const partitioned=new Runner(full);for(const time of [...queries,9.1,arrival,7,11])assert.deepEqual(partitioned.seek(time),r.sample(time));
 for(const row of JSON.parse(fs.readFileSync('docs/design/surface-landing/legacy-snapshots.json','utf8')))assert.deepEqual(JSON.parse(Runner.restore(row.bundle,row.snapshot).serialize()).snapshot,row.snapshot);
 assert.ok(v.samples.length<32768);assert.ok(r.retainedNodes<65536);
});
