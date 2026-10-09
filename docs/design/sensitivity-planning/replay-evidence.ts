import {readFileSync,writeFileSync} from 'node:fs';
import {AdaptiveWorld,validateAdaptive} from '../../../src/adaptive/world';
import {CoupledTrip} from '../../../src/adaptive/plan';
const input=JSON.parse(readFileSync('docs/design/sensitivity-planning/replay-512.json','utf8')),d=validateAdaptive(input.definition),trips=input.plans.map((p:any)=>new CoupledTrip(d,p)),end=Math.max(...input.controls.map((c:any)=>c.t+8)),world=new AdaptiveWorld(d),job=world.extend(end,0,trips.flatMap((t:CoupledTrip)=>t.ownership()),input.controls);while(!job.next().done){}
for(const trip of trips){const anchor=world.chunks.find(c=>c.data.start===trip.plan.base.t)!.anchor;if(JSON.stringify(anchor)!==JSON.stringify(trip.plan.base))throw Error('Admitted base differs from original-anchor replay');}
const replay=[trips[0],trips.at(-1)!].map((trip:CoupledTrip)=>({plan:trip.plan,samples:Array.from({length:Math.ceil((trip.plan.end-trip.plan.schedule.departure)*32)+1},(_,i)=>trip.sample(trip.plan.schedule.departure+i/32)),events:trip.events}));
const station=world.chunks.flatMap(c=>c.data.station).filter(s=>s.t%1===0||trips.some((t:CoupledTrip)=>t.ownership().some(e=>e.t===s.t)));
writeFileSync('docs/design/sensitivity-planning/oracle-input.json',JSON.stringify({...input,end,station,replay})+'\n');console.log({end,plans:trips.length,station:station.length});
