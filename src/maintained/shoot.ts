import {Runner} from '../sim/runner';
import type {Scenario,State,ThrustArc,Vec3} from '../sim/schema';

export interface Pulse {start:number;end:number}
export interface Shot {runner:Runner;arcs:ThrustArc[];evaluations:number;residual:number}
export class PlanningFailure extends Error {constructor(message:string,public evaluations=0){super(message);}}
function linear(a:number[][],b:number[]):number[] {
 const m=a.map((row,i)=>[...row,b[i]]);
 for(let i=0;i<6;i++) {
  let pivot=i;for(let j=i+1;j<6;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;
  if(Math.abs(m[pivot][i])<1e-11)throw new PlanningFailure('Singular shooting branch');
  [m[i],m[pivot]]=[m[pivot],m[i]];
  const d=m[i][i];for(let k=i;k<=6;k++)m[i][k]/=d;
  for(let j=0;j<6;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=6;k++)m[j][k]-=f*m[i][k];}
 }
 return m.map(row=>row[6]);
}
// A fixed two-pulse family, full six-state terminal target and a hard propagation
// count. Trials use the canonical dynamics; display and wall-clock time are absent.
export function* shootForcesJob(scenario:Scenario,pulses:[Pulse,Pulse],target:State,seed:number[]=Array(6).fill(0),budget=64):Generator<void,Shot> {
 const engine=scenario.ship.engine!;if(!engine || budget<1)throw new PlanningFailure('Invalid shooting domain');
 const bound=engine.maxThrust/Math.sqrt(3),duration=scenario.duration,scale=duration/4;
 let evaluations=0,x=[...seed];
 const arcs=(v:number[]):ThrustArc[]=>pulses.map((p,i)=>{const f=v.slice(i*3,i*3+3),n=Math.hypot(...f);return {...p,id:`pulse-${i}`,direction:(n?f.map(a=>a/n):[1,0,0]) as Vec3,throttle:n/engine.maxThrust};});
 function* evaluate(v:number[],step:number):Generator<void,{runner:Runner;residual:number[];norm:number}> {
  yield;
  if(evaluations>=budget)throw new PlanningFailure('Shooting evaluation budget exhausted');evaluations++;
  if(v.some(a=>!Number.isFinite(a)||Math.abs(a)>bound+1e-12))throw new PlanningFailure('Force bound exceeded');
  const program={schemaVersion:3 as const,id:'bounded-online-shot',burns:[],thrustArcs:arcs(v)};
  const runner=new Runner({scenario:{...scenario,logistics:undefined,rendezvous:undefined,policy:{...scenario.policy,step,maxNodes:Math.ceil(duration/step)+1024}},program});
  const end=runner.advanceTo(scenario.epoch+duration);if(end.status!=='horizon'||end.t!==scenario.epoch+duration)throw new PlanningFailure(`Unsafe shooting candidate: ${end.status}`);
  const residual=end.y.map((a,i)=>(a-target[i])*(i<3?1:scale));
  return {runner,residual,norm:Math.hypot(...residual)};
 };
 try {for(const step of [Math.max(scenario.policy.step,1/64),scenario.policy.step]) {
  let at=yield* evaluate(x,step),converged=false;
  for(let iteration=0;iteration<7;iteration++) {
   if(at.norm<2e-11){converged=true;break;}
   const columns:number[][]=[];for(let j=0;j<6;j++){const y=[...x],h=1e-5*(x[j]>=bound-1e-5?-1:1);y[j]+=h;const r=yield* evaluate(y,step);columns.push(r.residual.map((a,i)=>(a-at.residual[i])/h));}
   const dx=linear(Array.from({length:6},(_,i)=>columns.map(c=>c[i])),at.residual.map(a=>-a));
   let accepted=false;
   for(const fraction of [1,.5,.25,.125]) {
    const y=x.map((a,i)=>a+fraction*dx[i]);if(y.some(a=>Math.abs(a)>bound))continue;
    let candidate;try{candidate=yield* evaluate(y,step);}catch(error){if(error instanceof PlanningFailure && error.message.startsWith('Unsafe'))continue;throw error;}
    if(candidate.norm<at.norm){x=y;at=candidate;accepted=true;break;}
   }
   if(!accepted)throw new PlanningFailure('No bounded shooting improvement');
  }
  if(!converged && at.norm>=2e-11)throw new PlanningFailure(`Shooting did not converge (${at.norm})`);
  if(step===scenario.policy.step)return {runner:at.runner,arcs:arcs(x),evaluations,residual:at.norm};
 }
 throw new PlanningFailure('No production shooting result');
 }catch(error){if(error instanceof PlanningFailure)error.evaluations=evaluations;throw error;}
}

export function shootForces(...args:Parameters<typeof shootForcesJob>):Shot {const job=shootForcesJob(...args);let result=job.next();while(!result.done)result=job.next();return result.value;}
