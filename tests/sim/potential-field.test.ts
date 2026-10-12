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

test('field edges reach the background naturally and relief is bounded and continuous',async()=>{
 const {FADE,fieldTone,reliefHeight}=await import('../../src/view/potential-field');
 for(let u=-12;u<=12;u+=.2)for(const [x,y] of [[u,-12],[u,12],[-12,u],[12,u]]){assert.equal(fieldTone(potential(x,y)),0);assert.ok(-potential(x,y)<FADE);}
 assert.equal(fieldTone(-FADE),0);assert.equal(fieldTone(-1.4),1);
 for(const [x,y] of [[0,0],[5,0],[2,2],[-12,0]]){const h=reliefHeight(x,y);assert.ok(Number.isFinite(h)&&h>=-2.4&&h<=0);}
 const grid=sampleField({id:2,bounds:{x:-12,y:-12,span:24},size:256});
 for(let i=0;i<256;i++){assert.deepEqual(Array.from(grid.pixels.slice(i*4,i*4+3)),[12,20,29]);}
});
test('equilibrium crosses cancel the actual rotating acceleration, not the gravity alone',async()=>{
 const {EQUILIBRIA,equilibriumForce}=await import('../../src/view/potential-field');const {RATE}=await import('../../src/compact/physics');
 assert.equal(EQUILIBRIA.length,3);
 for(const p of EQUILIBRIA){assert.ok(Math.hypot(...equilibriumForce(p.x,p.y))<1e-13);for(const t of [0,12,80]){const y=basisPoint(p.x,p.y,t),g=gravity(t,y);assert.ok(Math.hypot(g[0]+RATE**2*y[0],g[1]+RATE**2*y[1])<1e-12);}}
});

test('relief refinement covers a close followed glyph across the permitted height slab',async()=>{
 const {reliefHeight,reliefFootprint}=await import('../../src/view/potential-field');const {cameraProjection}=await import('../../src/model-set/camera');
 for(const originHeight of [0,reliefHeight(5,0)])for(const [x,y] of [[2,0],[5.5,.1],[-3,1]]){
  const z=3*(reliefHeight(x,y)-originHeight),project=cameraProjection({yaw:-.65,pitch:.6,center:[x,y,z],scale:2000},1280,1280);
  const o=project([0,0,0]),xx=project([1,0,0]),yy=project([0,1,0]),zz=project([0,0,1]).map((v,i)=>v-o[i]);
  const corners=reliefFootprint(1280,1280,o,xx[0]-o[0],xx[1]-o[1],yy[0]-o[0],yy[1]-o[1],zz,3,originHeight);
  const xs=corners.map(q=>q[0]),ys=corners.map(q=>q[1]);assert.ok(x>=Math.min(...xs)&&x<=Math.max(...xs));assert.ok(y>=Math.min(...ys)&&y<=Math.max(...ys));
 }
});
