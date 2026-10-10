import test from 'node:test';
import assert from 'node:assert/strict';
import {hemisphereIntervals,bodySpin} from '../../src/view/planet-grid';
import type {SceneView} from '../../src/model-set/model';
import type {Body} from '../../src/sim/schema';
test('limb clipping partitions offset circles into visible and hidden arcs',()=>{
 for(const [c,a,b] of [[0,1,0],[.5,.3,.7],[-.5,.3,.7],[0,0,0],[1,0,0],[-1,0,0]]){
  const near=hemisphereIntervals(c,a,b,true),far=hemisphereIntervals(c,a,b,false);
  assert.ok(Math.abs([...near,...far].reduce((n,[a,b])=>n+b-a,0)-Math.PI*2)<1e-12);
  for(let i=0;i<997;i++){
   const angle=(i+.314)*2*Math.PI/997,visible=c+a*Math.cos(angle)+b*Math.sin(angle)>=0;
   const includes=(ranges:[number,number][])=>ranges.some(([lo,hi])=>angle>=lo&&angle<=hi);
   assert.equal(includes(near),visible);assert.equal(includes(far),!visible);
  }
 }
});
test('grid uses physical support/air spin without turning orbital rate into rotation',()=>{
 const body:Body={id:'moon',mu:1,radius:1,rail:{kind:'circular',center:[0,0,0],u:[1,0,0],v:[0,1,0],radius:3,rate:7,phase:1}};
 const run={world:{ports:[]},rotating:{rate:9}} as unknown as SceneView;
 assert.deepEqual(bodySpin(run,body),[0,0,0]);
 run.world.ports=[{rail:{kind:'surface',bodyId:'moon',rate:.1,phase:2}}] as SceneView['world']['ports'];
 assert.deepEqual(bodySpin(run,body),[0,0,.1]);
 run.atmosphere={bodyId:'moon',spin:[0,0,.2]} as SceneView['atmosphere'];
 assert.deepEqual(bodySpin(run,body),[0,0,.2]);
});
