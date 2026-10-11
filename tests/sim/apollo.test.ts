import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/model-sets/aster-selene-expedition.json';
import entryFixture from '../../fixtures/model-sets/aster-entry.json';
import {prepareApollo,type ApolloMission} from '../../src/model-set/apollo';
import {prepareEntry,type EntryFlight} from '../../src/model-set/entry';
import {sampleVessel,stockAt} from '../../src/model-set/model';
import {Runner} from '../../src/sim/runner';
import {portState} from '../../src/sim/logistics';

test('Apollo phase admission rejects silent dropped burns and invalid support',()=>{
 for(const change of [
  (d:ApolloMission)=>{d.arcs[0].end=d.ascentEnd+.01;},
  (d:ApolloMission)=>{d.arcs[0].start=d.landing+.1;d.arcs[0].end=d.liftoff-.1;},
  (d:ApolloMission)=>{if(d.ports[0].rail.kind==='surface')d.ports[0].rail.rate+=1;},
  (d:ApolloMission)=>{d.scenario.ship.cargoMass=.1;},
 ]){
  const d=structuredClone(fixture) as ApolloMission;change(d);assert.throws(()=>prepareApollo(d));
 }
});
test('entry absolute epoch keeps the compensated circular ephemeris',()=>{
 const d=structuredClone(entryFixture) as EntryFlight;d.modelVersion='entry-rk4-v3';
 d.scenario.bodies.push({id:'distant',mu:.001,radius:.01,rail:{kind:'circular',center:[0,0,0],u:[1,0,0],v:[0,1,0],radius:20,rate:.03,phase:.7}});
 const a=prepareEntry(d,{displayRate:16}),shifted=structuredClone(d),offset=23;
 shifted.scenario.epoch=offset;const rail=shifted.scenario.bodies[1].rail;if(rail.kind==='circular')rail.phase-=offset*rail.rate;
 const b=prepareEntry(shifted,{displayRate:16});
 assert.ok(Math.abs(a.contact.t+offset-b.contact.t)<2e-10);
 assert.ok(Math.max(...a.contact.before.map((x,i)=>Math.abs(x-b.contact.before[i])))<2e-10);
});
test('finite expedition keeps exact seams, paid capture, recovery and rewind',()=>{
 const r=prepareApollo(fixture),d=r.definition,v=r.view.vessels[0];
 const upper=r.ascent.nodes.at(-1)!.z,first=r.outbound.sample(d.ascentEnd);
 assert.deepEqual(first.y,upper.slice(0,6));assert.equal(first.propellant,upper[6]);
 const entryInitial=r.returning.sample(d.entryStart);assert.deepEqual(r.entry.nodes[0].z,[...entryInitial.y,entryInitial.propellant]);
 assert.ok(r.capture.positionError+5e-7<2e-6&&r.capture.deltaV+1e-6<2e-6);
 assert.equal(sampleVessel(v,d.landing).logistics?.dockedPortId,d.ports[1].id);
 assert.deepEqual(sampleVessel(v,d.landing+1).y,portState(d.ports[1],d.landing+1));
 assert.ok(r.entry.contact.before[6]>.5);
 assert.ok(v.boundaries.some(b=>b.t===r.entry.contact.t));
 const final=sampleVessel(v,r.view.window.end);assert.equal(final.entryPhase,'recovered');
 sampleVessel(v,d.launch+.1);assert.deepEqual(sampleVessel(v,r.view.window.end),final);
 assert.ok(stockAt(r.view,d.landing+1).every(p=>p.occupied>=0&&p.occupied<=1));
 // The coarser grid is replayed without admitting its larger landing residual.
 // Refining from 1/512 to the production 1/1024 is checked independently against DOP853.
 const bundle=r.outbound.bundle;bundle.scenario.policy.step*=2;
 const coarse=new Runner(bundle);const terminal=coarse.advanceTo(d.landing);
 assert.equal(terminal.status,'running');
 const refined=r.outbound.sample(d.landing);
 assert.ok(Math.max(...terminal.y.map((x,i)=>Math.abs(x-refined.y[i])))<4e-6);
 assert.ok(Math.abs(terminal.propellant-refined.propellant)<1e-8);
 const unsafe=structuredClone(fixture);const burn=unsafe.arcs.find(a=>a.id==='translunar-injection')!;
 burn.end=burn.start+.6;burn.direction=[0,-1,0];burn.steering={kind:'spherical-smoothstep-v1',keys:[{offset:0,direction:[0,-1,0]},{offset:burn.end-burn.start,direction:[0,-1,0]}]};
 // Clear initial and final phase epochs do not excuse an air crossing in between.
 assert.throws(()=>prepareApollo(unsafe),/vacuum.*(unsupported-approach|collision)/);
 const excessive=structuredClone(fixture);excessive.entry.limits.dynamicPressure=0;
 assert.throws(()=>prepareApollo(excessive),/ascent load limit/);
});
