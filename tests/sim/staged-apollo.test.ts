import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/model-sets/aster-selene-staged-expedition.json';
import {prepareStagedApollo,validateStagedApollo} from '../../src/model-set/staged-apollo';
import {sampleVessel,isPresent} from '../../src/model-set/model';
import {Runner} from '../../src/sim/runner';
import {bodyState} from '../../src/sim/dynamics';
const mission=prepareStagedApollo(fixture),d=mission.definition,h=d.hardware;
const distance=(a:number[],b:number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('lunar arrival stays in motion and Eagle has a prograde, bounded rendezvous coast',()=>{
 const insertion=d.programs.orbiterOutbound.at(-1)!;
 let slowest=Infinity,peakAcceleration=0;
 for(let i=0;i<=256;i++){
  const q=mission.sample(h.orbiter.id,insertion.start+(insertion.end-insertion.start)*i/256);
  slowest=Math.min(slowest,Math.hypot(...q.y.slice(3)));
  peakAcceleration=Math.max(peakAcceleration,(q.thrust?.force??0)/q.mass!);
 }
 assert.ok(slowest>.13);assert.ok(peakAcceleration<.3);
 const ascent=d.programs.lander.filter(a=>a.start>=d.liftoff),moon=d.world.bodies[1];
 let excess=-Infinity,minCoastMomentum=Infinity;
 for(let i=0;i<=512;i++){
  const t=d.liftoff+(d.lunarDock-d.liftoff)*i/512;
  const eagle=mission.sample(h.lander.id,t,true).y,odyssey=mission.sample(h.orbiter.id,t,true).y,center=bodyState(moon,t);
  excess=Math.max(excess,distance(eagle.slice(0,3),center.slice(0,3))-distance(odyssey.slice(0,3),center.slice(0,3)));
  if(t>ascent[0].end&&t<ascent[1].start){
   const x=eagle[0]-center[0],y=eagle[1]-center[1],vx=eagle[3]-center[3],vy=eagle[4]-center[4];
   minCoastMomentum=Math.min(minCoastMomentum,x*vy-y*vx);
  }
 }
 assert.ok(minCoastMomentum>.01);assert.ok(excess<.085);
 const before=mission.accounts(d.liftoff).parts.lander.propellant,after=mission.accounts(d.lunarDock,true).parts.lander.propellant;
 const deltaV=h.lander.exhaustVelocity*Math.log((h.lander.dryMass+before)/(h.lander.dryMass+after));
 assert.ok(deltaV<1.3);
});
test('staged Apollo splits exact state and conserves independent hardware inventories',()=>{
 const epochs=[0,d.launch,d.boosterSeparation,d.ascentEnd,d.lunarSeparation,d.landing,d.liftoff,d.lunarDock,d.entryStart,...Object.values(mission.recoveries),d.world.duration];
 const initial=Object.values(h).reduce((n,p)=>n+p.propellant,0);
 for(const t of epochs)for(const before of [false,true]){
  const q=mission.accounts(t,before);assert.ok(Math.abs(q.remainingFuel+q.consumedFuel-initial)<1e-10);
  assert.equal(q.dryMass,1.2);assert.equal(q.activeMass,q.dryMass+q.remainingFuel);
  for(const p of Object.values(q.parts))assert.ok(p.propellant>0&&p.consumedFuel>=0);
 }
 for(const s of mission.separations){assert.ok(Math.abs(s.beforeMass-s.afterMass)<1e-12);assert.ok(distance(s.momentumBefore,s.momentumAfter)<1e-12);}
 const atBoost=mission.accounts(d.boosterSeparation);
 assert.deepEqual(atBoost.parts.booster.y,atBoost.parts.orbiter.y);
 assert.deepEqual(atBoost.parts.orbiter.y,atBoost.parts.lander.y);
 assert.equal(atBoost.parts.orbiter.propellant,h.orbiter.propellant);
 assert.equal(atBoost.parts.lander.propellant,h.lander.propellant);
 const atMoon=mission.accounts(d.lunarSeparation);
 assert.deepEqual(atMoon.parts.orbiter.y,atMoon.parts.lander.y);
 assert.equal(atMoon.parts.lander.propellant,h.lander.propellant);
 assert.equal(atMoon.parts.lander.ownerId,h.lander.id);
 assert.equal(mission.accounts(d.lunarSeparation,true).parts.lander.ownerId,h.orbiter.id);
});
test('real passive orbiter rendezvous pays only lander correction and carries its mass home',()=>{
 const a=mission.sample(h.orbiter.id,d.lunarDock,true),b=mission.sample(h.orbiter.id,d.lunarDock);
 assert.deepEqual(a.y,b.y);assert.equal(a.propellant,b.propellant);
 const left=mission.accounts(d.lunarDock,true),right=mission.accounts(d.lunarDock);
 assert.equal(left.parts.lander.ownerId,h.lander.id);assert.equal(right.parts.lander.ownerId,h.orbiter.id);
 assert.deepEqual(right.parts.lander.y,right.parts.orbiter.y);
 assert.ok(Math.abs(left.parts.lander.propellant-right.parts.lander.propellant-mission.dock.fuelUsed)<1e-13);
 assert.ok(Math.abs(b.mass!-a.mass!-h.lander.dryMass-right.parts.lander.propellant)<1e-12);
 assert.ok(mission.dock.positionError<1.5e-6&&mission.dock.deltaV<1e-6);
 const returnShip=mission.returning.bundle.scenario.ship;
 assert.ok(Math.abs(returnShip.dryMass-h.orbiter.dryMass-h.lander.dryMass-right.parts.lander.propellant)<1e-12);
 assert.equal(mission.orbiterEntry.definition.scenario.ship.dryMass,returnShip.dryMass);
 assert.ok(mission.recoveries.booster<3&&mission.recoveries.orbiter<d.world.duration);
 assert.equal(mission.accounts(d.world.duration).parts.lander.propellant,right.parts.lander.propellant);
});
test('lander capture has independent step-refinement margin',()=>{
 for(const runner of [mission.descent,mission.ascent]){
  const b=structuredClone(runner.bundle);b.scenario.policy.step/=2;
  const refined=new Runner(b),t=runner===mission.descent?d.landing:d.lunarDock;
  const q=refined.advanceTo(t),old=runner.sample(t);
  assert.ok(['running','horizon'].includes(q.status));assert.ok(distance(q.y,old.y)<2e-7);
  assert.ok(Math.abs(q.propellant-old.propellant)<1e-10);
 }
});
test('presence hides attached duplicate glyphs but preserves tanks and query-order independence',()=>{
 const lander=mission.view.vessels.find(v=>v.id===h.lander.id)!,orbiter=mission.view.vessels.find(v=>v.id===h.orbiter.id)!;
 for(const t of [0,d.lunarSeparation-.1,d.lunarDock,d.entryStart]){
  assert.equal(isPresent(lander,t),false);assert.ok(sampleVessel(lander,t).propellant>0);
 }
 assert.equal(isPresent(lander,d.lunarSeparation),true);
 assert.equal(isPresent(lander,d.lunarDock-.001),true);
 const arc=d.programs.orbiterReturn[0],t=orbiter.samples.find(q=>q.t>arc.start&&q.t<arc.end)!.t,a=mission.sample(h.orbiter.id,t);
 assert.ok(a.mass!>h.orbiter.dryMass+a.propellant);
 assert.ok(Math.abs(sampleVessel(orbiter,t).thrust!.force-a.thrust!.force)<1e-7);
 const initial=JSON.stringify(mission.accounts(45));for(const t of [70,0,45,38,87,1])mission.accounts(t);
 assert.equal(JSON.stringify(mission.accounts(45)),initial);
});
test('staged domain rejects unknown ownership, tanks and controls crossing topology',()=>{
 const bad=(mutate:(x:any)=>void,pattern:RegExp)=>{const q=structuredClone(fixture);mutate(q);assert.throws(()=>validateStagedApollo(q),pattern);};
 bad(q=>q.hardware.lander.state=[0,0,0,0,0,0],/unknown physical field/);
 bad(q=>q.hardware.lander.propellant=q.hardware.lander.tankCapacity+1,/propellant|tank|capacity/i);
 bad(q=>q.hardware.lander.id=q.hardware.orbiter.id,/identities/);
 bad(q=>q.programs.stack[0].end=q.boosterSeparation+.1,/arc ownership/);
 bad(q=>q.programs.lander[0].start=q.lunarSeparation-.1,/arc ownership/);
 bad(q=>q.world.ship={},/unknown physical field/);
 bad(q=>q.lunarDock=q.liftoff,/phase order/);
 bad(q=>q.ports[1].rail.rate+=.01,/surface spin/);
 bad(q=>q.programs.stack[0].kick=[1,0,0],/unknown/);
});
test('missed/depleted landing cannot publish staged descendants',()=>{
 const q=structuredClone(fixture);q.hardware.lander.propellant*=.1;
 assert.throws(()=>prepareStagedApollo(q),/depleted|Capture|release|segment/);
});
