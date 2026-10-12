import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import profile from '../../fixtures/model-sets/recurring-cycler-profile.json';
import definition from '../../fixtures/model-sets/aster-selene-cycler-fleet-service.json';
import {prepareRecurringFleet,prepareFleet} from '../../src/cycler/fleet';
import {FleetEngine} from '../../src/cycler/service-engine';
import {FleetViewStore} from '../../src/cycler/service-store';
import {fleetChunk,fleetBase,FLEET_HISTORY,FLEET_RETENTION,FLEET_CHUNK,FLEET_BYTES,FLEET_ROWS,type FleetServiceDefinition} from '../../src/cycler/service-view';
import {samplePassThrough,FLEET_MAX_EPOCH,fleetOccurrence,fleetEventCount} from '../../src/cycler/query';
import {passThroughResources} from '../../src/cycler/view';
import {integrate,STEP,MARGIN} from '../../src/compact/physics';
import {rotateState,rotate} from '../../src/compact/query';
import type {RecurringFleetProfile,FleetProfile} from '../../src/cycler/types';
import type {CubicControl} from '../../src/sim/cubic';
import type {State} from '../../src/sim/schema';
const source=profile as RecurringFleetProfile,d=definition as FleetServiceDefinition;
const p=prepareRecurringFleet(source),sample=(actor:number,t:number,left=false)=>samplePassThrough({template:p,actor,continuous:true},t,left);
const norm=(a:number[],b:number[])=>Math.hypot(...a.map((x,i)=>x-b[i]));

test('closed maintained macrocycle preserves rider resources while carrier maintenance is permanently paid',()=>{
 const closures=p.events.filter(e=>e.kind==='maintenance');assert.equal(closures.length,2);
 for(const e of closures){assert.ok(e.positionError!+MARGIN<1e-7&&e.velocityError!+MARGIN<1e-7);assert.ok(e.fuelUsed>0&&p.recurrence!.carrierDeltaV[e.actor]<=1e-5);assert.ok(norm(sample(e.actor,p.duration,true).y,sample(e.actor,p.duration).y)<1e-7);assert.ok(sample(e.actor,p.duration,true).propellant>sample(e.actor,p.duration).propellant);}
 for(const actor of [0,1]){assert.ok(sample(actor,100*p.duration).propellant<sample(actor,p.duration).propellant);assert.ok(sample(actor,FLEET_MAX_EPOCH).propellant>.6);assert.ok(Math.abs(sample(actor,100*p.duration).propellant-(10*Math.exp(-100*p.recurrence!.carrierDeltaV[actor]/4)-4))<1e-12);}
 for(const actor of [2,3]){assert.equal(sample(actor,p.duration).propellant,3);assert.equal(sample(actor,p.duration).logistics!.cargoMass,.15);assert.ok(Math.abs(sample(actor,100*p.duration).fuelUsed!-100*p.cost[actor])<1e-10);}
 for(const t of [0,p.duration-STEP,p.duration,p.duration+STEP,100*p.duration,999999]){
  const total=sample(0,t).fuelUsed!+sample(1,t).fuelUsed!+sample(2,t).fuelUsed!+sample(3,t).fuelUsed!,r=passThroughResources(p,t),remaining=p.hardware.reduce((n,_,actor)=>n+sample(actor,t).propellant,0);
  assert.ok(Math.abs(18+r.fuelImported-remaining-total)<1e-9);
 }
 assert.throws(()=>prepareFleet(source as unknown as FleetProfile),/fixed field/);
 for(const step of [STEP/2,STEP/4]){const finer=prepareRecurringFleet(source,step);assert.ok(finer.work.oraclePosition<1e-8&&finer.work.oracleVelocity<1e-8);for(let actor=0;actor<4;actor++)assert.ok(norm(sample(actor,p.duration-1).y,samplePassThrough({template:finer,actor,continuous:true},p.duration-1).y)<1e-8);}
});

