import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {puzzles,puzzleFor} from '../../src/puzzles/catalog';
import {solutionFromRun,readSolutions,retainSolution} from '../../src/puzzles/solutions';
import {validateBundle,type Bundle} from '../../src/sim/schema';
import {Runner} from '../../src/sim/runner';
import {solveRendezvous} from '../../src/planning/rendezvous';
import {predict} from '../../src/planning/predict';
import {followedUntil,trailAlpha} from '../../src/view/layers';
const fixture = (label: string) => validateBundle(JSON.parse(readFileSync(`fixtures/m4-${label}-solution.json`,'utf8')));
const run = (b: Bundle) => new Runner(b).advanceTo(b.scenario.epoch+b.scenario.duration);

test('fixed puzzle starters are unsolved; two paid solutions trade time for fuel',() => {
  for(const p of puzzles) assert.equal(solutionFromRun(p.bundle,run(p.bundle)),undefined);
  const patient=fixture('patient'),express=fixture('express');
  for(const b of [patient,express]) {
    assert.equal(run(b).status,'horizon');
    assert.equal(predict(b,0,24,true).accuracy?.status,'converged');
  }
  const a=solutionFromRun(patient,run(patient))!,b=solutionFromRun(express,run(express))!;
  assert.ok(a.score.time>b.score.time+1.5);assert.ok(a.score.fuel<b.score.fuel*0.7);
  assert.equal(a.score.hardware,1);assert.equal(b.score.hardware,1);
  assert.equal(retainSolution(retainSolution([],a),b).length,2);
  assert.equal(retainSolution([a,b],a).length,2);
});
test('deadline lives in saved simulation rules, and successful early completion survives the horizon',()=>{
  const fast=fixture('express'),slow=fixture('patient');
  fast.scenario=puzzles[1].bundle.scenario;slow.scenario=puzzles[1].bundle.scenario;
  assert.ok(solutionFromRun(fast,run(fast)));assert.equal(solutionFromRun(slow,run(slow)),undefined);
  assert.equal(run(fast).logistics!.completedAt,18);assert.equal(run(slow).logistics!.completedAt,undefined);
  const bad=structuredClone(fast);bad.scenario.logistics!.objective.deadline=NaN;assert.throws(()=>validateBundle(bad));
  bad.scenario.logistics!.objective.deadline=25;assert.throws(()=>validateBundle(bad));
});
test('only fixed rules and completed actual runs qualify; persisted scores are independently recomputed',()=>{
  const b=fixture('patient'),r=new Runner(b),record=solutionFromRun(b,r.advanceTo(24))!;
  assert.equal(solutionFromRun(b,new Runner(b).sample(20)),undefined);
  const changed=structuredClone(b);changed.scenario.ship.propellant=0.6;
  assert.equal(puzzleFor(changed.scenario),undefined);assert.equal(solutionFromRun(changed,run(changed)),undefined);
  const laterFailure=structuredClone(b);laterFailure.program.operations!.push({id:'failed',kind:'dock',portId:'Depot',t:23});
  assert.equal(solutionFromRun(laterFailure,run(laterFailure)),undefined);
  record.score={time:0,fuel:0,hardware:0};
  const saved=readSolutions(JSON.stringify([record,{puzzleId:'return-ticket',program:{broken:true}}]));
  assert.equal(saved.length,1);assert.ok(saved[0].score.time>19);assert.ok(saved[0].score.fuel>0.13);
  const changedRules=structuredClone(record);changedRules.scenario.ship.propellant=0.6;assert.deepEqual(readSolutions(JSON.stringify([changedRules])),[]);
  assert.deepEqual(readSolutions('{broken'),[]);
  assert.deepEqual(readSolutions(JSON.stringify([{...record,program:{...record.program,burns:[]}}])),[]);
});
test('port targeting preserves player epochs/prefix, proposes paid docking, and charges gross consumed fuel',()=>{
  const b=structuredClone(puzzles[0].bundle);
  b.program.burns.push({id:'return',t:15.5,referenceBodyId:'primary',basis:'radial-transverse-normal-v2',orientationAxis:[0,0,1],normal:0,radial:0,transverse:0});
  const before=structuredClone(b),solved=solveRendezvous(b,'return',96,{portId:'Home',arrivalEpoch:19.5});
  assert.deepEqual(b,before);assert.equal(solved.status,'proposed');if(solved.status!=='proposed')return;
  const p=solved.proposal;assert.equal(p.departure.t,15.5);assert.equal(p.arrival.t,19.5);
  assert.deepEqual(p.program.burns.slice(0,2),b.program.burns.slice(0,2));
  assert.deepEqual(p.addedOperations!.map(o=>o.kind),['undock','dock']);
  const result=run({...b,program:p.program});assert.ok(solutionFromRun({...b,program:p.program},result));
  assert.equal(p.propellantUsed,result.logistics!.fuelUsed);
  assert.ok(Math.abs(p.propellantUsed-(b.scenario.ship.propellant-result.propellant)-0.1)<1e-12);
});
test('port solver rejects service, invalid arrival, work exhaustion, prefix failures and stale itinerary actions without mutation',()=>{
  for(const [epoch,arrival,work] of [[4.7,19.5,96],[15.5,24,96],[15.5,19.5,1]] as const){
    const b=structuredClone(puzzles[0].bundle);b.program.burns.push({id:'return',t:epoch,referenceBodyId:'primary',basis:'radial-transverse-normal-v2',orientationAxis:[0,0,1],normal:0,radial:0,transverse:0});
    const before=structuredClone(b),result=solveRendezvous(b,'return',work,{portId:'Home',arrivalEpoch:arrival});assert.equal(result.status,'failed');assert.deepEqual(b,before);
  }
  const failed=fixture('express');failed.program.operations![1].kind='undock';
  const result=solveRendezvous(failed,'return',96,{portId:'Home',arrivalEpoch:18});assert.equal(result.status,'failed');
});
test('following grey applies only to identical event prefixes and old trail opacity decreases',()=>{
  const a=fixture('express').program,b=structuredClone(a);b.burns[2].t=13;
  assert.equal(followedUntil(a,a,17),17);assert.ok(followedUntil(a,b,17)<13);
  const c=structuredClone(a);c.operations!.splice(1,1);assert.ok(followedUntil(a,c,17)<0);
  assert.ok(trailAlpha(0,24)>trailAlpha(2,24));assert.ok(trailAlpha(2,24)>trailAlpha(12,24));
  assert.ok(trailAlpha(24,24)>0);
});
