import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rocketAxis} from '../../src/view/rocket';
import type {VesselView,ViewSample} from '../../src/model-set/model';
const sample={t:0,y:[0,0,0,0,0,0],propellant:1,burnCursor:0,status:'running',detail:''} as ViewSample;
const fixture=(direction:number[]= [-1,0,0])=>({initialAxis:[1,0,0],ports:[],samples:[sample],arcs:[{id:'first',start:0,end:1,direction:[1,0,0],throttle:1},{id:'next',start:3,end:4,direction,throttle:1}]} as VesselView);
test('schematic attitude turns during the coast and reaches physical thrust continuously at ignition',()=>{
 const v=fixture(),held=rocketAxis(v,sample,2);
 assert.deepEqual(held,[1,0,0]);
 const midpoint=rocketAxis(v,sample,2.7);assert.ok(Math.abs(midpoint[0])<1e-12);assert.ok(midpoint[1]>.9999);assert.equal(midpoint[2],0);
 const active={...sample,thrust:{id:'next',force:1,acceleration:1,direction:[-1,0,0] as [number,number,number]}};
 assert.deepEqual(rocketAxis(v,active,3),[-1,0,0]);
 for(const t of [2.4,2.4001,2.6,2.8,2.999999]){
  const a=rocketAxis(v,sample,t),b=rocketAxis(v,sample,t+1e-6);
  assert.ok(a.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...a)-1)<1e-12);
  assert.ok(Math.hypot(...a.map((x,i)=>x-b[i]))<8e-6);
  assert.deepEqual(rocketAxis(v,sample,t),a);
 }
 assert.ok(Math.hypot(...rocketAxis(v,sample,2.999999).map((x,i)=>x-active.thrust.direction[i]))<1e-9);
});
test('attitude remains physical during thrust and respects explicit axes, surface support, and short coasts',()=>{
 const v=fixture([0,1,0]),active={...sample,thrust:{id:'next',force:1,acceleration:1,direction:[0,1,0] as [number,number,number]}};
 assert.deepEqual(rocketAxis(v,active,3.1),[0,1,0]);
 assert.deepEqual(rocketAxis(v,{...sample,axis:[0,0,1]},2.7),[0,0,1]);
 const supported=fixture();supported.ports=[{id:'pad',rail:{kind:'surface',bodyId:'primary',centerHeight:1e-6,center:[0,0,0],radius:1.000001,phase:0,rate:.1,u:[1,0,0],v:[0,1,0]},cargo:0,cargoCapacity:0,propellant:0,tankCapacity:0,serviceDuration:.1}];
 const grounded={...sample,logistics:{dockedPortId:'pad'}} as ViewSample;
 const radial=rocketAxis(supported,grounded,2.7);assert.ok(Math.abs(radial[0]-Math.cos(.27))<1e-12);assert.ok(Math.abs(radial[1]-Math.sin(.27))<1e-12);
 const short=fixture([0,0,1]);short.arcs[1].start=1.2;
 assert.deepEqual(rocketAxis(short,sample,1),[1,0,0]);assert.ok(rocketAxis(short,sample,1.1)[2]>.7);
 const polar=fixture([0,0,-1]);polar.arcs[0].direction=[0,0,1];
 assert.ok(rocketAxis(polar,sample,2.7).every(Number.isFinite));
});
