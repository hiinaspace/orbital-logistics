import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MaintainedEngine} from '../../src/maintained/engine';
import {MaintainedViewStore} from '../../src/maintained/view';
import {Runner} from '../../src/sim/runner';
const definition=JSON.parse(readFileSync('fixtures/traffic/orison-maintained-service.json','utf8'));
function advance(e:MaintainedEngine,t:number,work=4096){while(e.advanceTo(t,work).yielded){} }
function facts(e:MaintainedEngine){const s=e.snapshot();return {t:s.frontier,current:s.current,resources:s.resources,stationFuel:s.stats.stationFuel,used:s.stats.stationFuelUsed,completed:s.stats.completed,failed:s.stats.planningFailed};}
test('online maintenance and paired targeting span multiple chunks, make repeated paid visits and conserve explicit fuel supply',()=>{
 const e=new MaintainedEngine(definition),store=new MaintainedViewStore(definition);advance(e,0);let after=-1,peak=0;
 for(let t=0;t<=192;t+=4){advance(e,t,24);const p=e.delta(after);store.ingest(p);peak=Math.max(peak,store.stats.viewBytes);const view=store.view(t);assert.equal(view.id,definition.id);assert.ok(view.maintained!.Meridian.samples.length>0);after=t;}
 const s=e.snapshot();assert.ok(s.stats.completed>=4);assert.ok(s.stats.controllerCorrected>=8);assert.ok(s.stats.planningFailed>0);assert.equal(s.stats.controllerFailed,0);assert.ok(s.stats.stationFuelUsed>0);assert.ok(s.stats.maxVisitEvaluations<=192);assert.ok(peak<8_000_000);assert.ok(s.stats.runnerNodes<100000);
 const stock=s.resources.stocks.reduce((n,p)=>n+p.propellant,0),ship=s.current.ships[0].propellant;assert.ok(Math.abs(4+.9+s.resources.fuelImported-stock-ship-s.stats.shipFuelUsed)<1e-10);
 const before=JSON.stringify(facts(e));for(const t of [store.oldest,150,191,160,store.frontier]){const view=store.view(t);assert.ok(view.vessels[0].samples.length);assert.ok(view.maintained!.Meridian.samples.at(-1)!.t<=t+40);}
 assert.equal(JSON.stringify(facts(e)),before);assert.ok(new TextEncoder().encode(JSON.stringify({frames:store.frames,events:store.events,boundaries:store.boundaries,resources:store.resources,chunks:store.chunks,visits:store.visits,current:store.current})).byteLength<store.stats.viewBytes);const a=new MaintainedEngine(definition);advance(a,192,4096);assert.deepEqual(facts(a),facts(e));
});
test('yielded planning preserves the held cursor and deterministic admitted programs, and retained owner joins stay canonical',()=>{
 const e=new MaintainedEngine(definition);advance(e,40.013,1);const d=e.delta(),visit=d.visits.find(v=>v.departure===30)!;assert.ok(visit);assert.ok(visit.leaseChunks.length>=4);
 const r=new Runner(visit.bundle);assert.equal(r.advanceTo(62).status,'horizon');for(const t of [40,44,46,48,52,56,60,62]){const owned=e.world.sample('Meridian',t),target=r.portSample('Meridian',t);assert.deepEqual(target.y,owned.y);assert.equal(target.propellant,owned.propellant);}
 const store=new MaintainedViewStore(definition);store.ingest(d);const cursor=40.013,held=store.view(cursor);advance(e,41);store.ingest(e.delta(cursor),true);assert.equal(store.oldest,d.oldest);assert.ok(store.view(40.017).vessels[0].samples.length);assert.deepEqual(store.view(cursor).vessels[0].samples.filter(s=>s.t<=cursor),held.vessels[0].samples.filter(s=>s.t<=cursor));
});
test('bounded maintenance and transfer failures coast/retry without resetting fuel; attached failure halts and post-release failure isolates',()=>{
 const failed=new MaintainedEngine(definition,{controlBudget:1,planningBudget:1});advance(failed,24);const p=failed.delta();assert.ok(p.stats.controllerFailed>0);assert.ok(p.stats.planningFailed>0);assert.equal(p.stats.completed,0);assert.equal(p.stats.stationFuel,.6);assert.equal(p.current.ships[0].propellant,.9);
 const attached=new MaintainedEngine(definition,{attachedReleaseFailure:true});advance(attached,60);assert.match(attached.halt!,/Attached/);assert.equal(attached.frontier,46);assert.equal(attached.delta().current.ships[0].logistics!.dockedPortId,'Meridian');const held=new MaintainedViewStore(definition);held.ingest(attached.delta());assert.equal(held.view(46).vessels[0].samples.at(-1)!.logistics!.dockedPortId,'Meridian');
 const free=new MaintainedEngine(definition,{flightAdapter:b=>{const v=structuredClone(b);v.scenario.ship.propellant=.01;return new Runner(v);}});advance(free,80);const fault=free.delta();assert.equal(fault.halt,undefined);assert.equal(fault.current.ships[0].activity!.kind,'fault');assert.ok(fault.stats.controllerCorrected>0);assert.equal(fault.current.ships[0].propellant,0);
});
test('maintained domain rejects unsupported fields, identities and nonfinite inventory',()=>{
 for(const mutate of [(d:any)=>d.reference.rate=.1,(d:any)=>d.world.scenario.bodies[0].mu=2,(d:any)=>d.stations[0].tankCapacity=NaN,(d:any)=>d.world.scenario.ship.state[2]=.01,(d:any)=>d.origin.id=d.relay.id]){
  const d=structuredClone(definition);mutate(d);assert.throws(()=>new MaintainedEngine(d));
 }
});
test('Lambert seed recovers normalized circular quarter and three-quarter coasts without introducing impulses',async()=>{
 const {transferSeed}=await import('../../src/maintained/seed');
 for(const [to,time] of [[[0,1,0,-1,0,0],Math.PI/2],[[0,-1,0,1,0,0],3*Math.PI/2]] as const){
  const force=transferSeed([1,0,0,0,1,0],[...to],time,1);assert.ok(Math.hypot(...force)<1e-12);
 }
});
test('cached live drawing streams preserve plan knowledge, paid captures and event-side samples after duplicate replies and rewind',async()=>{
 const {sampleVessel}=await import('../../src/model-set/model');
 const e=new MaintainedEngine(definition);advance(e,80);const p=e.delta(),store=new MaintainedViewStore(definition);store.ingest(p);
 const baseline=store.view(64);store.ingest(structuredClone(p));assert.deepEqual(store.view(64),baseline);
 assert.equal(store.view(63).vessels[0].arcs.some(a=>a.id.startsWith('trip-1-')),false);
 const known=store.view(64),trip=p.visits.find(v=>v.departure===70)!;assert.ok(known.vessels[0].arcs.some(a=>a.id.startsWith('trip-1-')));
 for(const epoch of [70,71,71.6,82.2,84,86,98.2,100,102]){
  const actual=sampleVessel(known.vessels[0],epoch),expected=trip.samples.find(s=>s.t===epoch)!;
  assert.ok(Math.hypot(...actual.y.map((x,i)=>x-expected.y[i]))<1e-12);
  assert.ok(Math.abs(actual.propellant-expected.propellant)<1e-12);
  assert.equal(actual.logistics?.dockedPortId,expected.logistics?.dockedPortId);
 }
 assert.deepEqual(store.view(64),baseline);store.view(80);assert.deepEqual(store.view(64),baseline);
});
