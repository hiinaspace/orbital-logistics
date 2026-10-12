import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import profile from '../../fixtures/model-sets/cycler-fleet-profile.json';
import definition from '../../fixtures/model-sets/aster-selene-cycler-fleet.json';
import {prepareFleet} from '../../src/cycler/fleet';
import {createPassThroughView,passThroughResources} from '../../src/cycler/view';
import {samplePassThrough} from '../../src/cycler/query';
import {STEP,MARGIN} from '../../src/compact/physics';
import {stockAt} from '../../src/model-set/model';
import type {FleetProfile,PassThroughDefinition} from '../../src/cycler/types';
const source=profile as FleetProfile,p=prepareFleet(source);
const scene=createPassThroughView(p,definition as PassThroughDefinition);
const sample=(actor:number,t:number,left=false)=>samplePassThrough({template:p,actor},t,left);
const norm=(a:number[],b:number[])=>Math.hypot(...a.map((x,i)=>x-b[i]));

test('two time-phased unpowered carriers and independent riders converge over the complete finite horizon',()=>{
 assert.equal(p.hardware.length,4);assert.ok(p.work.nodes<=360000&&p.work.checks<=600000);
 assert.ok(p.work.oraclePosition<1e-8&&p.work.oracleVelocity<1e-8);
 for(const actor of [0,1]){assert.equal(p.cost[actor],0);assert.ok(p.phases[actor].every(q=>q.kind==='flight'&&!q.control));assert.equal(sample(actor,p.duration).propellant,6);}
 const captures=p.events.filter(e=>e.kind==='land'||e.kind==='dock');assert.equal(captures.length,8);
 for(const e of captures){assert.ok(e.positionError!+MARGIN<1e-7);assert.ok(e.velocityError!+MARGIN<1e-7);assert.ok(e.fuelUsed>0);if(e.kind==='land')assert.ok(e.afterFuel>=.3);}
 const convergence=[];
 for(const step of [STEP/2,STEP/4]){
  const q=prepareFleet(source,step);
  for(let actor=0;actor<4;actor++)assert.ok(norm(sample(actor,p.duration).y,samplePassThrough({template:q,actor},q.duration).y)<1e-8);
  for(let actor=2;actor<4;actor++)assert.ok(Math.abs(p.cost[actor]-q.cost[actor])<1e-8);
  convergence.push({step,work:q.work,cost:q.cost});
 }
 fs.writeFileSync('docs/evidence/cycler-fleet-numeric.json',JSON.stringify({duration:p.duration,work:p.work,cost:p.cost,convergence,resources:passThroughResources(p,p.duration),replyBytes:new TextEncoder().encode(JSON.stringify(scene)).byteLength,samples:scene.vessels.map(v=>({id:v.id,count:v.samples.length}))},null,2)+'\n');
});

test('extended lunar dwell and parking reduce the complete lunar departure cost',()=>{
 for(const actor of [2,3]){
  const land=p.events.find(e=>e.actor===actor&&e.kind==='land'&&e.port==='Haven')!;
  const launch=p.events.find(e=>e.actor===actor&&e.kind==='launch'&&e.port==='Haven')!;
  assert.ok(launch.t-land.t>=40);
  const park=p.phases[actor].find(q=>q.label==='Selene departure parking')!;
  assert.ok(park.end-park.start>4&&!park.control);
  const board=p.events.filter(e=>e.actor===actor&&e.kind==='dock')[1];
  const lunarDV=p.events.filter(e=>e.actor===actor&&e.t>=launch.t&&e.t<=board.t).reduce((n,e)=>n+e.deltaV,0);
  assert.ok(lunarDV<1.25);assert.ok(lunarDV<1.703688*.75);
  assert.ok(p.phases[actor].filter(q=>q.kind==='ride')[0].carrier!==p.phases[actor].filter(q=>q.kind==='ride')[1].carrier);
 }
});

