import {readFileSync,writeFileSync} from 'node:fs';
import {NetworkEngine} from '../../../src/network/engine';
import {AdaptiveWorld} from '../../../src/adaptive/world';
import {CoupledTrip,type CoupledPlan} from '../../../src/adaptive/plan';
const through=Number(process.argv[2]??512),engine=new NetworkEngine(JSON.parse(readFileSync('fixtures/traffic/orison-relay-network.json','utf8'))),start=performance.now();
const plans=engine.definition.lanes.map(()=>new Map<string,CoupledPlan>()),controls=engine.definition.lanes.map(()=>new Map<number,any>()),resources=new Map<number,any>(),events=engine.definition.lanes.map(()=>new Map<string,any>());let after=-1,maxPacketBytes=0;
for(let target=0;target<=through;target+=8){while(engine.advanceTo(target,4096).yielded){}if(engine.halt)throw Error(engine.halt);const p=engine.delta(after);after=engine.frontier;maxPacketBytes=Math.max(maxPacketBytes,p.stats.packetBytes);p.resources.forEach(r=>resources.set(r.t,r));p.lanes.forEach((l,i)=>{l.visits.forEach(v=>plans[i].set(v.id,v.plan));l.chunks.forEach(c=>controls[i].set(c.start,{t:c.start,arcs:c.arcs,check:c.check}));l.events.forEach(e=>events[i].set(e.id,e));});if(target%64===0)console.log({target,seconds:(performance.now()-start)/1000,stats:p.stats});}
const result={through,seconds:(performance.now()-start)/1000,definition:engine.definition,snapshot:engine.snapshot(),maxPacketBytes,resources:[...resources.values()].sort((a,b)=>a.t-b.t),lanes:engine.definition.lanes.map((definition,i)=>({definition,plans:[...plans[i].values()],controls:[...controls[i].values()].sort((a,b)=>a.t-b.t),events:[...events[i].values()].sort((a,b)=>a.t-b.t)}))};
writeFileSync(`docs/design/multiship-service/replay-${through}.json`,JSON.stringify(result)+'\n');
const lanes=result.lanes.map(l=>{
 const trips=l.plans.map(p=>new CoupledTrip(l.definition,p)),end=Math.max(...l.controls.map(c=>c.t+8)),world=new AdaptiveWorld(l.definition),job=world.extend(end,0,trips.flatMap(t=>t.ownership()),l.controls);while(!job.next().done){}
 for(const trip of trips){const anchor=world.chunks.find(c=>c.data.start===trip.plan.base.t)!.anchor;if(JSON.stringify(anchor)!==JSON.stringify(trip.plan.base))throw Error('Plan base differs from original-anchor replay');}
 const replay=[trips[0],trips.at(-1)!].map(trip=>({plan:trip.plan,samples:Array.from({length:Math.ceil((trip.plan.end-trip.plan.schedule.departure)*32)+1},(_,i)=>trip.sample(trip.plan.schedule.departure+i/32)),events:trip.events}));
 const station=world.chunks.flatMap(c=>c.data.station).filter(s=>s.t%1===0||trips.some(t=>t.ownership().some(e=>e.t===s.t)));
 return {...l,end,replay,station};
});
writeFileSync('docs/design/multiship-service/oracle-input.json',JSON.stringify({...result,lanes})+'\n');
console.log({through,seconds:result.seconds,plans:result.lanes.map(l=>l.plans.length),maxPacketBytes,snapshot:result.snapshot});
