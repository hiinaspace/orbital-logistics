import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,error} from './helpers';
import {Runner} from '../../src/sim/runner';
import {validateBundle,type ThrustArc} from '../../src/sim/schema';
import {directionAt} from '../../src/sim/steering';
import {massLaw,massAt,thrustBound} from '../../src/sim/propulsion';
import {prepareSet,sampleVessel,type ModelSet} from '../../src/model-set/model';
import {admitEpisode,nextWindow,validateTraffic,type TrafficDefinition} from '../../src/traffic/planner';
function steered(){
 const b=fixture();b.scenario.duration=2;b.scenario.ship.cargoMass=0;b.scenario.ship.propellant=1;b.scenario.ship.tankCapacity=1;b.scenario.ship.engine={maxThrust:1,maxAcceleration:.6};
 const a:ThrustArc={id:'turn',start:.123,end:1.623,direction:[1,0,0],throttle:1,steering:{kind:'spherical-smoothstep-v1',keys:[{offset:0,direction:[1,0,0]},{offset:.317,direction:[0,1,0]},{offset:1.5,direction:[0,0,1]}]}};
 b.program.schemaVersion=4;b.program.burns=[];b.program.thrustArcs=[a];return b;
}
test('spherical steering is unit length, rotation equivariant and C1 at authored keys',()=>{
 const a=steered().program.thrustArcs![0],rotate=(v:number[])=>[v[2],v[0],v[1]] as [number,number,number];
 assert.ok(error(directionAt(a,.317/2),[Math.SQRT1_2,Math.SQRT1_2,0])<1e-14);
 const r={...a,direction:rotate(a.direction),steering:{...a.steering!,keys:a.steering!.keys.map(k=>({...k,direction:rotate(k.direction)}))}};
 for(let i=0;i<=1000;i++){const t=1.5*i/1000,d=directionAt(a,t);assert.ok(Math.abs(Math.hypot(...d)-1)<1e-14);assert.ok(error(directionAt(r,t),rotate(d))<1e-14);}
 for(const t of [0,.317,1.5]){const h=1e-7,d=directionAt(a,t);assert.ok(error(directionAt(a,t-h),d)/h<1e-4);assert.ok(error(directionAt(a,t+h),d)/h<1e-4);}
 // Near-parallel keys take the stable branch, without changing fixed legacy arcs.
 const near=structuredClone(a);near.steering!.keys[1].direction=[1,1e-12,0];near.steering!.keys[2].direction=[1,0,0];assert.ok(directionAt(near,.2).every(Number.isFinite));
 const fixed={direction:[1,0,0] as [number,number,number]};assert.deepEqual(directionAt(fixed,100),fixed.direction);
});
test('steering input rejects ambiguous, discontinuous, nonunit and unrepresentable key sequences',()=>{
 for(const mutate of [
  (a:any)=>a.steering.kind='lerp', (a:any)=>a.steering.keys=[],
  (a:any)=>a.steering.keys[1].offset=0,(a:any)=>a.steering.keys[0].offset=.1,
  (a:any)=>a.steering.keys[2].offset=1.4,(a:any)=>a.steering.keys[1].direction=[0,2,0],
  (a:any)=>a.steering.keys[0].direction=[0,1,0],(a:any)=>a.steering.keys[1].direction=[-1,0,0],
 ]){const b=steered();mutate(b.program.thrustArcs![0]);assert.throws(()=>validateBundle(b),/steer/i);}
 const downgraded=steered();downgraded.program.schemaVersion=3;assert.throws(()=>validateBundle(downgraded),/schema4/);
 const b=steered(),copy=validateBundle(b);b.program.thrustArcs![0].steering!.keys[1].direction[0]=5;assert.equal(copy.program.thrustArcs![0].steering!.keys[1].direction[0],0);
 const large=steered();large.scenario.epoch=1e12;const a=large.program.thrustArcs![0];a.start=1e12;a.end=1e12+1.5;a.steering!.keys[1].offset=1e-12;assert.throws(()=>validateBundle(large),/steer/i);
});
test('steering knots split canonical steps without ledger events, query dependence or mass-law resets',()=>{
 const b=steered(),one=new Runner(b),many=new Runner(b);one.advanceTo(2);
 for(const t of [.3,.44,.7,.2,1.1229,1.4,.123,1.623,2])many.sample(t);
 many.advanceTo(2);assert.deepEqual(many.snapshot(),one.snapshot());assert.deepEqual(Runner.deserialize(one.serialize()).snapshot(),one.snapshot());
 const knot=.123+.317;assert.ok(one.coastSegments(2).some(s=>s.t1===knot));assert.ok(!one.ledger.some(e=>e.t===knot));
 assert.equal(one.ledger.filter(e=>e.kind==='thrust-end').length,1);
 const law=massLaw(b.scenario.ship.engine!,b.program.thrustArcs![0],1,1,3);
 assert.equal(one.sample(.44).propellant,massAt(law,.44)-1);assert.equal(thrustBound(law),(1+2e-12)*.6);
 for(const t of [.2,.6,1.3])assert.ok(error(one.sample(t).thrust!.direction,directionAt(b.program.thrustArcs![0],t-.123))<1e-14);
});
test('steered depletion and conservative surface safety retain paid, replayable prefixes',()=>{
 const b=steered();b.scenario.ship.propellant=.1;delete b.scenario.ship.engine!.maxAcceleration;
 const r=new Runner(b),end=r.advanceTo(2);assert.equal(end.status,'fuel-depleted');assert.equal(end.propellant,0);assert.ok(Math.abs(end.fuelUsed!-.1)<1e-14);assert.deepEqual(Runner.deserialize(r.serialize()).snapshot(),r.snapshot());
 const unsafe=steered();unsafe.scenario.bodies=[{id:'world',mu:1,radius:.9,rail:{kind:'fixed',position:[0,0,0]}}];unsafe.scenario.ship.state=[1,0,0,0,0,0];unsafe.scenario.ship.engine={maxThrust:100};unsafe.scenario.ship.exhaustVelocity=1000;
 const a=unsafe.program.thrustArcs![0];a.start=0;a.end=1.5;a.direction=[-1,0,0];a.steering!.keys=[{offset:0,direction:[-1,0,0]},{offset:1.5,direction:[0,1,0]}];
 const failure=new Runner(unsafe),s=failure.advanceTo(2);assert.equal(s.status,'unsupported-approach');assert.ok(s.t>0&&s.t<1.5&&s.fuelUsed!>0);assert.ok(Math.hypot(...s.y.slice(0,3))>.9);assert.deepEqual(Runner.deserialize(failure.serialize()).snapshot(),failure.snapshot());
});
test('inclined finite transfer is paid, capped, impulse-free and has continuous display headings',()=>{
 const set=JSON.parse(readFileSync('fixtures/model-sets/orison-steered.json','utf8')) as ModelSet,view=prepareSet(set),v=view.vessels[0],b=set.vessels[0].bundle,r=new Runner(b),last=r.advanceTo(24);
 assert.equal(last.status,'horizon');assert.equal(b.program.burns.length,0);assert.equal(last.logistics!.dockedPortId,'Incline');assert.equal(last.logistics!.cargoMass,0);assert.ok(last.propellant>.6&&last.propellant<.7);
 const capture=r.ledger.find(e=>e.id==='capture')!;assert.ok(capture.positionError!+1e-8<1e-7&&capture.deltaV+1e-8<1e-7);
 const a=b.program.thrustArcs![1],directions=[];let max=0;
 for(let i=0;i<101;i++){const t=a.start+(a.end-a.start)*(i+.5)/101,s=sampleVessel(v,t);assert.ok(error(s.thrust!.direction,directionAt(a,t-a.start))<1e-14);directions.push(s.thrust!.direction);max=Math.max(max,s.thrust!.acceleration);}
 assert.ok(error(directions[0],directions.at(-1)!)>.3);assert.ok(Math.abs(max-.14)<1e-12);assert.ok(Math.abs(r.sample(8).y[2])>.3);
});
test('continuous template rotations include every steering key without mutating the template',()=>{
 const d=JSON.parse(readFileSync('fixtures/traffic/orison-service.json','utf8')) as TrafficDefinition;
 for(const t of d.templates)for(const a of t.arcs)a.steering={kind:'spherical-smoothstep-v1',keys:[{offset:0,direction:[...a.direction]},{offset:a.end-a.start,direction:[...a.direction]}]};
 const def=validateTraffic(d),saved=JSON.stringify(def),t=def.templates[0],w=nextWindow(def,t,64),e=admitEpisode(def,t,'test',0,w.departure-1,w,t.cargo,t.propellant);
 for(const a of e.bundle.program.thrustArcs!)for(const k of a.steering!.keys)assert.ok(error(k.direction,a.direction)<1e-14);
 assert.equal(JSON.stringify(def),saved);assert.equal(e.runner.current.status,'horizon');
});
