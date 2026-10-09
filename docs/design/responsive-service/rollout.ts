import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {AdaptiveEngine} from '../../../src/adaptive/engine';
const witness=JSON.parse(readFileSync('docs/design/flexible-service/online-replay-512.json','utf8'));
const engine=new AdaptiveEngine(witness.definition),plans=new Map(),controls=new Map(),events=new Map(),started=performance.now();let after=-1;
while(engine.advanceTo(0,4096).yielded){}
for(const event of engine.delta().events)events.set(event.id,event);
while(engine.frontier<512){engine.advanceTo(Math.min(512,engine.frontier+32),4096);const p=engine.delta(after);for(const v of p.visits)plans.set(v.id,v.plan);for(const c of p.chunks)controls.set(c.start,{t:c.start,arcs:c.arcs,check:c.check});for(const event of p.events)events.set(event.id,event);after=engine.frontier;if(engine.halt)throw Error(engine.halt);}
const identicalPrograms=isDeepStrictEqual([...plans.values()],witness.plans),identicalControls=isDeepStrictEqual([...controls.values()],witness.controls),identicalEvents=isDeepStrictEqual([...events.values()],witness.events);
const report={through:512,seconds:(performance.now()-started)/1000,identicalPrograms,identicalControls,identicalEvents,plans:plans.size,stats:engine.snapshot().stats};
writeFileSync('docs/design/responsive-service/rollout.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.ok(identicalPrograms&&identicalControls&&identicalEvents);
