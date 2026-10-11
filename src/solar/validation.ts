// Independent fixed-grid RK4 witness. It never participates in playback or uses
// the prepared path as a restart. The only inputs are initial states and frozen
// open-loop control coefficients from the artifact.
import {solarStates,solarBodyAcceleration,solarGravityRelative,type SolarWorld} from './ephemeris';
import {solarControl,type SolarArc} from './query';
export function integrateSolar(world:SolarWorld,arc:SolarArc,steps:number):number[]{
 if(!Number.isInteger(steps)||steps<16||steps>262144)throw Error('Solar validation work budget');
 if(![0,1,3].includes(arc.referenceBody)||arc.localInitial.length!==6)throw Error('Missing canonical solar origin');
 let y=[...arc.localInitial,0],t=arc.start;const h=(arc.end-arc.start)/steps;
 const rhs=(epoch:number,q:number[])=>{
  // The endpoint-left control is retained by its last polynomial for RK stages;
  // the exact event-right state switches it off, without a velocity impulse.
  const control=solarControl(arc,Math.min(epoch,arc.end-Number.EPSILON*Math.max(1,arc.end))),gravity=solarGravityRelative(world,epoch,q,arc.referenceBody),origin=solarBodyAcceleration(world,arc.referenceBody,epoch);
  return [...q.slice(3,6),...gravity.map((x,i)=>x+control[i]-origin[i]),Math.hypot(...control)];
 };
 for(let k=0;k<steps;k++){
  t=arc.start+k*h;const a=rhs(t,y),b=rhs(t+h/2,y.map((x,i)=>x+h*a[i]/2)),c=rhs(t+h/2,y.map((x,i)=>x+h*b[i]/2)),d=rhs(t+h,y.map((x,i)=>x+h*c[i]));
  y=y.map((x,i)=>x+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
 }
 const center=solarStates(world,arc.end)[arc.referenceBody];return y.map((x,i)=>x+(i<6?center[i]:0));
}
