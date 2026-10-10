import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareDirectSurface} from '../../src/model-set/direct-surface';
import {sampleVessel,displayPortState,stockAt} from '../../src/model-set/model';
import {groundState,surfaceCacheStats} from '../../src/surface-flexible/contracts';
import {directionAt} from '../../src/sim/steering';
const fixture=JSON.parse(readFileSync('fixtures/model-sets/orison-direct-surface.json','utf8'));
test('direct surface sortie integrates both legs in the full field without cached or circular staging handoffs',()=>{
 const initialCache=surfaceCacheStats(),r=prepareDirectSurface(fixture),v=r.view.vessels[0],s=fixture.service,a=fixture.arrival,b=fixture.release,landing=b+fixture.descent.duration,launch=a-fixture.ascent.duration;
 assert.deepEqual(surfaceCacheStats(),initialCache);assert.equal(v.surfaceFlights,undefined);
 assert.equal(v.ledger.filter(e=>e.kind==='handoff').length,0);assert.equal(v.arcs.length,4);
 assert.equal(r.world.failed,0);assert.ok(r.inbound.capture.propellantAfter>.05);
 assert.ok(r.outbound.capture.positionError<2e-8&&r.outbound.capture.deltaV<2e-8);
 assert.ok(r.inbound.capture.positionError<2e-8&&r.inbound.capture.deltaV<2e-8);
 for(const shot of [r.outbound,r.inbound]){
  assert.deepEqual(shot.runner.bundle.scenario.bodies,s.world.scenario.bodies);
  assert.deepEqual(shot.runner.bundle.scenario.ship.engine,{maxThrust:32,maxAcceleration:3});
  assert.ok(shot.evaluations<=100);const runner=shot.runner,begin=runner.bundle.scenario.epoch,end=begin+shot.shape.duration;
  for(let i=0;i<=512;i++){
   const t=begin+(end-begin)*i/512,actual=runner.sample(t),drawing=sampleVessel(v,t);
   assert.ok(Math.hypot(...actual.y.slice(0,3))>=1.00000098);
   if(t<end)assert.ok(Math.hypot(...actual.y.map((x,i)=>x-drawing.y[i]))<1e-8);
   if(actual.thrust){assert.ok(Math.abs(actual.thrust.acceleration-3)<2e-12);assert.ok(actual.thrust.force<=32);assert.deepEqual(actual.thrust.direction,directionAt(v.arcs.find(a=>a.id===actual.thrust!.id)!,t-v.arcs.find(a=>a.id===actual.thrust!.id)!.start));}
  }
 }
 for(const t of [...new Set([0,launch,a,a+.5,b,landing,r.view.window.end,...r.world.chunks.flatMap(c=>[c.data.start,c.data.end])])].filter(t=>t<=r.view.window.end)){
  const ship=sampleVessel(v,t),station=sampleVessel(r.view.maintained!.Meridian,t);
  assert.ok(Math.abs(ship.propellant+station.propellant+(ship.fuelUsed??0)+(station.fuelUsed??0)-6.6)<1e-10);
  const stocks=stockAt(r.view,t);assert.equal(stocks.find(p=>p.id==='Meridian')!.propellant,station.propellant);
  assert.ok(stocks.every(p=>p.occupied>=0&&p.occupied<=1));
  if(t>=a&&t<b)assert.ok(Math.hypot(...ship.y.map((x,i)=>x-displayPortState(r.view.world.ports[1],r.view.portSamples,t)[i]))<1e-12);
 }
 assert.deepEqual(sampleVessel(v,launch).y,groundState(launch));
 assert.deepEqual(sampleVessel(v,landing).y,groundState(landing));
 assert.equal(sampleVessel(v,a).logistics?.dockedPortId,'Meridian');
 assert.equal(sampleVessel(v,landing).logistics?.dockedPortId,'Equator');
 assert.ok(r.world.nodes+r.outbound.runner.retainedNodes+r.inbound.runner.retainedNodes<100000);
});
test('direct surface exhibit rejects unsupported launch/landing inputs rather than substituting a cache',()=>{
 const bad=structuredClone(fixture);bad.ascent.arcs[0].start=.01;
 assert.throws(()=>prepareDirectSurface(bad),/ordering/);
 const load=structuredClone(fixture);load.service.world.scenario.ship.propellant=3;
 assert.throws(()=>prepareDirectSurface(load),/ground ship/);
});

test('a longer direct visit preserves loaded maintenance and station/ship fuel ownership',()=>{
 const d=structuredClone(fixture);d.release=76;const r=prepareDirectSurface(d),v=r.view.vessels[0];
 assert.ok(r.world.chunks.some(c=>c.pieces.some(p=>p.visitorFuel!==undefined&&p.runner.bundle.program.thrustArcs!.length>0)));
 for(const t of [12,36,60,76,78.5]){
  const ship=sampleVessel(v,t),station=sampleVessel(r.view.maintained!.Meridian,t);
  assert.ok(Math.abs(ship.propellant+station.propellant+(ship.fuelUsed??0)+(station.fuelUsed??0)-6.6)<1e-10);
 }
 assert.equal(r.world.failed,0);assert.ok(r.inbound.capture.propellantAfter>.05);
});
