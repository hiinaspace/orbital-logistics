import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareSurfaceShuttle} from '../../src/model-set/surface-shuttle';
import {sampleVessel,stockAt} from '../../src/model-set/model';
import {rocketAxis} from '../../src/view/rocket';
import {portState} from '../../src/sim/logistics';
const fixture=JSON.parse(readFileSync('fixtures/model-sets/orison-low-orbit-shuttle.json','utf8'));
test('low orbit shuttle sustains a curved burn through both flights and conserves its tank',()=>{
 const r=prepareSurfaceShuttle(fixture),v=r.view.vessels[0],d=r.definition,a=d.launch+d.ascent.duration,b=d.release+d.descent.duration;
 assert.equal(d.depot.rail.kind,'circular');assert.equal((d.depot.rail as any).radius,1.4);assert.equal(v.arcs.length,2);
 assert.equal(v.arcs[0].start,d.launch);assert.equal(v.arcs[0].end,a);assert.equal(v.arcs[1].end,b);
 assert.equal(v.ledger.some(e=>e.kind==='handoff'),false);assert.ok(r.inbound.capture.propellantAfter>.4);
 for(const shot of [r.outbound,r.inbound]){
  assert.ok(shot.evaluations<=80);assert.deepEqual(shot.runner.bundle.scenario.bodies,d.world.scenario.bodies);
  assert.ok(shot.capture.positionError<2e-8&&shot.capture.deltaV<2e-8);
  const start=shot.runner.bundle.scenario.epoch;
  for(let i=0;i<=128;i++){
   const t=start+(shot.end-start)*i/128,truth=shot.runner.sample(t),drawing=sampleVessel(v,t);
   assert.ok(Math.hypot(...truth.y.slice(0,3))>=1.00000099);
   if(i<128){
    assert.ok(truth.thrust);assert.ok(Math.abs(truth.thrust.acceleration-1.2)<2e-12);
    assert.ok(Math.hypot(...drawing.y.map((x,i)=>x-truth.y[i]))<1e-8);
    assert.deepEqual(rocketAxis(v,drawing,t),drawing.thrust!.direction);
   }
  }
 }
 for(const t of [0,d.launch,a,a+.5,d.release,b,r.view.window.end]){
  const s=sampleVessel(v,t);assert.ok(Math.abs(s.propellant+(s.fuelUsed??0)-6)<1e-11);
  assert.ok(stockAt(r.view,t).every(p=>p.occupied>=0&&p.occupied<=1));
 }
 assert.deepEqual(sampleVessel(v,a).y,portState(d.depot,a));assert.deepEqual(sampleVessel(v,b).y,portState(d.pad,b));
 const left=rocketAxis(v,sampleVessel(v,d.release-1e-6),d.release-1e-6),right=rocketAxis(v,sampleVessel(v,d.release),d.release);
 assert.ok(Math.hypot(...left.map((x,i)=>x-right[i]))<1e-9);
});
test('surface shuttle rejects unsupported hardware, support, or calendar',()=>{
 const bad=structuredClone(fixture);bad.world.scenario.ship.engine.maxAcceleration=3;assert.throws(()=>prepareSurfaceShuttle(bad),/hardware/);
 const pad=structuredClone(fixture);pad.pad.rail.centerHeight=0;assert.throws(()=>prepareSurfaceShuttle(pad),/pad/);
 const early=structuredClone(fixture);early.release=early.launch;assert.throws(()=>prepareSurfaceShuttle(early),/calendar/);
});

test('legacy surface shuttle rejects a moving support provider',()=>{
 const bad=structuredClone(fixture);bad.pad.rail.bodyRail={kind:'fixed',position:[1e-5,0,0]};bad.world.scenario.ship.state=portState(bad.pad,0);
 assert.throws(()=>prepareSurfaceShuttle(bad),/supported pad/);
});
