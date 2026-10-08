import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/model-sets/crossing-planes.json';
import {prepareSet,sampleVessel,type ModelSet} from '../../src/model-set/model';
import {Runner} from '../../src/sim/runner';
import {transform,transformDirection} from '../../src/model-set/frames';
import {cameraPoint,orient,type Camera} from '../../src/model-set/camera';
import {cross,norm} from '../../src/sim/vectors';
const set=fixture as ModelSet;
test('crossing-plane witnesses pay two real inclination changes with distinct node axes',()=>{
 const normals=[];
 for(const v of set.vessels){const r=new Runner(v.bundle),end=r.advanceTo(24);assert.equal(end.status,'horizon');assert.ok(end.propellant>.3 && end.propellant<.9);assert.equal(r.ledger.length,2);
  const samples=[r.sample(3),r.sample(8),r.sample(22)];const n=samples.map(s=>{const v=cross(s.y.slice(0,3),s.y.slice(3));return v.map(x=>x/norm(v));});normals.push(n[1]);
  assert.ok(norm(n[0].map((x,i)=>x-n[1][i]))>.5);assert.ok(norm(n[0].map((x,i)=>x-n[2][i]))<1e-10);
  assert.ok(r.eventBoundaries.every(b=>norm(b.before.y.slice(0,3).map((x,i)=>x-b.after.y[i]))===0 && b.before.propellant>b.after.propellant));
  assert.ok(Math.abs(r.sample(8).y[2])>.5);
 }
 assert.ok(norm(normals[0].map((x,i)=>x-normals[1][i]))>.5);
});
test('all spatial view queries leave the immutable scene and event sides unchanged',()=>{
 const view=prepareSet(set),saved=JSON.stringify(view),camera:Camera={yaw:0,pitch:0,center:[0,0,0],scale:200};
 for(const t of [0,4-1e-7,4,8,18.71923562645,24,4])for(const frame of ['inertial','rotating','tern','lark','Orison','Tern Beacon'])for(const preset of ['top','oblique','front','side'] as const){orient(camera,preset);for(const v of view.vessels){const y=sampleVessel(v,t).y;assert.ok(cameraPoint(camera,transform(view,y,t,frame),800,600).every(Number.isFinite));assert.ok(transformDirection(view,[0,0,1],t,frame).every(Number.isFinite));}}
 assert.equal(JSON.stringify(view),saved);
});
