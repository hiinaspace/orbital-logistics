import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,error} from './helpers';
import {Runner} from '../../src/sim/runner';
import {massLaw,massAt,intervalStep,thrustAt} from '../../src/sim/propulsion';
import {certifiedCoast} from '../../src/sim/dynamics';
import {validateBundle,type ThrustArc} from '../../src/sim/schema';
import {planarUnavailable} from '../../src/planning/domain';
const arc=(start=0,end=2):ThrustArc=>({id:'powered',start,end,direction:[1,0,0],throttle:1});
function powered(){const b=fixture();b.scenario.duration=6;b.scenario.ship.engine={maxThrust:1};b.program.burns=[];b.program.thrustArcs=[arc(.123,1.234)];return b;}

test('powered primitive matches analytic zero-gravity rocket motion in an inclined direction',()=>{
 const b=fixture();b.scenario.bodies=[];const direction:[number,number,number]=[1/3,2/3,2/3],a={...arc(),direction},law=massLaw({maxThrust:1},a,1,1,3),dt=.5;
 let y:[number,number,number,number,number,number]=[0,0,0,0,0,0];const h=dt/128;
 for(let i=0;i<128;i++)y=intervalStep(b.scenario,i*h,y,h,law);
 const mass=2-dt/3,v=3*Math.log(2/mass),x=3*(dt+mass*3*Math.log(mass/2));
 assert.ok(error(y,[...direction.map(d=>x*d),...direction.map(d=>v*d)])<1e-12);assert.equal(massAt(law,dt),mass);
 const zero=massLaw({maxThrust:1},{...a,throttle:0},1,1,3);assert.equal(massAt(zero,100),2);assert.equal(thrustAt(zero,100),0);
});

test('acceleration cap has an exact transition and capped mass decay',()=>{
 const a=arc(),law=massLaw({maxThrust:1,maxAcceleration:.6},a,1,1,3);
 assert.ok(Math.abs(law.capEpoch!-1)<1e-14);
 assert.ok(Math.abs(massAt(law,1.5)-(5/3)*Math.exp(-.1))<1e-14);
 assert.ok(thrustAt(law,1.5)/massAt(law,1.5)<=.6+1e-15);
 const b=powered();b.scenario.ship.propellant=1;b.scenario.ship.tankCapacity=1;b.scenario.ship.cargoMass=0;b.scenario.ship.engine={maxThrust:1,maxAcceleration:.6};b.program.thrustArcs=[{...a,start:.123,end:1.623}];
 const r=new Runner(b);assert.equal(r.advanceTo(2).status,'running');
 assert.ok(Math.abs(r.sample(1.623).propellant-((5/3)*Math.exp(-.1)-1))<1e-14);
});

test('powered queries, event boundaries, segments and snapshots preserve canonical results',()=>{
 const b=powered(),one=new Runner(b),many=new Runner(b);one.advanceTo(4);
 for(const t of [.01,.122,.123,.2,.555,.4,1.234,3,2,4])many.advanceTo(t);
 assert.deepEqual(many.snapshot(),one.snapshot());assert.deepEqual(Runner.deserialize(one.serialize()).snapshot(),one.snapshot());
 assert.equal(one.sample(.123).thrust?.id,'powered');assert.equal(one.sample(1.234).thrust,undefined);
 for(const t of [.2,.555,1.233]) {
  const s=one.sample(t);assert.ok(s.propellant<one.sample(.123).propellant);assert.ok(s.fuelUsed!>0);
  const segment=one.coastSegments(2).find(s=>s.t0<t && s.t1>t)!;
  assert.ok(error(one.segmentState(segment,t),s.y)<1e-14);
 }
 assert.equal(one.ledger.filter(e=>e.kind==='thrust-end').length,1);
 assert.ok(Math.abs(one.ledger.reduce((s,e)=>s+e.fuelUsed,0)-one.sample(4).fuelUsed!)<1e-14);
 assert.match(planarUnavailable(b)!,/powered/);
});

test('adjacent arcs retain the preceding force at the RK endpoint and expose the new heading',()=>{
 const b=powered();b.program.thrustArcs=[arc(.123,.5),{...arc(.5,.8),id:'second',direction:[0,1,0]}];
 const r=new Runner(b),s=r.advanceTo(.5),boundary=r.eventBoundaries.find(e=>e.t===.5)!;
 assert.deepEqual(boundary.before.y,boundary.after.y);assert.equal(s.thrust!.id,'second');
 assert.deepEqual(r.ledger.filter(e=>e.t===.5).map(e=>e.kind),['thrust-end','thrust-start']);
 const fine=structuredClone(b);fine.scenario.policy.step/=2;
 assert.ok(error(r.sample(1).y,new Runner(fine).sample(1).y)<1e-9);
});

