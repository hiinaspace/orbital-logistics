import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareAtmosphericMission,validateAtmosphericMission} from '../../src/model-set/atmospheric-mission';
import {validateEntry} from '../../src/model-set/entry';
import {portState,surfaceNormal} from '../../src/sim/logistics';
import {atmosphericStateAt} from '../../src/sim/atmospheric-propulsion';
import {sampleVessel,stockAt} from '../../src/model-set/model';
const fixture=()=>JSON.parse(readFileSync('fixtures/model-sets/aster-northern-launch.json','utf8'));
const r=prepareAtmosphericMission(fixture()),d=r.definition;
test('northern atmospheric launch has a real small-circle pad and spatial ascent into an inclined station',()=>{
 const pad=d.world.logistics!.ports[0],launch=r.stack.definition.start,p=portState(pad,launch),n=surfaceNormal(pad,launch);
 assert.ok(Math.abs(n[2]-Math.sin(26*Math.PI/180))<1e-12);
 assert.ok(Math.abs(p[3]+.03*p[1])<1e-12&&Math.abs(p[4]-.03*p[0])<1e-12);assert.equal(p[5],0);
 const split=atmosphericStateAt(r.stack,d.separation.t);
 assert.ok(split[2]>.5&&Math.abs(split[5])>.1);
 assert.ok(r.capture.positionError<1e-8&&r.capture.deltaV<1e-8);
 assert.ok(r.stack.maxima.pressure>0&&r.stack.maxima.acceleration<=3+1e-10);
 const rail=d.world.logistics!.ports[1].rail;assert.equal(rail.kind,'circular');
 if(rail.kind==='circular')assert.ok(Math.abs(rail.u[2])+Math.abs(rail.v[2])>.4);
});
test('spatial stage tree keeps mass, freight and fuel ownership through both ocean contacts',()=>{
 const record=r.view.staging!.separation;assert.ok(Math.abs(record.beforeMass-record.afterMass)<1e-12);assert.deepEqual(record.momentumBefore,record.momentumAfter);
 const upper=r.view.vessels[2],arrival=d.programs.payload.operations![0].t;
 assert.equal(sampleVessel(upper,arrival).logistics!.dockedPortId,'Lantern');
 assert.equal(stockAt(r.view,12).find(s=>s.id==='Lantern')!.cargo,.1);
 for(const v of r.view.vessels.slice(1)){
  const boundary=v.boundaries.find(b=>b.t===v.entry!.recovery.t)!;
  assert.ok(Math.abs(boundary.before.y[2])>.01);assert.ok(Math.hypot(...boundary.before.y.slice(0,3).map((x,i)=>x-boundary.after.y[i]))<1e-14);
  assert.equal(boundary.before.propellant,boundary.after.propellant);assert.ok(boundary.after.propellant>.1);
  assert.equal(sampleVessel(v,12).entryPhase,'recovered');
  const telemetry=r.view.recoveries![v.id];assert.ok(telemetry.relativeSpeed<d.recovery.maxSpeed&&telemetry.waterEnergy>0);
 }
 assert.ok(r.work.nodes<=65536&&r.work.bytes<12000000);
});
test('spatial versions preserve planar admission and reject unsupported geometry/spin/versions',()=>{
 for(const change of [(x:any)=>x.modelVersion='atmospheric-mission-v1',(x:any)=>x.world.logistics.ports[0].rail.latitude=2,(x:any)=>x.atmosphere.spin[0]=.01,(x:any)=>x.world.logistics.ports[1].rail.latitude=.3,(x:any)=>x.world.logistics.ports[0].rail.radius=1.25,(x:any)=>delete x.programs.booster.thrustArcs[0].steering]){
  const x=fixture();change(x);assert.throws(()=>validateAtmosphericMission(x));
 }
 const entry=structuredClone(r.payloadEntry.definition);entry.modelVersion='entry-rk4-v1';assert.throws(()=>validateEntry(entry),/rotation/);
 const array=structuredClone(r.payloadEntry.definition) as any;array.modelVersion=['entry-rk4-v1'];assert.throws(()=>validateEntry(array),/version/);
});
test('prepared spatial samples are immutable and query-order independent across all event sides',()=>{
 const before=JSON.stringify(r.view),copy=structuredClone(r.view);
 for(const v of r.view.vessels){
  const epochs=[v.samples[0].t,...v.boundaries.map(b=>b.t),v.samples.at(-1)!.t];
  const expected=epochs.map(t=>sampleVessel(v,t));
  for(const t of [...epochs].reverse())assert.deepEqual(sampleVessel(copy.vessels.find(c=>c.id===v.id)!,t),expected[epochs.indexOf(t)]);
 }
 assert.equal(JSON.stringify(r.view),before);
});
