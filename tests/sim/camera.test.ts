import {test} from 'node:test';
import assert from 'node:assert/strict';
import {axes,cameraPoint,cameraVector,orient,pan,zoom,orbit,occluder,visibleSegment,type Camera} from '../../src/model-set/camera';
const camera=():Camera=>({yaw:0,pitch:Math.PI/2,center:[0,0,0],scale:100});
const close=(a:readonly number[],b:readonly number[],eps=1e-10)=>assert.ok(Math.hypot(...a.map((x,i)=>x-b[i]))<eps,`${a} != ${b}`);
test('orthographic presets preserve right-handed orthonormal axes and exact overhead compatibility',()=>{
 for(const p of ['top','oblique','front','side'] as const){const c=camera();orient(c,p);const {right,up,toward}=axes(c);
  for(const a of [right,up,toward])assert.ok(Math.abs(Math.hypot(...a)-1)<1e-14);
  close([right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]],toward);
 }
 close(cameraPoint(camera(),[2,3,4],800,600),[600,0,400]);
 const c=camera();orient(c,'front');close(cameraPoint(c,[2,3,4],800,600),[600,-100,-300]);
 orient(c,'side');close(cameraVector(c,[2,3,4]),[3,4,2]);
});
test('pan follows screen axes and cursor zoom anchors the same plane point in tilted views',()=>{
 const c=camera();orient(c,'oblique');c.center=[1,-2,3];const before=cameraPoint(c,[4,5,6],800,600);pan(c,31,-47);const after=cameraPoint(c,[4,5,6],800,600);close(after,[before[0]+31,before[1]-47,before[2]]);
 const p=[...c.center],a=axes(c),x=137,y=-58,world=p.map((v,i)=>v+x/c.scale*a.right[i]-y/c.scale*a.up[i]);
 zoom(c,2,x,y);close(cameraPoint(c,world,800,600),[400+x,300+y,0]);
 zoom(c,1e20,x,y);assert.equal(c.scale,1e6);zoom(c,1e-30,x,y);assert.equal(c.scale,20);
 for(let i=0;i<500;i++)orbit(c,1000,i%2?1000:-1000);assert.ok(Number.isFinite(c.yaw)&&Math.abs(c.pitch)<=Math.PI/2);
});
test('sphere occlusion distinguishes front/back, limb, silhouette crossings and multiple bodies',()=>{
 const spheres=[{id:'world',point:[0,0,0] as [number,number,number],radius:10}];
 assert.equal(occluder([0,0,-20],spheres)?.id,'world');assert.equal(occluder([0,0,20],spheres),undefined);assert.equal(occluder([10,0,0],spheres),undefined);
 const rear=visibleSegment([-20,0,-20],[20,0,-20],spheres);assert.equal(rear.length,2);close(rear[0][1],[-10,0,-20]);close(rear[1][0],[10,0,-20]);
 assert.equal(visibleSegment([-20,0,20],[20,0,20],spheres).length,1);
 const through=visibleSegment([0,0,-20],[0,0,20],spheres);assert.equal(through.length,1);close(through[0][0],[0,0,10]);
 assert.equal(visibleSegment([0,0,-20],[0,0,-19],spheres).length,0);
 const second={id:'other',point:[20,0,0] as [number,number,number],radius:5};
 assert.equal(visibleSegment([-20,0,-20],[40,0,-20],[...spheres,second]).length,3);
 // The circle and sphere equations split independently: front hemisphere can hide
 // a point even when its depth is positive, and visible intervals can join.
 const crossing=visibleSegment([-20,0,-20],[20,0,20],spheres);for(const [a,b] of crossing)assert.equal(occluder(a.map((v,i)=>(v+b[i])/2) as [number,number,number],spheres),undefined);
 assert.deepEqual(visibleSegment([NaN,0,0],[1,2,3],spheres),[]);
});

test('chase rigs and selected pivots remain orthonormal and deterministic at degenerate states',async()=>{
 const {chaseRig,orbitAround}=await import('../../src/model-set/camera');
 for(const [p,v] of [[[2,0,0],[0,.7,.2]],[[0,0,0],[0,0,0]],[[2,0,0],[1,0,0]],[[0,0,2],[0,0,-1]]] as const){
  const rig=chaseRig(p,v);assert.deepEqual(rig,chaseRig(p,v));const c=camera();c.rig=rig;orient(c,'oblique');c.rig=rig;
  const a=axes(c);for(const x of Object.values(a))assert.ok(Math.abs(Math.hypot(...x)-1)<1e-14);
  close([a.right[1]*a.up[2]-a.right[2]*a.up[1],a.right[2]*a.up[0]-a.right[0]*a.up[2],a.right[0]*a.up[1]-a.right[1]*a.up[0]],a.toward);
  c.center=[-1,2,3];const pivot:[number,number,number]=[2,-3,4],before=cameraPoint(c,pivot,800,600);
  orbitAround(c,pivot,74,-31);close(cameraPoint(c,pivot,800,600),before);
 }
});

test('one-draw projection snapshots camera axes and matches point queries',async()=>{
 const {cameraProjection}=await import('../../src/model-set/camera');
 for(const preset of ['top','oblique','front','side'] as const){const c=camera();orient(c,preset);c.center=[1,-2,3];const projection=cameraProjection(c,1440,900);for(const y of [[2,3,4],[-4,1,-2],[0,0,0]])close(projection(y),cameraPoint(c,y,1440,900));const before=projection([4,5,6]);c.center[0]+=2;orbit(c,50,10);close(projection([4,5,6]),before);}
});