test('depletion preserves flown state, closes the partial arc once, and exact-end exhaustion completes',()=>{
 const b=powered();b.scenario.ship.propellant=.1;b.program.thrustArcs=[arc(0,1)];
 const r=new Runner(b),s=r.advanceTo(2);assert.equal(s.status,'fuel-depleted');assert.equal(s.t,.1*3);assert.equal(s.propellant,0);assert.ok(Math.abs(s.fuelUsed!-.1)<1e-15);
 assert.deepEqual(r.ledger.map(e=>e.kind),['thrust-start','fuel-depleted']);assert.ok(Math.abs(r.ledger.at(-1)!.fuelUsed-.1)<1e-15);
 assert.deepEqual(Runner.deserialize(r.serialize()).snapshot(),r.snapshot());
 const exact=structuredClone(b);exact.program.thrustArcs![0].end=.1*3;
 const e=new Runner(exact);assert.equal(e.advanceTo(2).status,'running');assert.equal(e.sample(.3).propellant,0);
 const adjacent=structuredClone(exact),epoch=adjacent.program.thrustArcs![0].end;
 adjacent.program.thrustArcs!.push({...arc(epoch,.8),id:'empty-next'});
 const next=new Runner(adjacent);assert.equal(next.advanceTo(2).status,'fuel-depleted');assert.equal(next.current.t,epoch);
 assert.deepEqual(next.ledger.filter(e=>e.t===epoch).map(e=>e.kind),['thrust-end','thrust-start','fuel-depleted']);
 assert.ok(Math.abs(next.current.fuelUsed!-.1)<1e-15);
 const zero=structuredClone(b);zero.scenario.ship.propellant=0;zero.program.thrustArcs![0].throttle=0;
 const coast=new Runner(zero);assert.equal(coast.advanceTo(2).status,'running');assert.equal(coast.current.fuelUsed,0);
});

test('powered safety and work exhaustion preserve the charged partial prefix',()=>{
 const b=powered();b.scenario.policy.maxNodes=3074; // six-unit base grid requires3074
 b.scenario.policy.maxSubdivision=0;b.scenario.ship.engine={maxThrust:100};b.program.thrustArcs=[{...arc(0,.1),direction:[-1,0,0]}];
 const old=certifiedCoast(b.scenario,0,b.scenario.ship.state,.1),bounded=certifiedCoast(b.scenario,0,b.scenario.ship.state,.1,100);
 assert.equal(old,true);assert.equal(bounded,false);
 // A valid tiny-step run hits its node budget after the extra authored endpoints.
 const work=powered();work.scenario.policy.maxNodes=3074;work.program.thrustArcs=[arc(.123,5.9)];work.scenario.ship.engine={maxThrust:.01};
 const r=new Runner(work),s=r.advanceTo(6);assert.equal(s.status,'work-limit');assert.ok(s.t<6);assert.ok(s.fuelUsed!>0);
 assert.ok(Math.abs(r.ledger.reduce((sum,e)=>sum+e.fuelUsed,0)-s.fuelUsed!)<1e-12);
});

test('legacy propulsion fields are rejected before conversion and incompatible programs fail explicitly',()=>{
 const legacy=JSON.parse(readFileSync('fixtures/model-sets/selene-freight.json','utf8')).vessels[0].bundle;
 legacy.scenario.ship.engine={maxThrust:1};assert.throws(()=>validateBundle(legacy),/schema3/);
 const b=powered();b.program.thrustArcs!.push({...arc(1,2),id:'overlap'});assert.throws(()=>validateBundle(b),/Overlapping/);
});

test('powered surface approach stops with a paid reproducible prefix',()=>{
 const b=powered();b.scenario.ship.state=[1,0,0,0,0,0];b.scenario.policy.step=1/32;
 b.scenario.ship.cargoMass=0;b.scenario.ship.propellant=2;b.scenario.ship.tankCapacity=2;b.scenario.ship.exhaustVelocity=1000;
 b.scenario.ship.engine={maxThrust:100};b.program.thrustArcs=[{...arc(0,1),direction:[-1,0,0]}];
 const r=new Runner(b),s=r.advanceTo(2);assert.equal(s.status,'unsupported-approach');assert.ok(s.t>0 && s.t<1);
 assert.ok(Math.hypot(...s.y.slice(0,3))>b.scenario.bodies[0].radius);assert.ok(s.fuelUsed!>0);
 assert.ok(Math.abs(r.ledger.reduce((sum,e)=>sum+e.fuelUsed,0)-s.fuelUsed!)<1e-14);
 assert.deepEqual(Runner.deserialize(r.serialize()).snapshot(),r.snapshot());
});

test('powered rotations preserve physics and legacy snapshots cannot resume',()=>{
 const a=powered(),b=structuredClone(a),rotate=(v:number[])=>[v[2],v[0],v[1]];
 b.scenario.ship.state=[...rotate(a.scenario.ship.state.slice(0,3)),...rotate(a.scenario.ship.state.slice(3))] as typeof b.scenario.ship.state;
 b.program.thrustArcs![0].direction=rotate(a.program.thrustArcs![0].direction) as [number,number,number];
 const x=new Runner(a).advanceTo(3),y=new Runner(b).advanceTo(3);
 assert.ok(error(y.y,[...rotate(x.y.slice(0,3)),...rotate(x.y.slice(3))])<1e-13);assert.equal(x.propellant,y.propellant);
 const r=new Runner(a),snapshot:any=r.snapshot();snapshot.schemaVersion=2;snapshot.modelVersion='rk4-canonical-v2';
 assert.throws(()=>Runner.restore(a,snapshot),/recover the scenario\/program/);
});

test('attached thrust and impulses touching an arc reject explicitly',()=>{
 const raw=JSON.parse(readFileSync('fixtures/model-sets/orison-powered.json','utf8')).vessels[0].bundle;
 const b=validateBundle(raw);b.program.thrustArcs=[arc(0,.1)];const r=new Runner(b);
 assert.equal(r.current.status,'operation-rejected');assert.equal(r.current.fuelUsed,0);
 const c=powered();c.program.burns=[{id:'impulse',t:.123,referenceBodyId:'primary',basis:'inertial-cartesian-v2',deltaVelocity:[.01,0,0]}];
 assert.throws(()=>validateBundle(c),/impulse/i);
});
