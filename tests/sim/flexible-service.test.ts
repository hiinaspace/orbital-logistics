import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Runner} from '../../src/sim/runner';
import {shootForces} from '../../src/maintained/shoot';
import type {State} from '../../src/sim/schema';
const fixture=JSON.parse(readFileSync('fixtures/traffic/orison-maintained-service.json','utf8'));
test('spherical force shooting admits axis-aligned hardware-feasible forces and is rotation covariant, preserving the old cube by default',()=>{
 const results=[];
 for(const angle of [0,.76]){
  const c=Math.cos(angle),sn=Math.sin(angle),rotate=(y:State):State=>[c*y[0]-sn*y[1],sn*y[0]+c*y[1],y[2],c*y[3]-sn*y[4],sn*y[3]+c*y[4],y[5]],scenario=structuredClone(fixture.world.scenario);
  scenario.bodies=scenario.bodies.slice(0,1);scenario.duration=4;scenario.ship.state=rotate([5,0,0,0,Math.sqrt(1/5),0]);
  const program={schemaVersion:3 as const,id:'force-sphere-calibration',burns:[],thrustArcs:[{id:'a',start:0,end:1,direction:[c,sn,0] as [number,number,number],throttle:.55/.8},{id:'b',start:3,end:4,direction:[-c,-sn,0] as [number,number,number],throttle:.22/.8}]};
  const truth=new Runner({scenario,program}),target=truth.sample(4);assert.equal(target.status,'horizon');
  const seed=[.55*c,.55*sn,0,-.22*c,-.22*sn,0],pulses=[{start:0,end:1},{start:3,end:4}] as [{start:number;end:number},{start:number;end:number}];
  if(angle===0)assert.throws(()=>shootForces(scenario,pulses,target.y,seed,64),/Force bound exceeded/);
  const shot=shootForces(scenario,pulses,target.y,seed,64,'sphere');assert.ok(shot.residual<2e-11);assert.ok(shot.arcs.every(a=>a.throttle<=1));assert.ok(Math.abs(shot.runner.sample(4).propellant-target.propellant)<1e-10);results.push(shot.runner.sample(4).propellant);
 }
 assert.ok(Math.abs(results[0]-results[1])<1e-10);
});
test('antipodal Hohmann seed is finite on either side and exact endpoint geometry, without executed impulses',async()=>{
 const {economicalSeed}=await import('../../src/adaptive/plan');
 const tau=Math.PI*Math.sqrt(2.5**3),from:[number,number,number,number,number,number]=[2,0,0,0,Math.sqrt(.5),0];
 for(const angle of [Math.PI-1e-5,Math.PI,Math.PI+1e-5]){
  const target:State=[3*Math.cos(angle),3*Math.sin(angle),0,-Math.sqrt(1/3)*Math.sin(angle),Math.sqrt(1/3)*Math.cos(angle),0],seed=economicalSeed(from,target,tau,1.95);assert.ok(seed.every(Number.isFinite));assert.ok(Math.hypot(...seed)<.2);
 }
});

test('coupled witness reconstructs loaded dwell, paid captures and conserved fuel delivery; rejects unfunded or altered dependencies',async()=>{
 const {CoupledTrip}=await import('../../src/adaptive/plan'),{validateAdaptive}=await import('../../src/adaptive/world');
 const witness=JSON.parse(readFileSync('docs/design/flexible-service/finite-witness.json','utf8')),d=validateAdaptive(witness.definition),p=witness.plan,trip=new CoupledTrip(d,p),s=p.schedule;
 assert.ok(trip.deltaV>.25&&trip.deltaV<.4);assert.equal(trip.events.filter(e=>e.kind==='thrust-end').length,4);
 for(const t of [s.relayArrival+.5,24,27.5,32,39]){const ship=trip.sample(t),station=trip.world.sample(d.relay.id,t);assert.deepEqual(ship.y,station.y);assert.equal(ship.thrust,undefined);assert.equal(ship.propellant,trip.afterTransferFuel);assert.ok(station.mass!>6);}
 const transfer=trip.world.chunks.flatMap(c=>c.data.boundaries).find(b=>b.t===s.relayArrival+.5)!;
 assert.ok(Math.abs((transfer.before as {mass:number}).mass-(transfer.after as {mass:number}).mass)<2e-15);
 assert.ok(Math.abs(p.fuel-trip.home.propellantAfter-trip.burned-p.delivery)<1e-12);
 assert.ok(Math.abs(d.relay.ship.propellant+p.delivery-trip.world.anchor.fuel-trip.stationBurned)<1e-12);
 const variants=[(v:any)=>v.delivery+=.01,(v:any)=>v.visitorId='other',(v:any)=>v.inbound.scenario.ship.dryMass+=1,(v:any)=>v.inbound.scenario.ship.propellant+=.01,(v:any)=>v.controls.find((c:any)=>c.t===24).arcs[0].throttle*=.5,(v:any)=>v.schedule.release=38.9,(v:any)=>v.controls.pop()];
 for(const mutate of variants){const bad=structuredClone(p);mutate(bad);assert.throws(()=>new CoupledTrip(d,bad));}
 const encoded=JSON.parse(JSON.stringify(p));const restored=new CoupledTrip(d,encoded);assert.deepEqual(restored.events,trip.events);const pose=restored.sample(25);encoded.schedule.release+=8;encoded.base.y[0]+=1;assert.deepEqual(restored.sample(25),pose);assert.throws(()=>restored.plan.schedule.release+=8,TypeError);
});

