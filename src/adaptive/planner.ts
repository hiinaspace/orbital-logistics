import {AdaptiveWorld,quiet,type AdaptiveDefinition,type Anchor,type Control} from './world';
import {buildPlanJob,economicalSeed,type Schedule,type CoupledTrip} from './plan';
import {PlanningFailure} from '../maintained/shoot';

export interface ServiceWork {controller:{used:number;limit:number};visitor:{used:number;limit:number};trials:number}
export const serviceWork=():ServiceWork=>({controller:{used:0,limit:4224},visitor:{used:0,limit:768},trials:0});
export const admission={maxTrials:4,maxBurned:.32,maxDeltaV:.55,adequateBurned:.26} as const;
// A bounded search of the near-Hohmann service family, not a global optimizer.
// Cheap seeds only rank schedules; both finite legs and the loaded station
// stream are solved, funded and frozen before any candidate is published.
export function* planServiceJob(d:AdaptiveDefinition,base:Anchor,prefix:Control[],fuel:number,id:string,work:ServiceWork=serviceWork()):Generator<void,CoupledTrip>{
 const guide=new AdaptiveWorld(d,base,work.controller);yield* guide.extend(base.t+80,base.t);
 const outbound:{departure:number;arrival:number;cost:number}[]=[];
 for(let departure=base.t+4;departure<=base.t+16;departure+=.5){if(!quiet(departure))continue;
  const from=guide.sample(d.origin.id,departure).y;
  for(let flight=12;flight<=16;flight+=.5){const arrival=departure+flight;if(!quiet(arrival)||!quiet(arrival+.5))continue;
   try{const seed=economicalSeed(from,guide.sample(d.relay.id,arrival).y,flight,1.05+fuel);const cost=Math.hypot(...seed.slice(0,3))*1.6+Math.hypot(...seed.slice(3))*1.8;outbound.push({departure,arrival,cost});}catch(e){if(!(e instanceof PlanningFailure))throw e;}
  }
 }
 outbound.sort((a,b)=>a.cost-b.cost||a.departure-b.departure||a.arrival-b.arrival);
 const candidates:{schedule:Schedule;cost:number}[]=[];
 for(const out of outbound.slice(0,8)){yield;
  for(let dwell=8;dwell<=40;dwell+=.5){const release=out.arrival+dwell;if(!quiet(release))continue;const from=guide.sample(d.relay.id,release).y;
   for(let flight=12;flight<=16;flight+=.5){const homeArrival=release+flight;if(!quiet(homeArrival)||homeArrival+2-out.departure>64)continue;
    try{const seed=economicalSeed(from,guide.sample(d.origin.id,homeArrival).y,flight,1.8);const cost=out.cost+Math.hypot(...seed.slice(0,3))*1.6+Math.hypot(...seed.slice(3))*1.8;candidates.push({schedule:{departure:out.departure,relayArrival:out.arrival,release,homeArrival},cost});}catch(e){if(!(e instanceof PlanningFailure))throw e;}
   }
  }
 }
 candidates.sort((a,b)=>a.cost-b.cost||a.schedule.homeArrival-b.schedule.homeArrival||JSON.stringify(a.schedule).localeCompare(JSON.stringify(b.schedule)));
 guide.chunks=[]; // Cheap ranks retain no speculative physical history.
 let best:CoupledTrip|undefined,trials=0,last='No affordable transfer window';
 for(const c of candidates){if(trials>=admission.maxTrials)break;yield;trials++;work.trials=trials;
  try{const trip=yield* buildPlanJob(d,base,prefix,c.schedule,fuel,id,work);
   if(trip.burned+trip.stationBurned>admission.maxBurned||trip.deltaV>admission.maxDeltaV)throw new PlanningFailure('Routine service burn budget exceeded',trip.plan.evaluations);
   if(!best||trip.burned+trip.stationBurned<best.burned+best.stationBurned-1e-12||Math.abs(trip.burned+trip.stationBurned-best.burned-best.stationBurned)<=1e-12&&trip.plan.end<best.plan.end)best=trip;
   if(best.burned+best.stationBurned<=admission.adequateBurned)break;
  }catch(e){if(!(e instanceof PlanningFailure))throw e;last=e.message;}
 }
 if(!best)throw new PlanningFailure(last,trials*192);
 return best;
}
