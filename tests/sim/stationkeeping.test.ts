import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Runner} from '../../src/sim/runner';
import {validateBundle,type Bundle,type PoweredRail} from '../../src/sim/schema';
import {prepareSet,orbitError,sampleVessel,displayPortState,type ModelSet} from '../../src/model-set/model';
const set=JSON.parse(readFileSync('fixtures/model-sets/orison-maintained.json','utf8')) as ModelSet;
const bundle=set.vessels[0].bundle,rail=(b:Bundle)=>b.scenario.logistics!.ports[1].rail as PoweredRail;
const close=(a:number[],b:number[],tol=1e-10)=>assert.ok(Math.hypot(...a.map((x,i)=>x-b[i]))<tol);

test('maintained relay owns paid propulsion, preserves an orbit envelope and hosts a paid visitor between corrections',()=>{
 const run=prepareSet(set),station=run.maintained!.Meridian,r=new Runner(bundle);assert.equal(r.advanceTo(64).status,'horizon');
 const checks=set.stations[1].maintenance!.checks;assert.ok(checks.filter(c=>c.outcome==='correct').length>=2);assert.ok(checks.some(c=>c.outcome==='skip'));assert.ok(checks.every(c=>c.evaluations<=64));
 for(const s of station.samples){const e=orbitError(s.y,set.stations[1].maintenance!.reference);assert.ok(e.position<.02&&e.velocity<.005);assert.ok(s.propellant>=.3);}
 assert.ok(station.samples.at(-1)!.propellant<.6);assert.ok(station.arcs.some(a=>a.start>=36));assert.ok(station.ledger.every(e=>e.kind!=='burn'));
 for(const t of [34,34.1,35,35.999])close(r.sample(t).y,r.portState('Meridian',t));
 close(r.sample(36).y,r.portState('Meridian',36));assert.equal(r.sample(36).logistics!.dockedPortId,undefined);assert.equal(r.sample(36).logistics!.cargoMass,.05);
 const capture=r.ledger.find(e=>e.id==='capture')!;assert.ok(capture.positionError!<1e-7&&capture.deltaV<1e-7);assert.ok(capture.fuelUsed>=0);
 assert.ok(Math.hypot(...r.portState('Meridian',34).map((x,i)=>x-run.maintained!.Meridian.baseline.find(s=>s.t===34)!.y[i]))>1e-5);
 const saved=r.advanceTo(35);const restored=Runner.restore(bundle,r.snapshot());assert.deepEqual(restored.sample(35),saved);assert.deepEqual(restored.advanceTo(64),r.advanceTo(64));
 const partition=new Runner(bundle);for(const t of [40,4,33.3,12,60,0,35,64])partition.sample(t);assert.deepEqual(partition.advanceTo(64),r.advanceTo(64));assert.deepEqual(partition.ledger,r.ledger);
});

test('powered targets reject hidden legacy fields, unsafe/depleted/expired/budgeted providers and exchange without mutating input',()=>{
 for(const mutate of [(b:Bundle)=>b.scenario.logistics!.modelVersion='ballistic-ports-v2',(b:Bundle)=>rail(b).validUntil=63,(b:Bundle)=>rail(b).policy.maxNodes=2,(b:Bundle)=>rail(b).propulsion.propellant=.000001,(b:Bundle)=>rail(b).state=[1.1,0,0,0,0,0],(b:Bundle)=>rail(b).program.operations=[]]){
  const b=structuredClone(bundle);mutate(b);if(rail(b).propulsion.propellant<.3)rail(b).minPropellant=0;
  const before=structuredClone(b);assert.throws(()=>new Runner(b));assert.deepEqual(b,before);
 }
 const missing=structuredClone(set);delete missing.stations[1].maintenance;assert.throws(()=>prepareSet(missing),/maintenance reference/);
 const b=structuredClone(bundle);b.program.operations!.splice(3,0,{id:'exchange',t:35,kind:'transfer',portId:'Meridian',cargo:-.01,propellant:0});assert.throws(()=>validateBundle(b),/exchange/);
 const changed=structuredClone(bundle);rail(changed).program.thrustArcs![0].throttle*=.9;assert.equal(new Runner(changed).advanceTo(64).status,'operation-rejected');
 const r=new Runner(bundle);assert.throws(()=>r.portState('Meridian',65));assert.throws(()=>r.portSample('Meridian',-1));
});

function endpointBundle():Bundle {
 const b=structuredClone(bundle);b.scenario.duration=4;b.scenario.ship={...rail(b).propulsion,id:'Probe',cargoMass:0,state:[...rail(b).state]};
 for(const p of b.scenario.logistics!.ports){if(p.rail.kind==='ballistic'||p.rail.kind==='powered')p.rail.validUntil=4;}
 rail(b).minPropellant=0;rail(b).program={schemaVersion:3,id:'endpoint-target',burns:[],thrustArcs:[{id:'early',start:1,end:2,throttle:.01,direction:[1,0,0]},{id:'later',start:3,end:4,throttle:.01,direction:[0,1,0]}]};
 b.program={schemaVersion:3,id:'endpoint-visitor',burns:[],thrustArcs:[{...rail(b).program.thrustArcs![0],id:'copy'}],operations:[{id:'join',kind:'dock',t:2,portId:'Meridian'},{id:'leave',kind:'undock',t:3,portId:'Meridian'}]};return b;
}
test('maintenance endpoints allow capture at burn end and release at next start, and forbid every overlapping attachment',()=>{
 const b=endpointBundle(),r=new Runner(b);assert.equal(r.advanceTo(4).status,'horizon');close(r.sample(2.5).y,r.portState('Meridian',2.5));close(r.sample(3).y,r.portState('Meridian',3));
 for(const time of [1,1.5,3]){const c=structuredClone(b);c.program.thrustArcs=[];c.program.operations=[{id:'bad',kind:'dock',t:time,portId:'Meridian'}];assert.throws(()=>validateBundle(c),/maintenance/);}
 const retained=structuredClone(b);retained.program.operations!.pop();assert.throws(()=>validateBundle(retained),/overlaps/);
 const crossing=structuredClone(b);crossing.program.operations![1].t=3.5;assert.throws(()=>validateBundle(crossing),/overlaps/);
});

test('station display shares the canonical target and cannot become a physical planning source',()=>{
 const run=prepareSet(set),r=new Runner(bundle),station=run.maintained!.Meridian;
 for(const t of [12,13,14,20,34,35,36,63,64]){const p=displayPortState(run.world.ports[1],run.portSamples,t);close(p,r.portState('Meridian',t),1e-5);close(sampleVessel(station,t).y,p,1e-5);}
 const before=r.portState('Meridian',34);run.portSamples.Meridian[0].y[0]=999;station.samples[0].propellant=999;close(r.portState('Meridian',34),before);
});


test('bounded maintenance authoring responds to a changed initial state and records budget/reserve failures',()=>{
 const report=JSON.parse(readFileSync('docs/design/stationkeeping/search-report.json','utf8'));
 assert.equal(report.status,'accepted');assert.notDeepEqual(report.maintenance.arcs,report.perturbedMaintenance.arcs);
 assert.ok(report.perturbedMaintenance.maxErrors[0]<.02&&report.perturbedMaintenance.maxErrors[1]<.005);
 assert.match(report.authoringFailures.evaluationBudget,/budget/);assert.match(report.authoringFailures.fuelReserve,/admission|depleted/);
});
