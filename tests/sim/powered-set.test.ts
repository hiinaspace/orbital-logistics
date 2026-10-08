import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareSet,sampleVessel,stockAt,setEvents,type ModelSet} from '../../src/model-set/model';
import {Runner} from '../../src/sim/runner';
import {logisticsResult} from '../../src/sim/logistics';
const set:ModelSet=JSON.parse(readFileSync('fixtures/model-sets/selene-powered.json','utf8'));
const run=prepareSet(set);

test('powered lunar fleet conserves freight and continuous fuel usage through both paid returns',()=>{
 const ports=run.vessels[0].bundle.scenario.logistics!.ports;
 const cargo=ports.reduce((s,p)=>s+p.cargo,0),fuel=ports.reduce((s,p)=>s+p.propellant,0)+run.vessels.reduce((s,v)=>s+v.bundle.scenario.ship.propellant,0);
 for(const t of new Set([0,.55,3.1,5.7,8.3,12,...setEvents(run).map(e=>e.t)])) {
  const stocks=stockAt(run,t),ships=run.vessels.map(v=>sampleVessel(v,t));
  assert.ok(Math.abs(stocks.reduce((s,p)=>s+p.cargo,0)+ships.reduce((s,v)=>s+v.logistics!.cargoMass,0)-cargo)<1e-12);
  assert.ok(Math.abs(stocks.reduce((s,p)=>s+p.propellant,0)+ships.reduce((s,v)=>s+v.propellant+v.fuelUsed!,0)-fuel)<1e-12);
 }
 assert.ok(Math.abs(stockAt(run,12).find(p=>p.id==='Selene Hub')!.cargo-.32)<1e-15);
 for(const v of run.vessels) {
  const last=v.samples.at(-1)!;assert.equal(v.bundle.program.burns.length,0);assert.equal(v.bundle.program.thrustArcs!.length,4);
  assert.equal(last.logistics!.dockedPortId,'Nightfall');assert.ok(last.propellant>.05);
  assert.ok(logisticsResult(v.bundle.scenario.logistics!,last.logistics!,last.propellant,12).complete);
  for(const dock of v.ledger.filter(e=>e.kind==='dock')) {assert.ok(dock.positionError!+1e-8<1e-7);assert.ok(dock.deltaV+1e-8<1e-7);}
 }
});

test('drawing fuel remains continuous through thrust, with discrete refuelling at event completion',()=>{
 for(const v of run.vessels) {
  const r=new Runner(v.bundle);r.advanceTo(12);
  for(const arc of v.bundle.program.thrustArcs!) {
   const t=(arc.start+arc.end)/2,s=sampleVessel(v,t),canonical=r.sample(t);
   assert.ok(Math.abs(s.propellant-canonical.propellant)<1e-12);assert.ok(Math.abs(s.fuelUsed!-canonical.fuelUsed!)<1e-12);
   assert.equal(s.thrust!.force,v.bundle.scenario.ship.engine!.maxThrust);
   assert.equal(sampleVessel(v,arc.end).thrust,undefined);
   assert.ok(Math.abs(sampleVessel(v,arc.end-1e-9).propellant-sampleVessel(v,arc.end).propellant)<1e-8);
  }
  const refuel=v.ledger.find(e=>e.kind==='transfer' && e.propellantAfter>e.propellantBefore)!;
  assert.ok(Math.abs(sampleVessel(v,refuel.t-1e-9).propellant-refuel.propellantBefore)<1e-12);
  assert.equal(sampleVessel(v,refuel.t).propellant,refuel.propellantAfter);
 }
});
