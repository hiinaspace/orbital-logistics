import {test} from 'node:test';
import assert from 'node:assert/strict';
import profile from '../../fixtures/model-sets/pass-through-profile.json';
import definition from '../../fixtures/model-sets/aster-selene-pass-through.json';
import {preparePassThrough} from '../../src/cycler/prepare';
import {createPassThroughView,passThroughResources} from '../../src/cycler/view';
import {samplePassThrough} from '../../src/cycler/query';
import {integrate,STEP,MARGIN} from '../../src/compact/physics';
import {rotateState} from '../../src/compact/query';
import {sampleVessel,stockAt} from '../../src/model-set/model';
import {transform} from '../../src/model-set/frames';
import type {PassThroughProfile,PassThroughDefinition} from '../../src/cycler/types';
const source=profile as PassThroughProfile;
const baseline=preparePassThrough(source);
const p=baseline.template;
const scene=createPassThroughView(p,definition as PassThroughDefinition);
const sample=(actor:number,t:number,left=false)=>samplePassThrough({template:p,actor},t,left);
const norm=(a:number[],b:number[])=>Math.hypot(...a.map((x,i)=>x-b[i]));

test('two uninterrupted native circuits and round trips agree with independent full-field oracles',()=>{
 assert.ok(p.work.nodes<=240000&&p.work.checks<=400000);
 assert.ok(p.work.oraclePosition<1e-8&&p.work.oracleVelocity<1e-8);
 assert.ok(p.phases[0].every(q=>q.kind==='flight'&&!q.control));
 assert.equal(p.cost[0],0);
 assert.ok(Math.abs(p.events.filter(e=>e.actor===1).reduce((n,e)=>n+e.fuelUsed,0)-p.cost[1])<1e-12);
 assert.ok(p.events.filter(e=>e.kind==='thrust-end').every(e=>e.deltaV>0&&e.fuelUsed>0));
 assert.equal(p.events.filter(e=>e.actor===0&&e.kind==='dock').length,0);
 const captures=p.events.filter(e=>e.kind==='dock'||e.kind==='land');
 assert.equal(captures.length,8);
 for(const e of captures){assert.ok(e.positionError!+MARGIN<1e-7);assert.ok(e.velocityError!+MARGIN<1e-7);assert.ok(e.deltaV>=MARGIN&&e.fuelUsed>0);}
 for(const e of captures.filter(e=>e.kind==='land'))assert.ok(e.afterFuel>=.3);
 for(const step of [STEP/2,STEP/4]){
  const finer=preparePassThrough(source,step);
  assert.ok(finer.template.work.oraclePosition<1e-8&&finer.template.work.oracleVelocity<1e-8);
  assert.ok(norm(baseline.carrierFinal,finer.carrierFinal)<1e-8);
  assert.ok(Math.abs(p.cost[1]-finer.template.cost[1])<1e-8);
 }
});

test('early launch includes four real parking laps and small paid orbital connections',()=>{
 const parking=p.phases[1].find(q=>q.label==='Aster parking')!;
 assert.equal(parking.start,3);assert.equal(parking.end,49);assert.equal(parking.fuel,parking.fuelEnd);
 let winding=0;
 for(let i=1;i<parking.rows!.length;i++){
  const a=parking.rows![i-1],b=parking.rows![i],d=Math.atan2(b[2],b[1])-Math.atan2(a[2],a[1]);
  winding+=Math.atan2(Math.sin(d),Math.cos(d));
 }
 assert.ok(winding>4*2*Math.PI);
 const connection=p.phases[1].filter(q=>q.start>=49&&q.end<=56);
 assert.equal(connection.length,3);assert.ok(connection[0].control&&connection[2].control&&!connection[1].control);
 const dv=connection.reduce((n,q)=>n+(q.rows?.at(-1)?.[7]??0),0);
 assert.ok(dv<.5);
 const returnParking=p.phases[1].find(q=>q.label==='Aster return parking')!;
 assert.ok(returnParking.end-returnParking.start>14&&!returnParking.control);
});

test('board/release preserve separate tanks and add actual attached mass at event sides',()=>{
 for(const offset of [0,p.period])for(const [board,release] of [[56,66],[79.5,83.5]]){
  const a=offset+board,b=offset+release;
  assert.equal(sample(1,a).opacity,0);assert.equal(sample(1,a,true).opacity,undefined);
  assert.equal(sample(1,b,true).opacity,0);assert.equal(sample(1,b).opacity,undefined);
  assert.equal(sample(0,a).propellant,6);assert.equal(sample(0,b).propellant,6);
  assert.ok(Math.abs(sample(0,a).mass!-10-sample(1,a).mass!)<1e-12);
  assert.equal(sample(0,a,true).mass,10);assert.equal(sample(0,b).mass,10);
  assert.ok(norm(sample(1,a).y,sample(0,a).y)<1e-12);
  assert.ok(norm(sample(1,b).y,sample(0,b).y)<1e-7);
 }
});

