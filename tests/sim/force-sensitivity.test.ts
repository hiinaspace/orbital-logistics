import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Runner} from '../../src/sim/runner';
import {shootForces} from '../../src/maintained/shoot';
import type {Scenario,Vec3} from '../../src/sim/schema';
const fixture=JSON.parse(readFileSync('fixtures/traffic/orison-maintained-service.json','utf8'));
function scenario():Scenario {
 const s=structuredClone(fixture.world.scenario);s.duration=4;s.ship.state=[5,0,.2,0,Math.sqrt(.2),.02];s.policy.step=1/128;s.ship.engine={maxThrust:.8,maxAcceleration:.6};return s;
}
function run(s:Scenario,forces:number[]):Runner {
 const r=new Runner({scenario:s,program:{schemaVersion:3,id:'sensitivity-calibration',burns:[],thrustArcs:[{start:s.epoch,end:s.epoch+1},{start:s.epoch+3,end:s.epoch+4}].map((p,i)=>{const f=forces.slice(i*3,i*3+3),n=Math.hypot(...f);return {...p,id:`p${i}`,direction:(n?f.map(v=>v/n):[1,0,0]) as Vec3,throttle:n/.8};})}});assert.equal(r.advanceTo(s.epoch+4).status,'horizon');return r;
}
test('RK4 sensitivities match central force probes including fuel coupling, spatial gravity and off-grid pulse events',()=>{
 const s=scenario();s.epoch=.123;
 for(const forces of [[.07,.02,.01,-.03,.04,-.01],Array(6).fill(0)]){
  const jac=run(s,forces).terminalForceJacobian()!;assert.ok(jac);
  for(let j=0;j<6;j++){
   const a=[...forces],b=[...forces],h=1e-6;a[j]+=h;b[j]-=h;
   const ay=run(s,a).current.y,by=run(s,b).current.y;
   for(let i=0;i<6;i++)assert.ok(Math.abs(jac[i][j]-(ay[i]-by[i])/(2*h))<2e-6,`row ${i} column ${j}`);
  }
 }
});
test('sensitivity shooting converges from zero and uses fewer sweeps with unchanged canonical arrival and fuel checks',()=>{
 const s=scenario(),truth=run(s,[.07,.02,.01,-.03,.04,-.01]),target=truth.current.y,pulses:[{start:number;end:number},{start:number;end:number}]=[{start:0,end:1},{start:3,end:4}];
 const slow=shootForces(s,pulses,target,undefined,96,'sphere'),fast=shootForces(s,pulses,target,undefined,96,'sphere',undefined,'sensitivity');
 assert.ok(fast.residual<2e-11);assert.ok(fast.evaluations<slow.evaluations/2);assert.ok(Math.abs(fast.runner.current.propellant-truth.current.propellant)<1e-10);
});
test('acceleration-cap branches explicitly fall back to finite probes',()=>{
 const s=scenario();s.ship.engine!.maxAcceleration=.06;
 const forces=[.116,.002,.001,-.03,.04,-.01],truth=run(s,forces);assert.equal(truth.terminalForceJacobian(),undefined);
 const seed=[...forces];seed[0]-=.0001;
 const shot=shootForces(s,[{start:0,end:1},{start:3,end:4}],truth.current.y,seed,96,'sphere',undefined,'sensitivity');assert.ok(shot.residual<2e-11);assert.ok(shot.evaluations>6);
});
test('sphere-edge sensitivity updates stay within hardware bounds and numerical work is charged',()=>{
 const s=scenario(),truth=run(s,[.79,0,0,-.22,0,0]),pulses:[{start:number;end:number},{start:number;end:number}]=[{start:0,end:1},{start:3,end:4}];
 const shot=shootForces(s,pulses,truth.current.y,[.8,0,0,-.22,0,0],96,'sphere',undefined,'sensitivity');assert.ok(shot.residual<2e-11);assert.ok(shot.arcs.every(a=>a.throttle<=1));
 const work={used:0,limit:2};assert.throws(()=>shootForces(s,pulses,truth.current.y,undefined,96,'sphere',work,'sensitivity'),/Shared propagation budget/);assert.equal(work.used,2);
});
test('sensitivities follow safety subdivisions rather than the authored coarse grid',()=>{
 const s=scenario();s.policy.step=1;s.ship.state=[1.6,0,.01,0,Math.sqrt(1/1.6),.01];
 const forces=[.02,.01,.001,-.01,.01,-.001],runner=run(s,forces),jac=runner.terminalForceJacobian()!;assert.ok(runner.retainedNodes>10);
 for(let j=0;j<6;j++){const a=[...forces],b=[...forces];a[j]+=1e-6;b[j]-=1e-6;const ay=run(s,a).current.y,by=run(s,b).current.y;for(let i=0;i<6;i++)assert.ok(Math.abs(jac[i][j]-(ay[i]-by[i])/2e-6)<2e-6);}
});