test('late absolute-epoch physical replay stays within the admitted numerical corridor',()=>{
 const reports=[];
 for(const offset of [0,17*p.duration,Math.floor((FLEET_MAX_EPOCH-p.duration)/p.duration)*p.duration]){
  let worst=0;
  for(let actor=0;actor<4;actor++){
   const groups=actor<2?[source.carriers[actor].segments]:source.riders[actor-2].mission.stages.map(s=>s.segments);
   for(const group of groups){let actual=rotateState(group[0].initial,p.rate*offset%(2*Math.PI));
    for(const seg of group){
     const control: CubicControl|undefined=seg.control?{...seg.control,start:offset+seg.start,end:offset+seg.end,keys:seg.control.keys.map(k=>[offset+k[0],...rotate(k.slice(1),p.rate*offset%(2*Math.PI))]),coefficients:seg.control.coefficients.map(c=>c.map(v=>rotate(v,p.rate*offset%(2*Math.PI))))}:undefined;
     const trace=integrate(offset+seg.start,offset+seg.end,actual,control,STEP,actor<2?1e-5:4);actual=trace.rows.at(-1)!.slice(1,7) as State;
     const expected=rotateState(seg.endpoint,p.rate*offset%(2*Math.PI)),error=norm(actual,expected);worst=Math.max(worst,error);assert.ok(error<8e-8,`${offset} ${actor} ${seg.id}: ${error}`);
    }
   }
  }reports.push({offset,worst});
 }
 fs.writeFileSync('docs/evidence/continuous-cycler-late.json',JSON.stringify({reports},null,2)+'\n');
});

test('long rolling service bounds storage and keeps exact funded resource history and held-head scrubbing',()=>{
 const engine=new FleetEngine(d,source),store=new FleetViewStore(d);engine.advanceTo(32);store.ingest(engine.delta());
 let peakBytes=0,peakSamples=0,peakPacket=0;
 const target=20*p.duration;
 while(engine.frontier<target){engine.advanceTo(Math.min(target,engine.frontier+8));const delta=engine.delta();store.ingest(delta);peakBytes=Math.max(peakBytes,delta.stats.retainedDrawingBytes);peakSamples=Math.max(peakSamples,delta.stats.retainedDrawingSamples);peakPacket=Math.max(peakPacket,delta.stats.packetBytes);assert.ok(delta.stats.retainedDrawingBytes<=FLEET_BYTES&&delta.stats.retainedDrawingSamples<=FLEET_ROWS);}
 assert.equal(store.stats.deliveries,80);assert.ok(Math.abs(store.stats.parcelsDelivered-12)<1e-12);assert.ok(store.oldest>=engine.frontier-FLEET_HISTORY-1e-10);
 const scene=store.view(engine.frontier-32);assert.ok(scene.vessels.every(v=>v.samples.length<15000));assert.equal(scene.window.end,engine.frontier+32);assert.ok(scene.window.end-scene.window.start<=FLEET_RETENTION+1e-9);
 const held=store.oldest,heldCursor=held+1,oldSample=scene.vessels[0].samples.find(q=>q.t>=heldCursor)!;engine.advanceTo(engine.frontier+1);store.ingest(engine.delta(),true);assert.equal(store.oldest,held);assert.deepEqual(store.view(heldCursor).vessels[0].samples.find(q=>q.t===oldSample.t),oldSample);
 store.release();assert.equal(store.oldest,store.watermark);assert.throws(()=>store.view(store.oldest-.01),/outside retained/);
 fs.writeFileSync('docs/evidence/continuous-cycler-rollout.json',JSON.stringify({frontier:engine.frontier,stats:store.stats,peakBytes,peakSamples,peakPacket,work:p.work,carrierDeltaV:p.recurrence!.carrierDeltaV},null,2)+'\n');
});

