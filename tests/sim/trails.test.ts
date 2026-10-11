import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trailOpacity} from '../../src/model-set/trails';
test('short retained trails fade before eviction and remain invariant under time scaling',()=>{
 for(const span of [.65,9,12]){
  const t=2*span,oldest=t-span;
  assert.equal(trailOpacity(oldest,t,oldest,true),0);
  assert.equal(trailOpacity(oldest-1e-6,t,oldest,true),0);
  assert.equal(trailOpacity(t,t,oldest,true),.7);
  assert.equal(trailOpacity(t+1e-6,t,oldest,true),0);
  assert.ok(trailOpacity(oldest+span*.01,t,oldest,true)<1/64);
  let last=0;for(let i=0;i<=100;i++){const alpha=trailOpacity(oldest+span*i/100,t,oldest,true);assert.ok(alpha>=last-1e-12);last=alpha;}
 }
 for(const u of [0,.1,.5,.85,1])assert.ok(Math.abs(trailOpacity(2-u,2,1,true)-trailOpacity((2-u)*.65,2*.65,.65,true))<1e-12);
});
