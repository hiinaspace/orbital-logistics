import {bodyState,bodyAcceleration} from '../sim/dynamics';
import {directionAt} from '../sim/steering';
import type {Scenario,State,ThrustArc,Vec3} from '../sim/schema';
import {surfaceNormal} from '../sim/logistics';
const L=.025,V=Math.sqrt(.02/L),U=L/V,A=.02/L**2;
export class LunarPlanningFailure extends Error {evaluations=0;stages=0;}
const angles=(v:Vec3)=>[Math.atan2(v[1],v[0]),Math.asin(Math.max(-1,Math.min(1,v[2])))];
const vector=(a:number,e:number):Vec3=>[Math.cos(e)*Math.cos(a),Math.cos(e)*Math.sin(a),Math.sin(e)];
export function rotate(v:Vec3,a:number):Vec3{return [v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a),v[2]];}
function linear(a:number[][],b:number[]):number[]{
 const n=b.length,m=a.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;
  if(Math.abs(m[pivot][i])<1e-18)throw new LunarPlanningFailure('Singular steering branch');
  [m[i],m[pivot]]=[m[pivot],m[i]];const d=m[i][i];for(let j=i;j<=n;j++)m[i][j]/=d;
  for(let k=0;k<n;k++)if(k!==i){const f=m[k][i];for(let j=i;j<=n;j++)m[k][j]-=f*m[i][j];}}
 return m.map(r=>r[n]);
}
export interface SteeringSeed {start:number;duration:number;keys:Vec3[]}
export interface LunarWorkBudget {evaluations:number;stages:number;maxEvaluations:number;maxStages:number}
export interface LunarShot {arcs:ThrustArc[];arc:ThrustArc;seed:SteeringSeed;evaluations:number;stages:number;residual:number;minimumRadius:number}
// Trial-only translating frame. Accepted controls must still pass the inertial
// canonical Runner, including continuous clearance, mass law and paid capture.
export function* shootLunar(s:Scenario,start:number,initial:State,target:(t:number)=>State,seed:SteeringSeed,landing:boolean,coast=0,budget?:LunarWorkBudget):Generator<void,LunarShot>{
 if(coast!==0&&(!landing||coast!==.012))throw Error('Unsupported lunar coast family');
 const pad=s.logistics!.ports.find(p=>p.rail.kind==='surface')!,moon=s.bodies.find(b=>b.id==='moon')!;
 const offset=start-seed.start,ds=seed.keys.map(v=>rotate(v,offset));
 if(!landing)ds[0]=surfaceNormal(pad,start);
 const original=[...ds.flatMap(angles),seed.duration/U],indices=[...(landing?[0,1,2,3,4,5,6,7]:[2,3,4,5,6,7,8,9]),10];
 const base=original.slice(),x=indices.map(i=>base[i]);let evaluations=0,stages=0;
 const arcFor=(controls:number[]):ThrustArc[]=>{
  const q=base.slice();indices.forEach((j,i)=>q[j]=controls[i]);
  const end=start+q[10]*U,dirs=Array.from({length:5},(_,i)=>vector(q[2*i],q[2*i+1]));
  if(landing)dirs[4]=surfaceNormal(pad,end);
  if(!coast)return [{id:landing?'descent':'ascent',start,end,direction:dirs[0],throttle:1,steering:{kind:'spherical-smoothstep-v1',keys:dirs.map((direction,i)=>({offset:(end-start)*i/4,direction}))}}];
  const first=(end-start)*.2,finish=end+coast;
  dirs[4]=surfaceNormal(pad,finish);
  return [
   {id:'deorbit',start,end:start+first,direction:dirs[0],throttle:1,steering:{kind:'spherical-smoothstep-v1',keys:dirs.slice(0,2).map((direction,i)=>({offset:(start+first-start)*i,direction}))}},
   {id:'terminal',start:start+first+coast,end:finish,direction:dirs[2],throttle:1,steering:{kind:'spherical-smoothstep-v1',keys:dirs.slice(2).map((direction,i)=>({offset:(finish-(start+first+coast))*i/2,direction}))}}];

 };
 const inside=(q:number[])=>q.every((v,i)=>Number.isFinite(v)&&Math.abs(v-x[i])<=(i===8?1.5:1.1))&&q.at(-1)!>1.2&&q.at(-1)!<(landing?3.75:3.4);
 const evaluate=(controls:number[],h:number)=>{
  if(evaluations>=(budget?360:720)||budget&&budget.evaluations>=budget.maxEvaluations)throw new LunarPlanningFailure('Steering evaluation budget exhausted');evaluations++;if(budget)budget.evaluations++;
  const arcs=arcFor(controls),arc=arcs.at(-1)!,c0=bodyState(moon,start);let y=initial.map((v,i)=>(v-c0[i])/(i<3?L:V)),minimum=Math.hypot(...y.slice(0,3));
  let segment:ThrustArc|undefined;
  const rhs=(tau:number,z:number[])=>{
   if(stages===3000000||budget&&budget.stages>=budget.maxStages)throw new LunarPlanningFailure('Steering integration budget exhausted');stages++;if(budget)budget.stages++;
   const t=start+tau*U,c=bodyState(moon,t),ca=bodyAcceleration(moon,t),p=z.slice(0,3).map((v,i)=>c[i]+v*L);
   const acc=z.slice(0,3).map(v=>-v/Math.hypot(...z.slice(0,3))**3);
   for(const b of s.bodies)if(b.id!==moon.id){const q=bodyState(b,t).slice(0,3).map((v,i)=>v-p[i]),r=Math.hypot(...q);for(let i=0;i<3;i++)acc[i]+=(b.mu*q[i]/r**3-ca[i])/A;}
   const active=segment,d=active?directionAt(active,t-active.start):[0,0,0];return [...z.slice(3),...acc.map((v,i)=>v+1.2*d[i])];
  };
  const cuts=[...new Set([start,...arcs.flatMap(a=>a.steering!.keys.map(k=>a.start+k.offset))])].sort((a,b)=>a-b);
  for(let k=0;k<cuts.length-1;k++){
   const lo=(cuts[k]-start)/U,hi=(cuts[k+1]-start)/U,n=Math.ceil((hi-lo)/h),step=(hi-lo)/n;
   segment=arcs.find(a=>a.start<(cuts[k]+cuts[k+1])/2&&a.end>(cuts[k]+cuts[k+1])/2);
   for(let j=0;j<n;j++){const t=lo+j*step,a=rhs(t,y),b=rhs(t+step/2,y.map((v,i)=>v+step*a[i]/2)),c=rhs(t+step/2,y.map((v,i)=>v+step*b[i]/2)),d=rhs(t+step,y.map((v,i)=>v+step*c[i]));y=y.map((v,i)=>v+step*(a[i]+2*b[i]+2*c[i]+d[i])/6);minimum=Math.min(minimum,Math.hypot(...y.slice(0,3)));}
  }
  const endBody=bodyState(moon,arc.end),goal=target(arc.end).map((v,i)=>(v-endBody[i])/(i<3?L:V)),state=y.map((v,i)=>v-goal[i]);
  const keys=arcs.flatMap(a=>a.steering!.keys.map(k=>k.direction)),turns=keys.slice(1).map((v,i)=>20*Math.min(0,v.reduce((n,a,j)=>n+a*keys[i][j],0)+.498));
  const residual=[...state,50*Math.min(0,minimum-1.000039),...turns];
  return {arcs,arc,state,residual,cost:residual.reduce((n,v)=>n+v*v,0),minimum};
 };
 try {
 let controls=x.slice(),at:ReturnType<typeof evaluate>|undefined;
 for(const step of [.035,.005]){
  yield;at=evaluate(controls,step);
  for(let iteration=0;iteration<40;iteration++){
   if(Math.hypot(...at.residual)<(step===.005?2e-8:2e-5))break;
   const columns:number[][]=[];
   for(let j=0;j<controls.length;j++){yield;const q=controls.slice(),h=Math.min(1e-5,Math.max(1e-7,Math.hypot(...at.residual)*.01));q[j]+=h;const p=evaluate(q,step);columns.push(p.residual.map((v,i)=>(v-at!.residual[i])/h));}
   let accepted=false;
   for(const damping of [1e-8,1e-5,.01,.1,1,10]){
    const matrix=columns.map((c,i)=>columns.map((d,j)=>c.reduce((n,v,k)=>n+v*d[k],0)+(i===j?damping:0))),delta=linear(matrix,columns.map(c=>-c.reduce((n,v,k)=>n+v*at!.residual[k],0)));
    const max=Math.max(1,...delta.map(v=>Math.abs(v)/.3));
    for(const f of [1,.5,.25,.125,.0625]){yield;const q=controls.map((v,i)=>v+f*delta[i]/max);if(!inside(q))continue;const p=evaluate(q,step);if(p.cost<at.cost){controls=q;at=p;accepted=true;break;}}
    if(accepted)break;
   }
   if(!accepted)throw new LunarPlanningFailure('No safe steering improvement');
  }
  if(Math.hypot(...at.residual)>(step===.005?5e-8:5e-5))throw new LunarPlanningFailure('Steering did not converge');
 }
 const arc=at!.arc;return {arcs:at!.arcs,arc,seed:{start,duration:arc.end-start-coast,keys:at!.arcs.flatMap(a=>a.steering!.keys.map(k=>k.direction))},evaluations,stages,residual:Math.hypot(...at!.state),minimumRadius:at!.minimum};
 }catch(e){if(e instanceof LunarPlanningFailure){e.evaluations=evaluations;e.stages=stages;}throw e;}
}