test('failed supplies, maintenance and packet admission stop at event-left without partial publication',()=>{
 for(const [fault,t] of [[{importCap:0},source.riders[0].mission.moonRefill],[{rejectAt:p.duration},p.duration]] as const){
  const engine=new FleetEngine(d,source,fault);engine.advanceTo(32);while(!engine.halt)engine.advanceTo(Math.min(t+1,engine.frontier+8));const delta=engine.delta();assert.ok(delta.frontier<t);assert.ok(delta.halt);assert.deepEqual(delta.resources.at(-1),{...passThroughResources(p,delta.frontier),stocks:[{id:'Cairn',cargo:0,propellant:0},{id:'Haven',cargo:0,propellant:0}],fuelExported:0});const store=new FleetViewStore(d);
  // First packet omitted its previously sent template: a fresh client must reject.
  assert.throws(()=>store.ingest(delta),/worker packet admission|Missing/);
 }
 const engine=new FleetEngine(d,source,{packetLimit:1});assert.throws(()=>engine.advanceTo(32),/packet budget/);assert.equal(engine.frontier,0);assert.throws(()=>engine.advanceTo(32),/permanently stopped/);
 const healthy=new FleetEngine(d,source);healthy.advanceTo(32);const delta=healthy.delta(),store=new FleetViewStore(d);store.ingest(delta);const bad=structuredClone(delta);bad.template=undefined;bad.frontier=33;bad.oldest=0;bad.chunks=[{...delta.chunks[0],index:1000,start:0}];assert.throws(()=>store.ingest(bad),/Invalid fleet chunk/);assert.equal(store.frontier,32);
 assert.ok(fleetBase(p,d).vessels.length===4);assert.equal(FLEET_CHUNK,8);
});

test('constructed late calendar boundaries retain exact event sides and resource counts',()=>{
 assert.doesNotThrow(()=>fleetChunk(p,3916));
 for(const k of [1,17,130,134,512,4096]){
  const aliases=[k*p.duration,(k-1)*p.duration+p.duration];
  for(const t of aliases){
   assert.equal(fleetOccurrence(p,t).index,k);assert.equal(fleetOccurrence(p,t).local,0);
   assert.equal(fleetOccurrence(p,t,true).index,k-1);assert.equal(fleetOccurrence(p,t,true).local,p.duration);
   for(const actor of [0,1])assert.ok(sample(actor,t,true).propellant>sample(actor,t).propellant);
  }
  for(const f of p.flows){const t=k*p.duration+f.t;assert.equal(fleetEventCount(p,t,f.t),k+1);assert.equal(fleetEventCount(p,t-1e-7,f.t),k);assert.equal(fleetEventCount(p,t+1e-7,f.t),k+1);}
 }
});

test('frontend rejects corrupt or replacement chunks before advancing its resource clock',()=>{
 const engine=new FleetEngine(d,source),store=new FleetViewStore(d);engine.advanceTo(32);const initial=engine.delta();store.ingest(initial);const before=store.view(32);engine.advanceTo(40);const good=engine.delta();
 const rejected=(edit:(v:typeof good)=>void,pattern:RegExp)=>{const v=structuredClone(good);edit(v);assert.throws(()=>store.ingest(v),pattern);assert.equal(store.frontier,32);assert.deepEqual(store.view(32).vessels[0].samples,before.vessels[0].samples);};
 rejected(v=>{v.chunks.push(v.chunks[0]);},/Duplicate/);
 rejected(v=>{v.chunks.push(initial.chunks[0]);},/Duplicate/);
 rejected(v=>{v.chunks[0].samples=-1;},/Invalid fleet chunk/);
 rejected(v=>{v.chunks[0].vessels[0].samples[0].y[0]=NaN;},/drawing sample/);
 rejected(v=>{v.chunks[0].bytes=1;},/derived chunk budget/);
 store.ingest(good);assert.equal(store.frontier,40);const remembered=store.view(40).vessels[0].samples.find(s=>s.t===40)!.y[0];good.chunks[0].vessels[0].samples[0].y[0]=NaN;assert.equal(store.view(40).vessels[0].samples.find(s=>s.t===40)!.y[0],remembered);
});
