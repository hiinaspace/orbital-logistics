import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LunarEngine} from '../../src/lunar/engine';
import {LunarWorld,validateLunar,GRID,type LunarDefinition} from '../../src/lunar/world';
import {LunarViewStore} from '../../src/lunar/view';
import {sampleVessel,stockAt} from '../../src/model-set/model';
import {resourcesAt} from '../../src/traffic/resources';
import {Runner} from '../../src/sim/runner';
const fixture=JSON.parse(readFileSync('fixtures/traffic/selene-ground-service.json','utf8')) as LunarDefinition;
function advance(e:LunarEngine,t:number,budget=128){let calls=0;do{e.advanceTo(t,budget);assert.ok(++calls<20000);}while((!e.initialized||e.frontier<t)&&!e.halt);assert.equal(e.halt,undefined);}
test('lunar service pins the trial domain and bounds target allocation',()=>{
 const d=validateLunar(fixture);
 for(const change of [(d:LunarDefinition)=>{d.source.vessels[0].bundle.scenario.ship.exhaustVelocity=3;},
  (d:LunarDefinition)=>{const r=d.source.vessels[0].bundle.scenario.bodies[1].rail;if(r.kind==='circular')r.phase=.1;},
  (d:LunarDefinition)=>{d.stations[1].cargoRate=.1;}]){const bad=structuredClone(d);change(bad);assert.throws(()=>validateLunar(bad));}
 const world=new LunarWorld(d);assert.throws(()=>world.extend(4),/allocation budget/);assert.equal(world.chunks.length,0);
});
test('rolling depot leases match canonical checkpoints and off-grid queries',()=>{
 const d=validateLunar(fixture),world=new LunarWorld(d);world.extend(1.5);
 const s=structuredClone(d.source.vessels[0].bundle.scenario),epoch=3174*GRID;
 s.epoch=epoch;s.duration=1.5-epoch;s.ship.state=world.state(epoch);s.ship.propellant=0;delete s.ship.engine;
 const rail=s.logistics!.ports[1].rail;if(rail.kind!=='ballistic')throw Error('target');rail.epoch=epoch;rail.validUntil=1.5;rail.state=world.state(epoch);
 const r=new Runner({scenario:s,program:{schemaVersion:3,id:'lease',burns:[]}});
 world.assertLease(r,epoch,1.5);
 const nodes=world.nodes;for(const t of [1.4,.501,.499,epoch+GRID*.3])assert.deepEqual(r.portState('Crescent',t),world.state(t));assert.equal(world.nodes,nodes);
});
test('service decisions and cumulative deliveries ignore request and work partition',()=>{
 const one=new LunarEngine(fixture),many=new LunarEngine(fixture);
 advance(one,2,128);
 for(let t=0;t<=2;t+=1/64)advance(many,t,1);
 assert.equal(one.frontier,2);assert.equal(one.stats.delivered,many.stats.delivered);
 assert.equal(one.stats.voyages,many.stats.voyages);
 assert.deepEqual(one.missions,many.missions);assert.deepEqual(one.resources,many.resources);assert.deepEqual(one.current(),many.current());
 assert.ok(one.stats.delivered>=.15);assert.ok(one.oldest>0);assert.ok(one.current().ships[0].fuelUsed!>0);
 assert.ok(one.delta().stats.physicalBytes<40_000_000);
});
test('held lunar history keeps pose, stocks, event states and smooth future steering',()=>{
 const e=new LunarEngine(fixture),store=new LunarViewStore(fixture);advance(e,0);store.ingest(e.delta());
 advance(e,.2);store.ingest(e.delta());const cursor=.167123,view=store.view(cursor),before=sampleVessel(view.vessels[0],cursor),stock=stockAt(view,cursor);
 advance(e,.5);store.ingest(e.delta(),true);
 assert.deepEqual(sampleVessel(store.view(cursor).vessels[0],cursor),before);assert.deepEqual(stockAt(store.view(cursor),cursor),stock);
 store.release();advance(e,1.2);store.ingest(e.delta());const live=store.view(e.frontier),v=live.vessels[0];
 assert.ok(store.stats.viewBytes<36_000_000);
 for(const m of e.missions)for(const arc of m.bundle.program.thrustArcs!){const t=(arc.start+arc.end)/2;if(t<store.oldest||t>e.frontier)continue;const sample=sampleVessel(v,t);assert.equal(sample.thrust!.id,arc.id);assert.ok(Math.abs(sample.thrust!.acceleration-38.4)<1e-10);}
 const at=sampleVessel(v,e.frontier),anchor=[...e.resources].reverse().find(a=>a.t<=e.frontier)!,stocks=stockAt(live,e.frontier);
 assert.ok(Math.abs(stocks.reduce((n,p)=>n+p.propellant,0)+at.propellant+at.fuelUsed!-(20+resourcesAt(anchor,e.definition.stations,e.frontier).fuelImported-resourcesAt(anchor,e.definition.stations,e.frontier).fuelExported))<1e-9);
});

test('supply refusals retain the physical ground state and leave stocks untouched',()=>{
 const d=structuredClone(fixture);d.stations[0].cargo=0;d.stations[0].cargoRate=0;
 const e=new LunarEngine(d);advance(e,1,16);
 assert.equal(e.stats.voyages,0);assert.equal(e.stats.delivered,0);assert.ok(e.stats.planningFailures>0);
 assert.equal(e.current().ships[0].propellant,6);assert.equal(e.current().ships[0].fuelUsed,0);
 assert.equal(e.current().ships[0].logistics!.dockedPortId,'Northhaven');assert.equal(e.resources.length,1);
 const store=new LunarViewStore(d);store.ingest(e.delta());assert.equal(sampleVessel(store.view(1).vessels[0],1).propellant,6);
});

test('rolling lunar display clips expired dwell events while retaining current interpolation',()=>{
 const e=new LunarEngine(fixture),store=new LunarViewStore(fixture);
 for(let target=0;target<=2;target+=1/64){
  advance(e,target);store.ingest(e.delta());const cursor=Math.max(store.oldest,target-.1),view=store.view(cursor),v=view.vessels[0];
  assert.ok(v.samples[0].t>=view.window.start);assert.ok(v.ledger.every(event=>event.t>=view.window.start&&event.t<=view.window.end));
  const times=[...new Set([view.window.start,view.window.end,...v.ledger.map(event=>event.t)])].sort((a,b)=>a-b);
  for(let i=0;i<times.length-1;i++)assert.doesNotThrow(()=>sampleVessel(v,(times[i]+times[i+1])/2));
  assert.ok(Math.hypot(...sampleVessel(v,cursor).y)>0);
 }
});
