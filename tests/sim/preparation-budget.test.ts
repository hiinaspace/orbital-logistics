import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Runner} from '../../src/sim/runner';
import type {Bundle} from '../../src/sim/schema';
const bundle:Bundle=JSON.parse(readFileSync('fixtures/traffic/selene-ground-service.json','utf8')).source.vessels[0].bundle;
test('preparation storage allowance preserves every accepted canonical event and state',()=>{
 const plain=new Runner(bundle),limited=new Runner(bundle,{maxNodeStorageBytes:31_000_000}),end=bundle.scenario.duration;
 plain.advanceTo(end);limited.advanceTo(end);assert.equal(limited.current.status,'horizon');
 assert.deepEqual(limited.snapshot(),plain.snapshot());assert.deepEqual(limited.ledger,plain.ledger);
 for(let i=0;i<=64;i++)assert.deepEqual(limited.sample(end*i/64),plain.sample(end*i/64));
 assert.deepEqual(limited.eventBoundaries,plain.eventBoundaries);
});
test('storage refusal is bounded and independent of advancement partition near thrust activation',()=>{
 const end=bundle.scenario.duration,budget=100_000,one=new Runner(bundle,{maxNodeStorageBytes:budget}),many=new Runner(bundle,{maxNodeStorageBytes:budget});
 one.advanceTo(end);for(let i=1;i<=128;i++)many.advanceTo(end*i/128);
 assert.ok(one.ledger.some(event=>event.kind==='thrust-start'));
 assert.equal(one.current.status,'work-limit');assert.equal(one.current.detail,'retained-node storage budget');
 assert.deepEqual(one.snapshot(),many.snapshot());assert.deepEqual(one.ledger,many.ledger);
 // The lunar caller reserves an additional64KiB fixed/event/mutable-tail envelope.
 assert.ok(one.ownStorageBytes()<budget+65536);
 assert.throws(()=>new Runner(bundle,{maxNodeStorageBytes:NaN}),/Invalid preparation/);
});
