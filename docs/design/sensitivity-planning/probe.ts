import {readFileSync,writeFileSync} from 'node:fs';
import {AdaptiveEngine} from '../../../src/adaptive/engine';
const definition=JSON.parse(readFileSync('fixtures/traffic/orison-flexible-service.json','utf8'));
const engine=new AdaptiveEngine(definition),started=performance.now(),plans=new Map(),controls=new Map(),events=new Map(),stalls=[];
const through=Number(process.argv[2]??512);let after=-1,last=started,previous=0;
while(engine.frontier<through||!engine.initialized){
 engine.advanceTo(Math.min(through,engine.frontier+32),24);
 if(engine.frontier!==previous){const now=performance.now();if(now-last>100)stalls.push({at:previous,seconds:(now-last)/1000});previous=engine.frontier;last=now;}
 if(engine.frontier-after>=16||engine.frontier===through){const delta=engine.delta(after);for(const v of delta.visits)plans.set(v.id,v.plan);for(const c of delta.chunks)controls.set(c.start,{t:c.start,arcs:c.arcs,check:c.check});for(const event of delta.events)events.set(event.id,event);after=engine.frontier;}
 if(engine.halt)throw Error(engine.halt);
}
const report={through,seconds:(performance.now()-started)/1000,stalls,stats:engine.snapshot().stats,plans:[...plans.values()].map(p=>({schedule:p.schedule,evaluations:p.evaluations}))};
writeFileSync(`docs/design/sensitivity-planning/timing-${through}.json`,JSON.stringify(report,null,2)+'\n');
writeFileSync(`docs/design/sensitivity-planning/replay-${through}.json`,JSON.stringify({definition,plans:[...plans.values()],controls:[...controls.values()],events:[...events.values()],through})+'\n');console.log(report);
