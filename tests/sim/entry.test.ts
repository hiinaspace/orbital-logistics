import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aerodynamicForces,densityAt} from '../../src/sim/atmosphere';
import {entryDerivative,entryForces,entryStep,certifiedEntryStep,recoveredState} from '../../src/sim/entry';
import {prepareEntry,entryStateAt,validateEntry} from '../../src/model-set/entry';
import {sampleVessel,stateAt} from '../../src/model-set/model';
import {bodyState,rk4} from '../../src/sim/dynamics';
import {validateBundle,type State,type Vec3} from '../../src/sim/schema';
import {cross,dot,norm,scale,subtract} from '../../src/sim/vectors';
const fixture=()=>JSON.parse(readFileSync('fixtures/model-sets/aster-entry.json','utf8'));
const distance=(a:number[],b:number[])=>Math.hypot(...a.map((x,i)=>x-b[i]));
test('drag dissipates air-relative energy; lift stays perpendicular, bounded and finite in radial/zero-speed flight',()=>{
 const d=validateEntry(fixture()),b=d.scenario.bodies[0];
 for(const y of [[1.08,0,0,.1,.8,.3],[1.08,0,0,-.1,.0324,0],[1.08,0,0,0,.0324,0]] as State[]){
  const f=aerodynamicForces(b,d.atmosphere,d.aero,0,y);
  assert.ok(dot(f.drag,f.relativeVelocity)<=1e-14);assert.ok(Math.abs(dot(f.lift,f.relativeVelocity))<1e-13);
  assert.ok(norm(f.lift)<=norm(f.drag)*d.aero.liftToDrag+1e-14);
  assert.ok([...f.drag,...f.lift].every(Number.isFinite));
 }
 const still=aerodynamicForces(b,d.atmosphere,d.aero,0,[1.08,0,0,0,.0324,0]);
 assert.deepEqual(still.drag,[0,0,0]);assert.deepEqual(still.lift,[0,0,0]);
 assert.equal(densityAt(d.atmosphere,.2),0);
});
test('air force is invariant under moving body origin; vacuum matches the gravity integrator',()=>{
 const d=validateEntry(fixture()),fixed=d.scenario.bodies[0],t=.4;
 const body={...fixed,rail:{kind:'circular' as const,center:[3,2,1] as Vec3,u:[1,0,0] as Vec3,v:[0,1,0] as Vec3,radius:2,rate:.1,phase:.3}};
 const b=bodyState(body,t),local=[1.08,0,.02,.1,.6,.2] as State,y=local.map((x,i)=>x+b[i]) as State;
 const a=aerodynamicForces(fixed,d.atmosphere,d.aero,t,local),moving=aerodynamicForces(body,d.atmosphere,d.aero,t,y);
 assert.ok(distance(a.drag,moving.drag)<1e-12);assert.ok(distance(a.lift,moving.lift)<1e-12);
 const z=[...d.scenario.ship.state,.2] as const,step=entryStep(d,0,[...z],1/2048);
 assert.ok(distance(step.slice(0,6),rk4(d.scenario,0,d.scenario.ship.state,1/2048))<1e-14);assert.equal(step[6],.2);
});
test('powered drag and saturated guidance use current mass at every stage',()=>{
 const d=validateEntry(fixture()),z=[1.01,0,0,-.09,.035,0,.2] as const,light=[...z] as number[];light[6]=.1;
 const a=entryForces(d,0,[...z]),b=entryForces(d,0,light as any);
 assert.equal(a.mass,1);assert.equal(b.mass,.9);assert.deepEqual(a.aero.drag,b.aero.drag);
 const rate=entryDerivative(d,0,[...z]);assert.equal(rate[6],-norm(a.force)/d.scenario.ship.exhaustVelocity);
 assert.ok(norm(a.force)<=d.scenario.ship.engine!.maxThrust);assert.ok(norm(a.force)/a.mass<=d.scenario.ship.engine!.maxAcceleration!);
 assert.equal(certifiedEntryStep(d,0,[...z],.1),false);
});
test('entry admission rejects unknown physics, old versions, legacy fallback and unsupported planes',()=>{
 const d=fixture();d.aero.machModel='unknown';assert.throws(()=>validateEntry(d),/Unknown entry physical/);
 const version=fixture();version.modelVersion='entry-rk4-v0';assert.throws(()=>validateEntry(version),/version/);
 const spatial=fixture();spatial.scenario.ship.state[2]=.1;assert.throws(()=>validateEntry(spatial),/rotation/);
 const legacy=fixture();legacy.scenario.atmosphere=legacy.atmosphere;assert.throws(()=>validateBundle({scenario:legacy.scenario,program:{schemaVersion:3,id:'bad',burns:[]}}),/entry-flight/);
});
test('finite entry has exact dissipative event sides, conserved cargo/fuel and deterministic query order',()=>{
 const r=prepareEntry(fixture()),v=r.view.vessels[0],t=r.contact.t,before=entryStateAt(r,t,true),after=entryStateAt(r,t),m=.8+before[6];
 assert.ok(Math.abs(norm(before.slice(0,3) as Vec3)-1.00001)<1e-12);
 assert.deepEqual(before.slice(0,3),after.slice(0,3));assert.equal(before[6],after[6]);assert.ok(before[6]>.15);
 assert.ok(distance(after.slice(3,6),cross(r.definition.atmosphere.spin,after.slice(0,3) as Vec3))<1e-14);
 assert.ok(Math.abs(r.contact.waterEnergy-.5*m*r.contact.relativeSpeed**2)<1e-15);
 assert.ok(distance(r.contact.impulse,scale(subtract(after.slice(3,6) as Vec3,before.slice(3,6) as Vec3),m))<1e-14);
 const b=v.boundaries[0];assert.deepEqual(b.before.y,before.slice(0,6));assert.deepEqual(b.after.y,after.slice(0,6));
 assert.equal(sampleVessel(v,t).entryPhase,'recovered');assert.equal(sampleVessel(v,t-1e-7).entryPhase,'braking');
 assert.ok(distance(sampleVessel(v,t-1e-7).y,b.before.y)<1e-7);assert.equal(sampleVessel(v,t).thrust,undefined);
 const epochs=[3.3333,4.1001,t,5.5555,0],samples=epochs.map(t=>sampleVessel(v,t));
 const copy=JSON.parse(JSON.stringify(r.view));assert.deepEqual(epochs.map(t=>sampleVessel(copy.vessels[0],t)),samples);
 for(const t of [...epochs].reverse())assert.deepEqual(sampleVessel(v,t),samples[epochs.indexOf(t)]);
 assert.deepEqual(stateAt(v,5.5),recoveredState(r.contact.pose,5.5));
 assert.equal(r.view.stations.length,0);assert.equal(r.view.world.ports.length,0);assert.equal(v.ship.cargoMass,.2);
 assert.ok(r.work.evaluations<524288);assert.ok(r.nodes.length<32768);
});
test('unsafe loads, impact speeds, depleted fuel and missed recovery fail admission',()=>{
 const load=fixture();load.limits.dynamicPressure=.001;assert.throws(()=>prepareEntry(load),/load limit/);
 const impact=fixture();impact.recovery.maxSpeed=.01;assert.throws(()=>prepareEntry(impact),/recovery speed/);
 const fuel=fixture();fuel.scenario.ship.propellant=.00001;assert.throws(()=>prepareEntry(fuel),/fuel depleted/);
 const orbit=fixture();orbit.scenario.ship.state[4]=Math.sqrt(1/1.5);assert.throws(()=>prepareEntry(orbit),/did not reach/);
 const budget=fixture();budget.scenario.policy.step=1/65536;assert.throws(()=>prepareEntry(budget),/work budget/);
});