test('four funded deliveries and replay queries conserve finite inventories without wrapping',()=>{
 const end=passThroughResources(p,p.duration);
 assert.equal(p.flows.filter(f=>f.kind==='delivery').length,4);
 assert.ok(Math.abs(end.cargoExported-.6)<1e-12);
 assert.ok(Math.abs(.15+end.cargoImported-end.cargoExported-sample(1,p.duration).logistics!.cargoMass)<1e-12);
 assert.ok(Math.abs(end.fuelImported-p.cost[1])<1e-12);
 assert.equal(sample(1,p.duration).propellant,3);
 assert.equal(passThroughResources(p,0).fuelImported,0);
 const mid=sample(0,p.period),initial=sample(0,0);
 assert.ok(norm(mid.y,initial.y)>1);
 assert.ok(norm(mid.y,rotateState(initial.y,p.rate*p.period))<1e-8);
 assert.ok(norm(sample(0,p.duration).y,baseline.carrierFinal)<1e-12);
 assert.throws(()=>sample(0,p.duration+.01),/outside admitted/);
 assert.throws(()=>sample(1,-.01),/outside admitted/);
 for(const t of [0,56,73.5,74,p.period,194.00467632722803,p.duration]){
  const q=sampleVessel(scene.vessels[1],t);
  assert.deepEqual(q,sample(1,t));
  const r=transform(scene,q.y,t,'rotating');
  const round=rotateState([r[0],r[1],r[2],r[3]-p.rate*r[1],r[4]+p.rate*r[0],r[5]],p.rate*t);
  assert.ok(norm(round,q.y)<1e-12);assert.deepEqual(sampleVessel(scene.vessels[1],t),q);
  const occupied=stockAt(scene,t);assert.ok(occupied.every(s=>s.occupied===0||s.occupied===1));
 }
});

test('known-bad controls, fields, carrier thrust, funding and missing reload reject',()=>{
 const bad=(edit:(p:PassThroughProfile)=>void,pattern?:RegExp)=>{const v=structuredClone(source);edit(v);assert.throws(()=>preparePassThrough(v),pattern);};
 bad(v=>{v.rate*=1.01;},/fixed field/);
 bad(v=>{(v as any).bodies=[];},/profile fields/);
 bad(v=>{v.modelVersion='compact-cycler-profile-v2' as any;},/fixed field/);
 bad(v=>{v.carrierSegments[0].control=v.missions[0].stages[0].segments[0].control;},/ballistic carrier/);
 bad(v=>{const c=v.missions[0].stages[0].segments[0].control!;c.keys[1][0]=c.end+1;},/control keys/);
 bad(v=>{(v.missions[0].stages[0].segments[0].control as any).accelerationBound=0;},/control fields/);
 bad(v=>{v.missions[0].stages[0].segments[0].control!.coefficients[0][3][0]=50;},/cubic key consistency/);
 bad(v=>{v.missions[0].funding.Haven.fuelCap=0;},/fuel supply unavailable/);
 bad(v=>{v.missions[0].funding.Haven.cargo=0;},/funded reload/);
 bad(v=>{v.missions[1].stages[0].segments[0].start+=.01;},/route ownership/);
});


test('reserved node and enclosure allowances stop integration before overspending',()=>{
 const initial=source.carrierSegments[0].initial;
 const healthy=integrate(0,.01,initial);
 assert.ok(healthy.nodes>1&&healthy.work>1);
 assert.throws(()=>integrate(0,.01,initial,undefined,STEP,0,{nodes:1,checks:20}),/physical node budget/);
 assert.throws(()=>integrate(0,.01,initial,undefined,STEP,0,{nodes:20,checks:1}),/enclosure work budget/);
 assert.throws(()=>integrate(0,.01,initial,undefined,STEP,0,{nodes:0,checks:20}),/work policy/);
 const exact=integrate(0,.01,initial,undefined,STEP,0,{nodes:healthy.nodes,checks:healthy.work});
 assert.deepEqual(exact.rows,healthy.rows);assert.equal(exact.work,healthy.work);
});
