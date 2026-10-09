import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareStaged,validateStaged,stagedAccounts,type StagedFlight} from '../../src/model-set/staging';
import {isPresent,sampleVessel,stockAt,setEvents} from '../../src/model-set/model';
import {Runner} from '../../src/sim/runner';
const d=JSON.parse(fs.readFileSync('fixtures/model-sets/selene-staging.json','utf8')) as StagedFlight;
const mission=prepareStaged(d),split=d.separation.t;
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-11,`${a} != ${b}`);

test('assembly owns every component once; atomic zero-kick separation comes from retained event checkpoint',()=>{
 const {stack,booster,payload,separation}=mission;
 assert.equal(stack.bundle.scenario.ship.dryMass,d.booster.dryMass+d.payload.dryMass+d.payload.propellant);
 assert.equal(stack.bundle.scenario.ship.propellant,d.booster.propellant);
 assert.equal(stack.bundle.scenario.ship.cargoMass,d.payload.cargoMass);
 assert.equal(stack.seek(split).y.length,6);assert.equal(stack.snapshot().anchor.t,split);
 assert.deepEqual(booster.bundle.scenario.ship.state,stack.current.y);assert.deepEqual(payload.bundle.scenario.ship.state,stack.current.y);
 assert.equal(booster.bundle.scenario.ship.propellant,stack.current.propellant);assert.equal(payload.bundle.scenario.ship.propellant,d.payload.propellant);
 near(separation.beforeMass,separation.afterMass);separation.momentumBefore.forEach((x,i)=>near(x,separation.momentumAfter[i]));
 assert.deepEqual(setEvents(mission.view).filter(e=>e.t===split).map(e=>e.kind),['thrust-end','separation','thrust-start']);
 assert.equal(booster.sample(split).fuelUsed,0);near(payload.sample(split).fuelUsed!,0);
});

test('complete delivery and recovery conserve freight and all tanks across split, service and rewind',()=>{
 const times=[0,.3,split-1e-8,split,split+1e-8,1.4,1.7631341277606114,1.9296407559406652,2.4,4,1.,.1,4];
 const initialFuel=d.booster.propellant+d.payload.propellant;
 const initialCargo=d.payload.cargoMass+d.world.logistics!.ports.reduce((n,p)=>n+p.cargo,0);
 const initialPortFuel=d.world.logistics!.ports.reduce((n,p)=>n+p.propellant,0);
 for(const t of times){const a=stagedAccounts(mission,t);near(a.remainingFuel+a.consumedFuel,initialFuel);near(a.portPropellant,initialPortFuel);near(a.freight,initialCargo);}
 assert.equal(mission.booster.sample(4).logistics?.dockedPortId,'Cairn');
 assert.equal(mission.payload.sample(4).logistics?.dockedPortId,'Lantern');assert.equal(mission.payload.sample(4).logistics?.cargoMass,0);
 assert.equal(stockAt(mission.view,4).find(s=>s.id==='Lantern')!.cargo,.1);assert.deepEqual(stockAt(mission.view,4).map(s=>s.occupied),[1,1]);
 assert.ok(mission.booster.sample(4).propellant>.1&&mission.payload.sample(4).propellant>.1);
 for(const r of [mission.stack,mission.booster,mission.payload]){const through=r===mission.stack?split:4,mid=(r.bundle.scenario.epoch+through)/2;r.seek(mid);const restored=Runner.deserialize(r.serialize());assert.deepEqual(restored.current,r.current);assert.deepEqual(restored.advanceTo(through),r.sample(through));}
});

test('presence distinguishes one assembly from two children, with no prebirth child propagation',()=>{
 const [assembly,booster,payload]=mission.view.vessels;
 assert.deepEqual(mission.view.vessels.map(v=>isPresent(v,split-1e-9)),[true,false,false]);
 assert.deepEqual(mission.view.vessels.map(v=>isPresent(v,split)),[false,true,true]);
 assert.throws(()=>sampleVessel(booster,split-1e-9),/outside/);assert.throws(()=>sampleVessel(payload,0),/outside/);assert.throws(()=>sampleVessel(assembly,split+1e-9),/outside/);
 assert.equal(booster.samples[0].t,split);assert.equal(payload.samples[0].t,split);assert.equal(assembly.samples.at(-1)!.t,split);
 assert.equal(booster.ledger.some(e=>e.kind==='dock'),false);assert.equal(payload.ledger.some(e=>e.kind==='launch'),false);
});

test('version, manifest, tanks, split conflicts, storage and sibling-dependent operations reject',()=>{
 const cases:((b:StagedFlight)=>void)[]=[
 b=>(b as {modelVersion:string}).modelVersion='staged-flight-v2',
 b=>b.payload.propellant=1,
 b=>Object.assign(b.payload,{state:[0,0,0,0,0,0]}),
 b=>Object.assign(b.booster,{cargoMass:.1}),
 b=>Object.assign(b.separation,{kick:[.1,0,0]}),
 b=>b.booster.propellant=2,
 b=>b.payload.cargoMass=.2,
 b=>b.payload.id=b.booster.id,
 b=>b.separation.t+=.001,
 b=>b.programs.stack.thrustArcs![0].end+=.001,
 b=>b.programs.stack.operations!.push({id:'illegal',kind:'transfer',t:.1,portId:'Cairn',cargo:.1,propellant:0}),
 b=>b.programs.payload.operations!.push({id:'refuel-from-sibling',kind:'transfer',t:3,portId:'Lantern',cargo:0,propellant:.2}),
 b=>b.programs.booster.thrustArcs![0].start=.7,
 b=>b.world.policy.step=1/8192,
 ];
 for(const change of cases){const bad=structuredClone(d);change(bad);assert.throws(()=>validateStaged(bad));}
});

test('failed child or duplicated freight cannot publish an admitted mission',()=>{
 const bad=structuredClone(d);bad.programs.payload.thrustArcs![0].throttle=.1;assert.throws(()=>prepareStaged(bad),/Wren/);
 const duplicate=structuredClone(d);duplicate.payload.cargoMass=.2;duplicate.world.logistics!.cargoCapacity=.2;const op=duplicate.programs.payload.operations![1];if(op.kind==='transfer')op.cargo=-.2;assert.throws(()=>prepareStaged(duplicate),/Wren|Kestrel|mission/);
});
