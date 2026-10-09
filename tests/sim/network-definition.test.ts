import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateNetwork,networkDepots} from '../../src/network/model';
import {OriginIntervals} from '../../src/network/origin';
import {AdaptiveWorld} from '../../src/adaptive/world';
import {CoupledTrip} from '../../src/adaptive/plan';
import type {Runner} from '../../src/sim/runner';
const fixture=JSON.parse(readFileSync('fixtures/traffic/orison-relay-network.json','utf8'));
test('network identity forbids sharing a depot across differing physical worlds',()=>{
 const d=validateNetwork(fixture);assert.equal(networkDepots(d).length,3);assert.equal(networkDepots(d)[0].berths,2);
 const changed=structuredClone(fixture);changed.lanes[1].origin.state[0]+=.01;
 assert.throws(()=>validateNetwork(changed));
 const duplicate=structuredClone(fixture);duplicate.lanes[1].vessels[0].id=duplicate.lanes[0].vessels[0].id;duplicate.lanes[1].world.scenario.ship.id=duplicate.lanes[0].world.scenario.ship.id;
 assert.throws(()=>validateNetwork(duplicate),/identities/);
});
test('origin reuse requires the identical canonical interval, field and anchor',()=>{
 const d=validateNetwork(fixture),a=new AdaptiveWorld(d.lanes[0]),b=new AdaptiveWorld(d.lanes[1]),cache=new OriginIntervals();
 const bundle={scenario:a.scenario(0,8,a.anchor.origin,0,undefined,false),program:{schemaVersion:3 as const,id:'adaptive-origin-0',burns:[]}};
 const same={...bundle,scenario:b.scenario(0,8,b.anchor.origin,0,undefined,false)};
 const r=cache.get(bundle);assert.equal(cache.get(same),r);assert.equal(cache.hits,1);
 const different=structuredClone(bundle);different.scenario.ship.state[0]+=1e-12;
 assert.notEqual(cache.get(different),r);assert.equal(cache.misses,2);
 assert.deepEqual(r.sample(3.141).y,cache.get(bundle).sample(3.141).y);
});

test('transient physical budget rejects an interval before allocating it',()=>{
 const d=validateNetwork(fixture),budget=new OriginIntervals(true,1),world=new AdaptiveWorld(d.lanes[0],undefined,undefined,budget),initial=structuredClone(world.anchor),job=world.extend(8,0);
 assert.equal(job.next().done,false);assert.throws(()=>job.next(),/storage budget/);assert.deepEqual(world.anchor,initial);assert.equal(world.chunks.length,0);assert.equal(budget.nodes,0);world.dispose();
});

test('global budget counts shared live intervals once and keeps ownership after cache eviction',()=>{
 const d=validateNetwork(fixture),world=new AdaptiveWorld(d.lanes[0]),budget=new OriginIntervals(true,4097);
 const bundle={scenario:world.scenario(0,8,world.anchor.origin,0,undefined,false),program:{schemaVersion:3 as const,id:'adaptive-origin-0',burns:[]}};
 const runner=budget.get(bundle),a=budget.hold(runner),b=budget.watch({runners:[runner,runner]});
 assert.equal(runner.retainedNodes,2049);assert.equal(runner.bundle.scenario.policy.maxNodes,3072);budget.reserve();assert.equal(budget.peakResidentNodes,3072);
 budget.evict(9);assert.equal(budget.nodes,0);
 assert.throws(()=>budget.reserve(2049),/storage budget/);a();
 assert.throws(()=>budget.reserve(2049),/storage budget/);b();assert.doesNotThrow(()=>budget.reserve(2049));
});

test('a refused reconstructed-trip registration releases every private owner',()=>{
 class RefuseTrip extends OriginIntervals {
  owners=0;refuse=false;
  override watch(owner:{runners:Runner[]}){const release=super.watch(owner);this.owners++;if('outbound' in owner)this.refuse=true;let active=true;return ()=>{if(active){active=false;this.owners--;release();}};}
  override reserve(extra=0){if(this.refuse&&extra===0)throw Error('Forced trip registration refusal');super.reserve(extra);}
 }
 const d=validateNetwork(fixture),saved=JSON.parse(readFileSync('docs/design/multiship-service/replay-512.json','utf8')),budget=new RefuseTrip(),job=CoupledTrip.createJob(d.lanes[0],saved.lanes[0].plans[0],budget);
 assert.throws(()=>{while(!job.next().done){}},/Forced trip registration refusal/);assert.equal(budget.owners,0);
 budget.refuse=false;assert.doesNotThrow(()=>budget.reserve());
});
