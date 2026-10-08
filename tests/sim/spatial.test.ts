import {rotated,u,v,rotate} from '../../scripts/spatial-fixtures';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Runner} from '../../src/sim/runner';
import {validateBundle, type Bundle, type Vec3, type State} from '../../src/sim/schema';
import {XY} from '../../src/sim/vectors';
import {inspectEvents} from '../../src/planning/events';
import {solveRendezvous} from '../../src/planning/rendezvous';
import {discoverEncounters} from '../../src/planning/encounters';
import {prepareSet, stateAt, type ModelSet} from '../../src/model-set/model';
import {transform} from '../../src/model-set/frames';
import {fixture, error} from './helpers';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const lift=(a:number[]): State => [a[0],a[1],0,a[2],a[3],0];
test('v1 conversion preserves all saved planar trajectories, events and resource ledgers',()=>{
  const baseline=read('docs/evidence/spatial-planar-baseline.json');
  for(const c of baseline.cases) {
    const [path,name]=c.label.split(':'), input=read(path);
    const b=validateBundle(name ? input.vessels.find((v:any)=>v.name===name).bundle : input), r=new Runner(b);
    const terminal=r.advanceTo(b.scenario.epoch+b.scenario.duration);
    assert.equal(terminal.status,c.terminal.status,c.label);assert.equal(terminal.t,c.terminal.t,c.label);
    for(const sample of c.samples) {
      const actual=r.sample(sample.t);assert.ok(error(actual.y,lift(sample.y))<1e-9,c.label);
      assert.ok(actual.y[2]===0);assert.ok(actual.y[5]===0);
      assert.ok(Math.abs(actual.propellant-sample.propellant)<1e-11,c.label);
      assert.deepEqual(actual.logistics,sample.logistics ? {...sample.logistics,fuelUsed:actual.logistics!.fuelUsed} : undefined);
      if(sample.logistics)assert.ok(Math.abs(actual.logistics!.fuelUsed-sample.logistics.fuelUsed)<1e-11);
    }
    assert.deepEqual(r.ledger.map(e=>[e.t,e.kind,e.id,e.portId]),c.ledger.map((e:any)=>[e.t,e.kind,e.id,e.portId]));
    r.ledger.forEach((e,i)=>assert.ok(Math.abs(e.fuelUsed-c.ledger[i].fuelUsed)<1e-11,c.label));
    assert.deepEqual(validateBundle(b),b); // idempotence, no repeated normalization
  }
});

test('oblique translated circular orbit has full XYZ analytic accuracy and fourth-order convergence',()=>{
  const errors=[];
  for(const step of [1/64,1/128,1/256]) {
    const b=rotated(fixture(undefined,step)),r=new Runner(b);let worst=0;
    for(let i=0;i<=100;i++) {
      const t=6*i/100, expected:State=[0.2+u[0]*Math.cos(t)+v[0]*Math.sin(t),-0.1+u[1]*Math.cos(t)+v[1]*Math.sin(t),0.3+u[2]*Math.cos(t)+v[2]*Math.sin(t),
        -u[0]*Math.sin(t)+v[0]*Math.cos(t),-u[1]*Math.sin(t)+v[1]*Math.cos(t),-u[2]*Math.sin(t)+v[2]*Math.cos(t)];
      worst=Math.max(worst,error(r.sample(t).y,expected));
    }
    errors.push(worst);
  }
  assert.ok(errors[2]<1e-8,String(errors));assert.ok(errors[0]>10*errors[1] && errors[1]>10*errors[2],String(errors));
});

test('noncoplanar moving-source propagation and spatial impulses are rotation covariant',()=>{
  const b=validateBundle(read('fixtures/m0-binary.json'));b.scenario.ship.state[2]=0.13;b.scenario.ship.state[5]=0.04;
  b.program.burns=[{id:'normal',t:0.719,referenceBodyId:'primary',basis:'radial-transverse-normal-v2',orientationAxis:[0,0,1],radial:.01,transverse:-.02,normal:.03}];
  const rotatedBundle=rotated(b,[0,0,0]),a=new Runner(b),c=new Runner(rotatedBundle);
  for(let t=0;t<=6;t+=0.137) {
    const y=a.sample(t).y,z=c.sample(t).y;
    assert.ok(error(z,[...rotate(y.slice(0,3) as Vec3),...rotate(y.slice(3) as Vec3)])<1e-11);
  }
  assert.ok(Math.abs(a.sample(6).propellant-c.sample(6).propellant)<1e-15);
});

test('orientation poles reject atomically, radial motion is valid, and Cartesian burns have no pole',()=>{
  for(const x of [0,1e-11,1e-8]) {
    const b=fixture([x,0,1,0,0,0]);b.program.burns=[{id:'pole',t:0,referenceBodyId:'primary',basis:'radial-transverse-normal-v2',orientationAxis:[0,0,1],radial:.02,transverse:.01,normal:.03}];
    const r=new Runner(b),a=r.current;
    if(x<=1e-11){assert.equal(a.status,'burn-rejected');assert.deepEqual(a.y,b.scenario.ship.state);assert.equal(a.propellant,b.scenario.ship.propellant);assert.equal(a.burnCursor,0);}
    else assert.equal(a.status,'running');
    b.program.burns=[{id:'cartesian',t:0,referenceBodyId:'primary',basis:'inertial-cartesian-v2',deltaVelocity:[.02,-.01,.03]}];
    const c=new Runner(b).current;assert.equal(c.status,'running');assert.equal(c.y[5],.03);
    assert.ok(Math.abs(c.propellant-(.6-1.8*-Math.expm1(-Math.hypot(.02,.01,.03)/3)))<1e-15);
  }
  const radial=fixture([1,0,0,.3,0,0]);radial.program.burns=[{id:'radial',t:0,referenceBodyId:'primary',basis:'radial-transverse-normal-v2',orientationAxis:[0,0,1],radial:0,transverse:0,normal:.1}];
  assert.equal(new Runner(radial).current.y[5],.1);
  const zero=structuredClone(radial);zero.scenario.ship.state=[0,0,1,0,0,0];(zero.program.burns[0] as any).normal=0;
  assert.equal(new Runner(zero).current.status,'running');
});

