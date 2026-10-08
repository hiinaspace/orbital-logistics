import {test} from 'node:test';
import assert from 'node:assert/strict';
import definition from '../../fixtures/traffic/orison-service.json';
import {TrafficEngine} from '../../src/traffic/engine';
import {TrafficViewStore} from '../../src/traffic/view';
import {resourcesAt} from '../../src/traffic/resources';
import {sampleVessel} from '../../src/model-set/model';
import type {TrafficDefinition} from '../../src/traffic/planner';
const d=definition as TrafficDefinition;
function advance(e:TrafficEngine,t:number,budget=256){while(e.frontier<t)e.advanceTo(t,budget);}
function conservation(e:TrafficEngine) {
 const a=e.snapshot(),r=a.resources,ships=a.current.ships;
 const cargo=r.stocks.reduce((n,p)=>n+p.cargo,0)+ships.reduce((n,s)=>n+s.logistics!.cargoMass,0)+r.cargoExported-r.cargoImported;
 const fuel=r.stocks.reduce((n,p)=>n+p.propellant,0)+ships.reduce((n,s)=>n+s.propellant+s.fuelUsed!,0)+r.fuelExported-r.fuelImported;
 assert.ok(Math.abs(cargo-d.stations.reduce((n,p)=>n+p.cargo,0))<1e-10);
 assert.ok(Math.abs(fuel-d.stations.reduce((n,p)=>n+p.propellant,0)-d.vessels.reduce((n,v)=>n+v.propellant,0))<1e-10);
}
test('fleet partitions and disposable queries preserve authoritative state and conservation',()=>{
 const a=new TrafficEngine(d),b=new TrafficEngine(d);advance(a,48);
 for(const t of [.13,.3,.8,3.824522336946932,7,12.34,48]){advance(b,t,3);b.delta();b.snapshot();conservation(b);}
 assert.deepEqual(a.snapshot(),b.snapshot());conservation(a);
 assert.ok(a.delta().stats.delivered>.5);
});
test('rolling history remains bounded and historical views only expose admitted plans',()=>{
 const e=new TrafficEngine(d),store=new TrafficViewStore(d);store.ingest(e.delta());
 assert.equal(store.view(0).vessels[0].arcs.length,0);
 for(let i=1;i<=16;i++){const after=e.frontier;advance(e,i*24);store.ingest(e.delta(after));conservation(e);}
 assert.equal(e.frontier,384);assert.equal(store.oldest,256);
 assert.ok(store.frames.length<2300);assert.ok(store.episodes.length<32);
 for(const t of [256,280.123,383.5,384]){const view=store.view(t);for(const v of view.vessels){assert.ok(Number.isFinite(sampleVessel(v,t).y[0]));assert.ok(v.samples.at(-1)!.t>384);}}
});
test('pause can accept a bounded pending reply without evicting the cursor',()=>{
 const e=new TrafficEngine(d),store=new TrafficViewStore(d);advance(e,140);store.ingest(e.delta());const cursor=store.oldest;
 const after=e.frontier;advance(e,141);store.ingest(e.delta(after),true);
 assert.equal(store.oldest,cursor);assert.doesNotThrow(()=>store.view(cursor));store.release();assert.equal(store.oldest,13);
});
test('retryable planning waits keep serviced loadouts and advance the window',()=>{
 let failed=false;const e=new TrafficEngine(d,{planningWait:(id,v)=>{if(id==='Kestrel' && v===0 && !failed){failed=true;return 'Test transient';}}});advance(e,32);conservation(e);
 const p=e.delta();assert.ok(p.events.some(x=>x.kind==='planning-failed'));assert.ok(p.stats.delivered>0);
 const services=p.events.filter(x=>x.shipId==='Kestrel' && x.kind==='transfer');assert.equal(services.filter(x=>x.id==='Kestrel:0:service').length,1);
});
test('external flows count actual imports and exports at full and empty buffers',()=>{
 const depots=d.stations.map(p=>({...p,cargoRate:1,propellantRate:-1}));
 const initial={t:0,stocks:depots.map(p=>({id:p.id,cargo:p.cargoCapacity,propellant:0})),cargoImported:0,cargoExported:0,fuelImported:0,fuelExported:0};
 const r=resourcesAt(initial,depots,100);assert.equal(r.cargoImported,0);assert.equal(r.fuelExported,0);
});

test('stock shortages retry while other ships and boundary flows continue',()=>{
 const value=structuredClone(d);value.stations[0].cargo=0;value.stations[0].cargoRate=.005;
 const e=new TrafficEngine(value);advance(e,64);
 assert.ok(e.delta().events.some(e=>e.shipId==='Kestrel' && e.kind==='planning-failed'));
 assert.ok(e.snapshot().ships[0].voyage>0);assert.ok(e.snapshot().ships[1].voyage>0);
});

test('a real paid flight fault isolates one ship and retains its known epoch',async()=>{
 const {Runner}=await import('../../src/sim/runner');
 const e=new TrafficEngine(d,{episodeAdapter:episode=>{
  if(episode.shipId!=='Kestrel')return episode.runner;
  const b=structuredClone(episode.bundle);b.program.operations=[];b.program.thrustArcs=[{...b.program.thrustArcs![0],end:b.scenario.duration}];return new Runner(b);
 }});advance(e,48);
 const a=e.snapshot(),fault=a.current.ships[0];assert.equal(a.ships[0].stage,'fault');assert.ok(fault.fuelUsed!>0);assert.ok(a.ships[1].voyage>3);conservation(e);
 const store=new TrafficViewStore(d);store.ingest(e.delta());const view=store.view(48);
 assert.equal(sampleVessel(view.vessels[0],48).activity?.knownEpoch,fault.activity?.knownEpoch);
 const {stateAt}=await import('../../src/model-set/model');assert.throws(()=>stateAt(view.vessels[0],48),/no state/);
});

test('a failed production flight admission waits for a later window without recharging service',()=>{
 const value=structuredClone(d),arc=value.templates[0].arcs[0];arc.direction=[-arc.direction[1],arc.direction[0],arc.direction[2]];
 const e=new TrafficEngine(value);advance(e,24);const events=e.delta().events.filter(e=>e.shipId==='Kestrel');
 assert.ok(events.filter(e=>e.kind==='planning-failed').length>=2);
 assert.equal(events.filter(e=>e.kind==='transfer').length,1);
 assert.ok(!events.some(e=>e.kind==='undock' || e.kind==='unavailable'));
});
