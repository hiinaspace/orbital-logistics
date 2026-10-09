import {readFileSync,writeFileSync} from 'node:fs';
import {AdaptiveEngine} from '../../../src/adaptive/engine';
const fixture=JSON.parse(readFileSync('fixtures/traffic/orison-flexible-service.json','utf8')),d={...fixture,domain:'adaptive-relay-v1',id:'orison-flexible-service',name:'Orison · flexible service'},e=new AdaptiveEngine(d);
const started=performance.now(),visits=new Map(),chunks=new Map(),events=new Map();let frontier=-1,calls=0;
const through=Number(process.argv[2]??128);
while(e.frontier<through||!e.initialized){const result=e.advanceTo(through,4096);calls++;const p=e.delta(frontier);for(const v of p.visits)visits.set(v.id,v);for(const c of p.chunks)chunks.set(c.id,c);for(const event of p.events)events.set(event.id,event);frontier=e.frontier;if(calls%2===0)console.log({frontier,completed:p.stats.completed,failed:p.stats.planningFailed,elapsed:(performance.now()-started)/1000});if(e.halt)throw Error(e.halt);if(!result.yielded)break;}
const snapshot=e.snapshot(),report={through,calls,seconds:(performance.now()-started)/1000,snapshot,visits:[...visits.values()].map(v=>({id:v.id,schedule:v.plan.schedule,delivery:v.plan.delivery,evaluations:v.evaluations,burned:v.events.filter((e:any)=>e.kind==='thrust-end'||e.kind==='dock').reduce((n:number,e:any)=>n+e.fuelUsed,0)}))};
writeFileSync(`docs/design/flexible-service/rollout-${through}.json`,JSON.stringify(report,null,2)+'\n');
writeFileSync(`docs/design/flexible-service/online-replay-${through}.json`,JSON.stringify({definition:d,plans:[...visits.values()].map(v=>v.plan),controls:[...chunks.values()].flatMap(c=>[{t:c.start,arcs:c.arcs,check:c.check}]),events:[...events.values()],through})+'\n');console.log(report);