test('sphere-edge finite differences stay feasible while correcting a full-axis force seed',()=>{
 const s=structuredClone(fixture.world.scenario);s.bodies=s.bodies.slice(0,1);s.duration=4;s.ship.engine={maxThrust:.8,maxAcceleration:.6};s.ship.state=[5,0,0,0,Math.sqrt(.2),0];
 const truth=new Runner({scenario:s,program:{schemaVersion:3,id:'edge-truth',burns:[],thrustArcs:[{id:'a',start:0,end:1,direction:[1,0,0],throttle:.79/.8},{id:'b',start:3,end:4,direction:[-1,0,0],throttle:.22/.8}]}});
 const shot=shootForces(s,[{start:0,end:1},{start:3,end:4}],truth.sample(4).y,[.8,0,0,-.22,0,0],96,'sphere');assert.ok(shot.evaluations>6);assert.ok(shot.residual<2e-11);assert.ok(shot.arcs.every(a=>a.throttle<=1));
});

test('aggregate station propulsion crosses its acceleration cap and depletes only the engine-owned tank',()=>{
 const s=structuredClone(fixture.world.scenario);s.bodies=[{id:'negligible',mu:1e-12,radius:1e-6,rail:{kind:'fixed',position:[1e6,0,0]}}];s.duration=40;s.ship={...structuredClone(fixture.relay.ship),state:[0,0,0,0,0,0],dryMass:6.05,engine:{maxThrust:.06,maxAcceleration:.0092}};
 const r=new Runner({scenario:s,program:{schemaVersion:3,id:'aggregate-cap',burns:[],thrustArcs:[{id:'station-only',start:0,end:40,direction:[1,0,0],throttle:1}]}});
 const transition=(6.65-.06/.0092)*3/.06,empty=transition+3/.0092*Math.log((.06/.0092)/6.05),a=r.sample(transition-1),b=r.sample(transition+1),final=r.advanceTo(40);
 assert.ok(Math.abs(a.thrust!.force-.06)<1e-14);assert.ok(b.thrust!.force<.06);assert.ok(Math.abs(b.thrust!.force/(6.05+b.propellant)-.0092)<1e-14);
 assert.equal(final.status,'fuel-depleted');assert.ok(Math.abs(final.t-empty)<1e-11);assert.equal(final.propellant,0);assert.ok(Math.abs(final.fuelUsed!-.6)<1e-14);assert.ok(final.y[3]>0);
});


test('shared paid capture rejects invalid budgets without mutating either participant',async()=>{
 const {paidCapture}=await import('../../src/sim/capture'),from:State=[2,0,0,0,0,0],to:State=[2,0,0,0,.01,0],ship={dryMass:1,cargoMass:.05,propellant:.3,exhaustVelocity:3},limits={position:.1,velocity:.1};
 const originals=structuredClone({from,to,ship});const capture=paidCapture(from,to,ship,limits,'test');assert.deepEqual({from,to,ship},originals);assert.deepEqual(capture.y,to);assert.notEqual(capture.y,to);assert.ok(capture.propellantAfter<ship.propellant);
 for(const propellant of [-1,NaN,0])assert.throws(()=>paidCapture(from,to,{...ship,propellant},limits,'test'));
 for(const exhaustVelocity of [0,-1,Infinity])assert.throws(()=>paidCapture(from,to,{...ship,exhaustVelocity},limits,'test'));
 assert.throws(()=>paidCapture(from,to,ship,{position:0,velocity:0},'test'));assert.deepEqual({from,to,ship},originals);
});

test('an exhausted controller budget records an unpaid coast and an observable failure',async()=>{
 const {AdaptiveWorld,validateAdaptive}=await import('../../src/adaptive/world');const d=validateAdaptive({...fixture,domain:'adaptive-relay-v1'}),anchor={t:0,y:[...d.relay.ship.state] as State,fuel:.6,used:0,origin:d.origin.state,baseline:d.relay.ship.state};anchor.y[3]+=.005;
 const w=new AdaptiveWorld(d,anchor,{used:0,limit:0}),job=w.extend(8,0);while(!job.next().done){}
 assert.equal(w.failed,1);assert.equal(w.anchor.fuel,.6);assert.equal(w.anchor.used,0);assert.equal(w.chunks[0].data.arcs.length,0);assert.match(w.chunks[0].data.ledger.find(e=>e.kind==='planning-failed')!.detail!,/budget exhausted/);assert.ok(w.anchor.y.some((v,i)=>v!==anchor.y[i]));
});
