import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AdaptiveEngine} from '../../src/adaptive/engine';
import {AdaptiveWorld} from '../../src/adaptive/world';
import {CoupledTrip} from '../../src/adaptive/plan';
import {AdaptiveViewStore} from '../../src/adaptive/view';
import {sampleVessel} from '../../src/model-set/model';
import {planServiceJob,serviceWork} from '../../src/adaptive/planner';
test('sensitivity admission preserves service schedules and canonical owner grid',()=>{
 const witness=JSON.parse(readFileSync('docs/design/flexible-service/online-replay-512.json','utf8'));
 const engine=new AdaptiveEngine(witness.definition);while(engine.advanceTo(64,4096).yielded){}
 const plans=engine.delta().visits.map(v=>v.plan);
 assert.deepEqual(plans.map(p=>p.schedule),witness.plans.slice(0,plans.length).map((p:any)=>p.schedule));
 const near=(a:any,b:any,path='')=>{
  // Normalized headings of tiny forces are more ill-conditioned than forces
  // or arrival states. Independent replay validates the resulting programs.
  if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<(path.includes('.direction.')?1e-7:1e-8),path);return;}
  if(a&&typeof a==='object'){for(const k of Object.keys(a))if(k!=='evaluations')near(a[k],b[k],`${path}.${k}`);return;}
  assert.equal(a,b);
 };
 plans.forEach((p,i)=>near(p,witness.plans[i]));
 const plan=plans[0],trip=new CoupledTrip(engine.definition,plan),owner=new AdaptiveWorld(engine.definition,plan.base);
 const job=owner.extend(Math.ceil(plan.end/8)*8,plan.knownAt,trip.ownership(),plan.controls);while(!job.next().done){}
 for(let t=plan.base.t;t<=owner.end;t+=1/256)for(const id of [engine.definition.origin.id,engine.definition.relay.id])assert.deepEqual(owner.sample(id,t),trip.world.sample(id,t));
 assert.ok(engine.snapshot().stats.trialControllerEvaluations<1100);
 const store=new AdaptiveViewStore(engine.definition);store.ingest(engine.delta());
 for(const event of [6,20,20.5,39.5,52.5,54.5]){
  const before=store.view(event-.01),after=store.view(event+.01);
  assert.deepEqual(sampleVessel(before.vessels[0],event+.01),sampleVessel(after.vessels[0],event+.01));
 }
});
test('exhausted speculative visitor budget cannot mutate or promote a reused owner prefix',()=>{
 const d=JSON.parse(readFileSync('fixtures/traffic/orison-flexible-service.json','utf8')),world=new AdaptiveWorld(d),job=world.extend(8,0);while(!job.next().done){}
 const original=structuredClone({anchor:world.anchor,controls:world.controls}),work=serviceWork();work.visitor.limit=0;
 const candidate=planServiceJob(d,world.chunks[0].anchor,world.controls,.9,'exhausted',work);
 assert.throws(()=>{while(!candidate.next().done){}},/Shared propagation budget exhausted/);
 assert.deepEqual({anchor:world.anchor,controls:world.controls},original);assert.equal(work.visitor.used,0);assert.equal(work.trials,4);
});
test('a later coupled fault permits playback and scrubbing of earlier known history',()=>{
 const d=JSON.parse(readFileSync('fixtures/traffic/orison-flexible-service.json','utf8')),hooks:{failAt?:'capture'}={},engine=new AdaptiveEngine(d,hooks);
 while(engine.advanceTo(64,4096).yielded){}hooks.failAt='capture';while(engine.advanceTo(128,4096).yielded){}
 assert.equal(engine.frontier,93);assert.match(engine.halt!,/capture/);
 const store=new AdaptiveViewStore(engine.definition);store.ingest(engine.delta());
 for(const cursor of [0,40,55,77,93]){const view=store.view(cursor);assert.ok(view.window.end<=engine.frontier);assert.ok(view.vessels[0].samples.every(s=>s.t<=view.window.end));assert.equal(sampleVessel(view.vessels[0],cursor).t,cursor);}
});
