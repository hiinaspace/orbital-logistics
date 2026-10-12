import {test} from 'node:test';
import assert from 'node:assert/strict';
import {potential,basisPoint,intersectsBody,sampleField,SEGMENT_LIMIT} from '../../src/view/potential-field';
import {gravity} from '../../src/compact/physics';
test('display potential matches the real exterior force and rotating symmetry',()=>{
 assert.equal(potential(2,0,[{x:0,y:0,mu:1,radius:1}]),-.5);
 for(const t of [0,3,50,999])for(const [x,y] of [[2,2],[-3,1],[5,.4]]){
  const p=basisPoint(x,y,t),g=gravity(t,p),h=1e-5;
  const worldPotential=(q:number[])=>{const b=basisPoint(5,0,t);return -1/Math.hypot(...q)-.03/Math.hypot(q[0]-b[0],q[1]-b[1],q[2]);};
  assert.ok(Math.abs(worldPotential(p.slice(0,3))-potential(x,y))<1e-12);
  for(let i=0;i<3;i++){const a=p.slice(0,3),b=[...a];a[i]+=h;b[i]-=h;assert.ok(Math.abs(-(worldPotential(a)-worldPotential(b))/(2*h)-g[i])<1e-8);}
 }
});
test('mask catches tiny bodies entirely within a coarse cell and crossing a surface',()=>{
 assert.equal(intersectsBody(4,-1,2,2),true);assert.equal(intersectsBody(1,0,.1,.1),true);assert.equal(intersectsBody(1.1,1.1,.1,.1),false);
 const grid=sampleField({id:1,bounds:{x:4,y:-1,span:2},size:16});
 const step=2/16;for(let j=0;j<16;j++)for(let i=0;i<16;i++)if([[0,0],[step,0],[0,step],[step,step]].every(([dx,dy])=>Math.hypot(4+i*step+dx-5,-1+j*step+dy)<=.2))assert.equal(grid.pixels[(j*16+i)*4+3],0);
});
test('sampling is bounded, deterministic and contours stay outside source interiors',()=>{
 const request={id:1,bounds:{x:-12,y:-12,span:24},size:256},a=sampleField(request),b=sampleField(request);
 assert.deepEqual(a,b);assert.ok(a.segments.length/4<=SEGMENT_LIMIT);
 for(let i=0;i<a.segments.length;i+=2){const x=a.segments[i],y=a.segments[i+1];assert.ok(Math.hypot(x,y)>1);assert.ok(Math.hypot(x-5,y)>.2);}
 assert.throws(()=>sampleField({...request,size:513}));assert.throws(()=>sampleField({...request,bounds:{x:NaN,y:0,span:1}}));
});
