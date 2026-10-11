import type {Scenario,State} from '../sim/schema';
import {shootLunar,LunarPlanningFailure,type LunarShot,type LunarWorkBudget,type SteeringSeed} from './shoot';
export const RETURN_COAST=.012;
export interface ReturnCandidate {shot:LunarShot;coast:number;offset:number;deltaV:number;turn:number;score:number}
export function returnShape(shot:LunarShot,offset:number,coast:number):ReturnCandidate {
 const dirs=shot.arcs.flatMap(a=>a.steering!.keys.map(k=>k.direction));
 const turn=dirs.slice(1).reduce((n,d,i)=>n+Math.acos(Math.max(-1,Math.min(1,d.reduce((sum,v,j)=>sum+v*dirs[i][j],0)))),0);
 const deltaV=38.4*shot.arcs.reduce((n,a)=>n+a.end-a.start,0);
 return {shot,coast,offset,deltaV,turn,score:deltaV+.08*turn+.3*Math.max(0,offset)};
}
// A short local schedule search, not a fuel optimum: preserve cadence and changing
// geometry. Each family seed stays separate; failed probes never update either.
export function* lunarReturns(s:Scenario,nominal:number,earliest:number,initial:(t:number)=>State,target:(t:number)=>State,single:SteeringSeed,coasting:SteeringSeed|undefined,cold:SteeringSeed,record:(evaluations:number,stages:number)=>void):Generator<void,ReturnCandidate[]> {
 const budget:LunarWorkBudget={evaluations:0,stages:0,maxEvaluations:720,maxStages:3000000},candidates:ReturnCandidate[]=[];
 const attempts=[{offset:0,seed:coasting??single},...(coasting?[{offset:0,seed:cold}]:[]),{offset:-.012,seed:cold}];
 for(const a of attempts){
  const start=nominal+a.offset;if(start<earliest||budget.evaluations>=budget.maxEvaluations||budget.stages>=budget.maxStages)continue;
  try {const shot=yield* shootLunar(s,start,initial(start),target,a.seed,true,RETURN_COAST,budget);record(shot.evaluations,shot.stages);
   const candidate=returnShape(shot,a.offset,RETURN_COAST);candidates.push(candidate);
   if(candidate.deltaV<=2.5&&candidate.turn<=5.8)break;
  }catch(e){if(!(e instanceof LunarPlanningFailure))throw e;record(e.evaluations,e.stages);}
 }
 // A poor coasting branch may be worse than the established descent. Compare it
 // with that family; otherwise keep the cheaper work budget and coast structure.
 if(!candidates.length||candidates.every(c=>c.deltaV>3||c.turn>6.5)){
  try {const shot=yield* shootLunar(s,nominal,initial(nominal),target,single,true);record(shot.evaluations,shot.stages);candidates.push(returnShape(shot,0,0));}
  catch(e){if(!(e instanceof LunarPlanningFailure))throw e;record(e.evaluations,e.stages);}
 }
 return candidates.sort((a,b)=>a.score-b.score||a.offset-b.offset);
}