test('parent identity owns exact boarding/release mass, independent fuel, visibility and history',()=>{
 for(let actor=2;actor<4;actor++)for(const ride of p.phases[actor].filter(q=>q.kind==='ride')){
  const parent=ride.carrier!,other=1-parent;
  assert.equal(sample(actor,ride.start).opacity,0);assert.equal(sample(actor,ride.start,true).opacity,undefined);
  assert.equal(sample(actor,ride.end,true).opacity,0);assert.equal(sample(actor,ride.end).opacity,undefined);
  assert.equal(sample(parent,ride.start,true).mass,10);assert.equal(sample(parent,ride.end).mass,10);
  assert.equal(sample(other,ride.start).mass,10);
  assert.ok(Math.abs(sample(parent,ride.start).mass!-10-sample(actor,ride.start).mass!)<1e-12);
  assert.ok(norm(sample(actor,ride.start).y,sample(parent,ride.start).y)<1e-12);
  assert.ok(norm(sample(actor,ride.end).y,sample(parent,ride.end).y)<1e-7);
 }
 const end=passThroughResources(p,p.duration);assert.equal(end.cargoExported,.6);
 assert.ok(Math.abs(end.fuelImported-p.cost[2]-p.cost[3])<1e-12);
 for(const t of [0,56,74,125,134,163,p.duration]){const stock=stockAt(scene,t);assert.ok(stock.find(s=>s.id==='Cairn')!.occupied<=2);assert.ok(stock.find(s=>s.id==='Haven')!.occupied<=1);}
 assert.equal(stockAt(scene,0).find(s=>s.id==='Cairn')!.occupied,2);
 assert.throws(()=>sample(0,p.duration+.01),/outside admitted/);
});

test('disposable drawing stays close to independent orbital and powered witnesses',()=>{
 let position=0,velocity=0;
 for(let actor=0;actor<4;actor++){
  const segments=actor<2?source.carriers[actor].segments:source.riders[actor-2].mission.stages.flatMap(s=>s.segments);
  for(const seg of segments)for(const r of seg.oracle){
   // Capture right sides intentionally pay the residual; compare event-left flight.
   const y=sample(actor,r[0],r[0]===seg.end).y;
   position=Math.max(position,norm(y.slice(0,3),r.slice(1,4)));velocity=Math.max(velocity,norm(y.slice(3,6),r.slice(4,7)));
  }
 }
 assert.ok(position<1.1e-6,`position ${position}`);assert.ok(velocity<1.1e-5,`velocity ${velocity}`);
 fs.writeFileSync('docs/evidence/cycler-fleet-drawing.json',JSON.stringify({position,velocity,positionProbeLimit:1e-6,velocityProbeLimit:1e-5},null,2)+'\n');
 assert.ok(new TextEncoder().encode(JSON.stringify(scene)).byteLength<=16_000_000);
});

test('wrong-parent, stale version, carrier thrust, unbounded field and unfunded reload reject atomically',()=>{
 const bad=(edit:(v:FleetProfile)=>void,pattern:RegExp)=>{const v=structuredClone(source);edit(v);assert.throws(()=>prepareFleet(v),pattern);};
 bad(v=>{v.riders[0].inbound=v.riders[0].outbound;},/different later carrier/);
 bad(v=>{v.riders[0].outbound='Missing';},/different later carrier/);
 bad(v=>{v.riders[0].outbound='Nomad';v.riders[0].inbound='Wayfarer';},/paid capture margin/);
 bad(v=>{v.modelVersion='pass-through-profile-v1' as any;},/fixed field/);
 bad(v=>{v.rate*=1.01;},/fixed field/);
 bad(v=>{v.riders[0].mission.funding.Haven.fuelCap=0;},/fuel supply unavailable/);
 bad(v=>{v.carriers[0].segments[0].control=v.riders[0].mission.stages[0].segments[0].control;},/ballistic carrier/);
});