test('spatial safety and capture use Z and vertical velocity, including paid residuals',()=>{
  const tunnel=fixture([0,0,1,0,0,-200],1/32),stop=new Runner(tunnel).sample(1);
  assert.equal(stop.status,'unsupported-approach');assert.ok(stop.t<.005 && Math.abs(stop.y[2])>.08);
  const base=validateBundle(read('fixtures/m3-round-trip.json'));
  for(const [index,amount] of [[2,2e-5],[5,2e-5],[5,1e-6]]) {
    const b=structuredClone(base);b.scenario.ship.state[index]+=amount;const r=new Runner(b),sample=r.current;
    assert.equal(sample.status,amount>1e-5 ? 'operation-rejected' : 'running');
    if(amount<1e-5){assert.equal(r.ledger[0].deltaV,amount);assert.ok(sample.propellant<b.scenario.ship.propellant);}
  }
  const b=rotated(base),r=new Runner(b);assert.equal(r.advanceTo(24).status,'horizon');
  for(const dock of r.ledger.filter(e=>e.kind==='dock')) {assert.ok(dock.positionError!<b.scenario.logistics!.capture.position);assert.ok(dock.deltaV<b.scenario.logistics!.capture.velocity);}
});

test('spatial snapshots, event sides and query partitions remain canonical',()=>{
  const b=rotated(validateBundle(read('fixtures/m3-round-trip.json'))),a=new Runner(b),c=new Runner(b);
  for(const t of [.1,.27,.719,4.91,10.123,18.73]) {c.advanceTo(t);c.sample(Math.min(t+.071,24));c.sample(0);}
  assert.deepEqual(c.advanceTo(24),a.advanceTo(24));assert.deepEqual(c.eventBoundaries,a.eventBoundaries);
  assert.deepEqual(Runner.deserialize(c.serialize()).snapshot(),c.snapshot());
  const snapshot:any=c.snapshot();snapshot.schemaVersion=1;snapshot.modelVersion='rk4-canonical-v1';
  assert.throws(()=>Runner.restore(b,snapshot),/recover the scenario\/program/);
  const normal=fixture();normal.program.burns=[{id:'normal',t:.719,referenceBodyId:'primary',basis:'radial-transverse-normal-v2',orientationAxis:[0,0,1],radial:0,transverse:0,normal:.02}];
  const r=new Runner(normal);r.advanceTo(2);const boundary=r.eventBoundaries[0];assert.equal(boundary.before.y[5],0);assert.equal(boundary.after.y[5],.02);
  assert.ok(inspectEvents(normal,r,'primary',2).closest.relativeSpeed>0);
});

test('planar planners fence spatial states, sources, ports and burns explicitly',()=>{
  const b=rotated(validateBundle(read('fixtures/m2-rendezvous.json'))),result=solveRendezvous(b,'departure');
  assert.equal(result.status,'failed');if(result.status==='failed')assert.match(result.reason,/Planar targeting/);
  assert.deepEqual(discoverEncounters(b),[]);
  const malformed=fixture();malformed.scenario.bodies[0].rail={kind:'circular',center:[0,0,0],...XY,radius:1,rate:1,phase:0};
  (malformed.scenario.bodies[0].rail as any).u=[1,1,0];assert.throws(()=>validateBundle(malformed),/rail plane/);
});

test('display uses the true event-left state instead of reversing a post-capture burn',()=>{
  const set:ModelSet=read('fixtures/model-sets/orison-freight.json');
  const canonical=validateBundle(set.vessels[0].bundle),burn=canonical.program.burns[1];assert.equal(burn.basis,'radial-transverse-normal-v2');
  if(burn.basis==='radial-transverse-normal-v2')burn.radial+=5e-6;
  set.vessels=[{...set.vessels[0],bundle:canonical}];const run=prepareSet(set),vessel=run.vessels[0];
  const boundary=vessel.boundaries.find(e=>e.t===burn.t)!;
  const before=stateAt(vessel,burn.t-1e-10),after=stateAt(vessel,burn.t);
  assert.ok(error(before,boundary.before.y)<1e-8);assert.deepEqual(after,boundary.after.y);
  assert.ok(vessel.ledger.find(e=>e.t===burn.t && e.kind==='dock')!.deltaV>4e-6);
  const y:State=[1,2,3,4,5,6],t=.71,actual=transform(run,y,t,'rotating'),rate=run.rotating.rate,angle=rate*t+run.rotating.phase;
  assert.equal(actual[2],3);assert.equal(actual[5],6);
  assert.ok(Math.abs(actual[3]-(Math.cos(angle)*4+Math.sin(angle)*5+rate*actual[1]))<1e-14);
});
