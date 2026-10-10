import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateBundle,type Bundle} from '../../src/sim/schema';
import {Runner} from '../../src/sim/runner';
import {bodyState,bodyAcceleration} from '../../src/sim/dynamics';
import {portState,surfaceNormal,surfaceBodyState} from '../../src/sim/logistics';
import {prepareSet,sampleVessel,stockAt,type ModelSet} from '../../src/model-set/model';
const fixture=JSON.parse(readFileSync('fixtures/model-sets/selene-ground.json','utf8')) as ModelSet;
const raw=fixture.vessels[0].bundle;
test('moving surface provider derives its body rail and retains spatial velocity and normal',()=>{
 const b=validateBundle(raw),pad=b.scenario.logistics!.ports[0],owner=b.scenario.bodies[1];
 assert.equal(pad.rail.kind,'surface');
 for(const t of [0,.03,.32,.5]){
  const y=portState(pad,t),center=surfaceBodyState(pad,t),normal=surfaceNormal(pad,t),eps=1e-6;
  const a=portState(pad,t-eps),z=portState(pad,t+eps);
  assert.ok(Math.abs(Math.hypot(...y.slice(0,3).map((v,i)=>v-center[i]))-(owner.radius+1e-6))<2e-16);
  assert.ok(Math.abs(Math.hypot(...normal)-1)<3e-16);
  assert.ok(Math.hypot(...y.slice(3).map((v,i)=>v-(z[i]-a[i])/(2*eps)))<2e-10);
  const acceleration=bodyAcceleration(owner,t),left=bodyState(owner,t-eps),right=bodyState(owner,t+eps);
  assert.ok(Math.hypot(...acceleration.map((v,i)=>v-(right[i+3]-left[i+3])/(2*eps)))<2e-10);
 }
 const spoof=structuredClone(b);
 if(spoof.scenario.logistics!.ports[0].rail.kind!=='surface')throw Error('pad');
 spoof.scenario.logistics!.ports[0].rail.bodyRail={kind:'fixed',position:[123,0,0]};
 const corrected=validateBundle(spoof).scenario.logistics!.ports[0];
 assert.deepEqual(corrected.rail,pad.rail);
});
test('moving surface admission bounds its provider, support clearance and scene domain',()=>{
 const old=structuredClone(validateBundle(raw));old.scenario.logistics!.modelVersion='surface-ports-v5';assert.throws(()=>validateBundle(old));
 for(const change of [(b:Bundle)=>{const r=b.scenario.logistics!.ports[0].rail;if(r.kind==='surface')r.bodyId='absent';},
  (b:Bundle)=>{const r=b.scenario.logistics!.ports[0].rail;if(r.kind==='surface')delete r.latitude;},
  (b:Bundle)=>{const r=b.scenario.bodies[0].rail;if(r.kind==='circular'){r.radius=.98;r.phase=0;}},
  (b:Bundle)=>{b.scenario.duration=4;}]){
  const bad=structuredClone(raw);change(bad);assert.throws(()=>validateBundle(bad));
 }
 const wrong=structuredClone(fixture);wrong.frameExtents={absent:.01};assert.throws(()=>prepareSet(wrong),/frame extent/i);
});
test('moving-pad launch release uses acceleration relative to the owner',()=>{
 const b=structuredClone(raw),launch=b.program.operations!.find(o=>o.kind==='launch')!;
 b.program.operations=b.program.operations!.filter(o=>['at-pad','load','launch'].includes(o.id));
 b.program.thrustArcs=b.program.thrustArcs!.slice(0,1);b.scenario.ship.engine!.maxAcceleration=32.1;
 const r=new Runner(b),at=r.advanceTo(launch.t);assert.equal(at.status,'running');
 assert.equal(at.logistics!.dockedPortId,undefined);assert.ok(r.ledger.some(e=>e.kind==='launch'));
 const low=structuredClone(b);low.scenario.ship.engine!.maxAcceleration=31.8;
 const blocked=new Runner(low),rejected=blocked.advanceTo(launch.t);
 assert.equal(rejected.status,'operation-rejected');assert.equal(rejected.logistics!.dockedPortId,'Northhaven');
 assert.ok(!blocked.ledger.some(e=>e.kind==='launch'));
});
test('complete spatial Moon sortie delivers, pays both captures, conserves stocks and owns its ephemeris',()=>{
 const r=new Runner(raw),last=r.advanceTo(.5);assert.equal(last.status,'horizon');
 assert.equal(last.logistics!.dockedPortId,'Northhaven');assert.equal(last.logistics!.cargoMass,0);assert.ok(last.propellant>.1);
 const captures=r.ledger.filter(e=>e.kind==='dock'||e.kind==='land');assert.equal(captures.length,3);
 for(const e of captures){assert.ok(e.positionError!<1e-7);assert.ok(e.deltaV<1e-7);}
 assert.ok(r.retainedTreeNodes>r.retainedNodes+4000);assert.ok(r.treeStorageBytes()>r.ownStorageBytes());
 assert.ok(r.retainedTreeNodes<=65536);assert.ok(r.treeStorageBytes()<24_000_000);
 const run=prepareSet(fixture),v=run.vessels[0];assert.ok(Buffer.byteLength(JSON.stringify(run))<12_000_000);
 assert.equal(run.frameExtents!.moon,.026);
 const stocks=stockAt(run,.5);assert.equal(stocks.find(s=>s.id==='Crescent')!.cargo,.05);
 assert.ok(Math.abs(last.propellant+last.fuelUsed!+stocks.reduce((n,s)=>n+s.propellant,0)-20)<1e-10);
 for(const arc of raw.program.thrustArcs!)for(let i=0;i<=32;i++){
  const t=arc.start+(arc.end-arc.start)*i/32,at=r.sample(t),moon=bodyState(run.world.bodies[1],t);
  assert.ok(Math.hypot(...at.y.slice(0,3).map((x,j)=>x-moon[j]))>.025);
  assert.ok(Math.hypot(...sampleVessel(v,t).y.slice(0,3).map((x,j)=>x-at.y[j]))<5e-7);
 }
 const times=[.001,...raw.program.thrustArcs!.flatMap(a=>[a.start,a.end]),.2,.4];
 for(const t of times){const a=new Runner(raw);a.advanceTo(t);const restore=Runner.deserialize(a.serialize());assert.deepEqual(restore.advanceTo(.5),last);}
 const fresh=new Runner(raw);for(const t of [...times].reverse())assert.deepEqual(fresh.sample(t),r.sample(t));
 const before=r.retainedTreeNodes;for(const t of times)r.sample(t);assert.equal(r.retainedTreeNodes,before);
 const immutable=JSON.stringify(raw);run.vessels[0].samples[0].y[0]=123;assert.equal(JSON.stringify(raw),immutable);
});
