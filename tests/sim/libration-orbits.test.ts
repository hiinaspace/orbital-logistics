import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bodyState,bodyAcceleration,derivative} from '../../src/sim/dynamics';
import {Runner} from '../../src/sim/runner';
import {transform,transformDirection} from '../../src/model-set/frames';
import {stateAt,prepareSet} from '../../src/model-set/model';
import {admitBinary,prepareBinary,equilibria,binaryPoint,rotatingState,type BinarySet} from '../../src/binary/model';
const read=(name:string)=>JSON.parse(readFileSync(`fixtures/model-sets/sol-earth-${name}.json`,'utf8')) as BinarySet;
const evidence=JSON.parse(readFileSync('docs/evidence/libration-orbit-native.json','utf8'));
const oracle=JSON.parse(readFileSync('docs/evidence/libration-orbit-oracle.json','utf8'));
test('binary admission proves primary acceleration and rejects incompatible force/rail/ownership contracts',()=>{
 const set=read('halo');assert.throws(()=>prepareSet(structuredClone(set)));assert.throws(()=>admitBinary({...set,modelVersion:'circular-binary-set-v2'} as any));const b=admitBinary(set),scenario=set.vessels[0].bundle.scenario;
 for(const t of [0,12,60])for(const [i,source] of scenario.bodies.entries()){
  const y=bodyState(source,t),q=bodyState(scenario.bodies[1-i],t),d=Math.hypot(...q.slice(0,3).map((v,k)=>v-y[k])),g=q.slice(0,3).map((v,k)=>scenario.bodies[1-i].mu*(v-y[k])/d**3);
  assert.ok(Math.max(...bodyAcceleration(source,t).map((v,k)=>Math.abs(v-g[k])))<1e-14);
 }
 assert.equal(equilibria(b).length,5);
 for(const p of equilibria(b))for(const t of [0,7,60]){const y=binaryPoint(b,p.x,p.y,t),g=derivative(scenario,t,y);assert.ok(Math.hypot(g[3]+b.rate**2*y[0],g[4]+b.rate**2*y[1],g[5])<1e-13);}
 for(const mutate of [(s:BinarySet)=>{s.binary.rate*=1.01;},(s:BinarySet)=>{(s.vessels[0].bundle.scenario.bodies[0].rail as any).phase=0;},(s:BinarySet)=>{s.vessels[0].bundle.scenario.bodies[1].mu*=1.01;},(s:BinarySet)=>{s.vessels[0].bundle.scenario.bodies[1].radius=4;},(s:BinarySet)=>{s.vessels[0].bundle.program.operations=[{} as any];}]){const bad=structuredClone(set);mutate(bad);assert.throws(()=>admitBinary(bad));}
});
test('frozen spatial coasts converge to independent six-state oracles and include meaningful vertical extent',()=>{
 for(const name of ['halo','lissajous']){
  const rows=evidence[name].rows;assert.ok(rows[1].error<rows[0].error*.2);assert.ok(rows[2].error<rows[1].error*.2);assert.ok(rows[3].error<3e-7);assert.ok(rows[3].drift<1e-11);assert.ok(oracle[name].tightening<1e-7);assert.ok(oracle[name].relativeAgreement<1e-7);
  const set=read(name),b=admitBinary(set),r=new Runner(set.vessels[0].bundle);assert.equal(r.advanceTo(60).status,'horizon');
  for(const t of [0,.25,7.25,26,59.75,60]){const y=r.sample(t).y,ref=oracle[name].states[Math.round(t*4)];assert.ok(Math.max(...y.map((v,i)=>Math.abs(v-ref[i])))<3e-7);}
  assert.ok(evidence[name].range[2][1]-evidence[name].range[2][0]>.25);
  if(name==='halo'){const before=rotatingState(b,r.sample(0).y,0),after=rotatingState(b,r.sample(b.period).y,b.period);assert.ok(Math.max(...after.map((v,i)=>Math.abs(v-before[i])))<1e-7);}
  else {const before=rotatingState(b,r.sample(0).y,0),after=rotatingState(b,r.sample(b.period).y,b.period);assert.ok(Math.max(...after.map((v,i)=>Math.abs(v-before[i])))>.005);}
 }
});
test('departure pays bounded finite burns and flows into halo without a snap or seed reset',()=>{
 const set=read('observatory-insertion'),r=new Runner(set.vessels[0].bundle);assert.equal(r.advanceTo(60).status,'horizon');assert.equal(set.vessels[0].bundle.program.burns.length,0);
 const acc=.04,elapsed=set.vessels[0].bundle.program.thrustArcs!.reduce((t,a)=>t+a.end-a.start,0),expected=1.4*Math.exp(-acc*elapsed/3)-1;
 assert.ok(Math.abs(r.sample(60).propellant-expected)<1e-12);assert.ok(r.sample(60).propellant>.3);
 for(const t of [0,1,2,14,30,60]){const s=r.sample(t);assert.ok(Math.max(...s.y.map((v,i)=>Math.abs(v-oracle['observatory-insertion'].states[Math.round(t*4)][i])))<5e-7);if(s.thrust)assert.ok(s.thrust.force/(1+s.propellant)<=acc+1e-14);}
 assert.ok(oracle['observatory-insertion'].insertionResidual<1e-7);
 const boundary=r.eventBoundaries.find(e=>e.t===14);if(boundary)assert.deepEqual(boundary.before.y,boundary.after.y);
 assert.equal(r.sample(14).burnCursor,0);
});
test('L2-centered rotating frame has correct velocity and preserves real spatial drawing geometry',()=>{
 const set=read('halo'),view=prepareBinary(set),v=view.vessels[0],b=view.binary!,r=new Runner(set.vessels[0].bundle);r.advanceTo(60);
 const L=equilibria(b).find(p=>p.id==='L2')!;
 for(const t of [0,12,59]){const y=r.sample(t).y,q=transform(view,y,t,'libration'),whole=rotatingState(b,y,t);assert.ok(Math.abs(q[0]-(whole[0]-L.x))<1e-12);assert.ok(Math.abs(q[2]-y[2])<1e-14);
  const h=1e-4,lo=transform(view,r.sample(Math.max(0,t-h)).y,Math.max(0,t-h),'libration'),hi=transform(view,r.sample(t+h).y,t+h,'libration');if(t>0)assert.ok(Math.max(...hi.slice(0,3).map((x,i)=>Math.abs((x-lo[i])/(2*h)-q[3+i])))<1e-7);
  assert.deepEqual(transformDirection(view,[0,0,1],t,'libration'),[0,0,1]);
 }
 let max=0;for(let i=0;i<128;i++){const t=(i+.5)*60/128,actual=r.sample(t).y,drawn=stateAt(v,t);max=Math.max(max,Math.hypot(...actual.slice(0,3).map((x,k)=>x-drawn[k]))*4000);}assert.ok(max<.1,`display error ${max}px`);
});
