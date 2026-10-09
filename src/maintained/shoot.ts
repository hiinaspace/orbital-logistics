import {Runner} from '../sim/runner';
import type {Scenario,State,ThrustArc,Vec3} from '../sim/schema';

// Physical trajectories and sensitivity sweeps both consume bounded work.
export interface PropagationBudget {used:number;limit:number;storage?:{reserve(extra?:number):void}}
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
// work count. Trials use canonical dynamics; display and wall-clock time are absent.
export function* shootForcesJob(scenario:Scenario,pulses:[Pulse,Pulse],target:State,seed:number[]=Array(6).fill(0),budget=64,domain:'cube'|'sphere'='cube',work?:PropagationBudget,method:'finite-difference'|'sensitivity'='finite-difference'):Generator<void,Shot> {
 const engine=scenario.ship.engine!;if(!engine || budget<1)throw new PlanningFailure('Invalid shooting domain');
 if(!['cube','sphere'].includes(domain))throw new PlanningFailure('Invalid force search domain');
 const bound=domain==='sphere'?engine.maxThrust:engine.maxThrust/Math.sqrt(3),inside=(v:number[],tolerance=0)=>v.every(Number.isFinite)&&(domain==='sphere'?[0,3].every(i=>Math.hypot(...v.slice(i,i+3))<=bound+tolerance):v.every(a=>Math.abs(a)<=bound+tolerance)),duration=scenario.duration,scale=duration/4;
 let evaluations=0,x=[...seed];
 const arcs=(v:number[]):ThrustArc[]=>pulses.map((p,i)=>{const f=v.slice(i*3,i*3+3),n=Math.hypot(...f);return {...p,id:`pulse-${i}`,direction:(n?f.map(a=>a/n):[1,0,0]) as Vec3,throttle:domain==='sphere'?Math.min(1,n/engine.maxThrust):n/engine.maxThrust};});
 function* evaluate(v:number[],step:number):Generator<void,{runner:Runner;residual:number[];norm:number}> {
  yield;
  if(work){if(work.used>=work.limit)throw new PlanningFailure('Shared propagation budget exhausted');work.used++;}
  if(evaluations>=budget)throw new PlanningFailure('Shooting evaluation budget exhausted');evaluations++;
  if(!inside(v,1e-12))throw new PlanningFailure('Force bound exceeded');
  const program={schemaVersion:3 as const,id:'bounded-online-shot',burns:[],thrustArcs:arcs(v)};
  work?.storage?.reserve(2*(Math.ceil(duration/step)+1024));
  const runner=new Runner({scenario:{...scenario,logistics:undefined,rendezvous:undefined,policy:{...scenario.policy,step,maxNodes:Math.ceil(duration/step)+1024}},program});
  const end=runner.advanceTo(scenario.epoch+duration);if(end.status!=='horizon'||end.t!==scenario.epoch+duration)throw new PlanningFailure(`Unsafe shooting candidate: ${end.status}`);
  const residual=end.y.map((a,i)=>(a-target[i])*(i<3?1:scale));
  return {runner,residual,norm:Math.hypot(...residual)};
 };
 try {for(const step of [Math.max(scenario.policy.step,1/64),scenario.policy.step]) {
  let at=yield* evaluate(x,step),converged=false;
  for(let iteration=0;iteration<7;iteration++) {
   if(at.norm<2e-11){converged=true;break;}
   let jacobian:number[][]|undefined;
   if(method==='sensitivity'){
    yield;
    if(work){if(work.used>=work.limit)throw new PlanningFailure('Shared propagation budget exhausted');work.used++;}
    if(evaluations>=budget)throw new PlanningFailure('Shooting evaluation budget exhausted');evaluations++;
    jacobian=at.runner.terminalForceJacobian()?.map((row,i)=>row.map(v=>v*(i<3?1:scale)));
   }
   const columns:number[][]=[];if(!jacobian)for(let j=0;j<6;j++){const y=[...x],edge=domain==='sphere'&&Math.hypot(...x.slice(Math.floor(j/3)*3,Math.floor(j/3)*3+3))>=bound-2e-5,h=1e-5*(edge?(x[j]>=0?-1:1):x[j]>=bound-1e-5?-1:1);y[j]+=h;
    // At the sphere boundary an orthogonal coordinate probe needs a tiny
    // inward normal correction. Its O(h^2) offset preserves the one-sided
    // derivative while keeping the actual finite-force trial feasible.
    if(domain==='sphere'){const base=Math.floor(j/3)*3,n=Math.hypot(...y.slice(base,base+3));if(n>bound)for(let k=base;k<base+3;k++)y[k]*=(bound-h*h/bound)/n;}
    const r=yield* evaluate(y,step);columns.push(r.residual.map((a,i)=>(a-at.residual[i])/h));}
   const dx=linear(jacobian??Array.from({length:6},(_,i)=>columns.map(c=>c[i])),at.residual.map(a=>-a));
   let accepted=false;
   for(const fraction of [1,.5,.25,.125]) {
    const y=x.map((a,i)=>a+fraction*dx[i]);if(!inside(y,domain==='sphere'?1e-12:0))continue;
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
