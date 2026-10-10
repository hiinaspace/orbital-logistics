import {readFileSync,writeFileSync} from 'node:fs';
import {AdaptiveEngine} from '../src/adaptive/engine';
import {AdaptiveViewStore} from '../src/adaptive/view';
import {Runner} from '../src/sim/runner';
import {surfaceSample,surfaceDuration} from '../src/surface-flexible/contracts';
import type {WorldChunk} from '../src/maintained/world';
import type {AdaptiveVisit} from '../src/adaptive/engine';
const definition=JSON.parse(readFileSync('fixtures/traffic/orison-surface-flexible.json','utf8')),e=new AdaptiveEngine(definition),v=new AdaptiveViewStore(e.definition),visits=new Map<string,AdaptiveVisit>(),chunks=new Map<number,WorldChunk>();
let after=-1,maxTurnMs=0,maxBalance=0;const peak:Record<string,number>={},begin=performance.now(),waits:{t:number;detail?:string}[]=[];
for(let t=0;t<=1024;t+=4){
 while(true){const start=performance.now(),r=e.advanceTo(t,24);maxTurnMs=Math.max(maxTurnMs,performance.now()-start);if(e.halt)throw Error(e.halt);if(!r.yielded)break;}
 const p=e.delta(after);for(const c of p.chunks)chunks.set(c.id,c);for(const trip of p.visits)visits.set(trip.id,trip);waits.push(...p.events.filter(x=>x.kind==='planning-failed').map(x=>({t:x.t,detail:x.detail})));
 v.ingest(p);after=e.frontier;maxBalance=Math.max(maxBalance,Math.abs(p.stats.fuelBalanceError));
 for(const k of ['runnerNodes','frames','chunks','physicalChunks','visits','packetBytes','viewBytes','surfaceCacheNodes','surfaceCacheBytes'])peak[k]=Math.max(peak[k]??0,v.stats[k]??0);
 if(t%128===0)console.log(JSON.stringify({t,completed:p.stats.completed,retries:p.stats.planningFailed,view:v.stats.viewBytes}));
}
const all=[...visits.values()],selected=[all[0],all.at(-1)!],surface=selected.flatMap(p=>p.localFlights!.map(f=>({flight:f,samples:Array.from({length:37},(_,i)=>surfaceSample(f,f.start+surfaceDuration*i/36))})));
const orbital=selected.flatMap(p=>[p.plan.outbound,p.plan.inbound].map(bundle=>{const r=new Runner(bundle),s=bundle.scenario;return {bundle,samples:Array.from({length:33},(_,i)=>r.sample(s.epoch+s.duration*i/32))};}));
const summary={elapsedMs:performance.now()-begin,maxTurnMs,maxBalance,peak,stats:e.delta().stats,waits,tours:all.map(p=>({knownAt:p.knownAt,launch:p.departure,touchdown:p.arrival,end:p.end,schedule:p.plan.schedule,delivery:p.plan.delivery}))};
writeFileSync('docs/evidence/surface-flexible-input.json',JSON.stringify({definition,surface,orbital,station:{chunks:[...chunks.values()].map(c=>({start:c.start,end:c.end,arcs:c.arcs,station:c.station.filter(s=>s.t===c.end||Number.isInteger((s.t-c.start)/2))})),ownership:all.flatMap(v=>v.events.filter(e=>e.portId===definition.relay.id&&['dock','transfer','undock'].includes(e.kind)))}})+'\n');
writeFileSync('docs/evidence/surface-flexible-runtime.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
