import {derivative,rk4} from './dynamics';
import {norm,type State,type Vec3} from './vectors';
import {directionAt} from './steering';
import type {Engine,Scenario,ThrustArc,Steering} from './schema';

// A mass-law anchor is immutable for a whole authored arc. All RK stages use
// the interval's mode, including the endpoint; only event processing changes mode.
export interface MassLaw {
  epoch:number; mass:number; nonfuel:number; force:number; exhaustVelocity:number;
  accelerationCap?:number; direction:Vec3; steering?:Steering; capEpoch?:number; depletionEpoch?:number;
}
export function massLaw(engine:Engine,arc:ThrustArc,nonfuel:number,fuel:number,ve:number):MassLaw {
  const mass=nonfuel+fuel,force=engine.maxThrust*arc.throttle,cap=engine.maxAcceleration??Infinity;
  const capTime=force===0 || !Number.isFinite(cap)?Infinity:Math.max(0,(mass-force/cap)/(force/ve));
  const transitionMass=Number.isFinite(capTime)?mass-force/ve*capTime:mass;
  let depletion=Infinity;
  if(force>0) {
    const linear=fuel*ve/force;
    depletion=linear<=capTime?linear:capTime+ve/cap*Math.log(transitionMass/nonfuel);
  }
  return {epoch:arc.start,mass,nonfuel,force,exhaustVelocity:ve,direction:[...arc.direction],...(arc.steering?{steering:structuredClone(arc.steering)}:{}),
    ...(Number.isFinite(cap)?{accelerationCap:cap}:{}),
    ...(Number.isFinite(capTime)?{capEpoch:arc.start+capTime}:{}),
    ...(Number.isFinite(depletion)?{depletionEpoch:arc.start+depletion}:{})};
}
export function massAt(law:MassLaw,t:number):number {
  if(law.force===0)return law.mass;
  if(t===law.depletionEpoch)return law.nonfuel;
  if(t<law.epoch || t>(law.depletionEpoch??Infinity))throw new Error('Mass law epoch outside powered interval');
  const dt=t-law.epoch,linear=Math.min(dt,(law.capEpoch??Infinity)-law.epoch);
  const m=law.mass-law.force/law.exhaustVelocity*linear;
  return Math.max(law.nonfuel,dt>linear ? m*Math.exp(-(law.accelerationCap??Infinity)/law.exhaustVelocity*(dt-linear)):m);
}
export function thrustAt(law:MassLaw,t:number):number {return Math.min(law.force,(law.accelerationCap??Infinity)*massAt(law,t));}
export function propulsiveDeltaV(law:MassLaw,t:number):number {
  return (law.steering?1:norm(law.direction))*law.exhaustVelocity*Math.log(law.mass/massAt(law,t));
}
export function intervalStep(s:Scenario,t:number,y:State,h:number,law?:MassLaw):State {
  if(!law || law.force===0)return rk4(s,t,y,h);
  const rate=(epoch:number,state:State):State=>{
    const d=derivative(s,epoch,state),a=thrustAt(law,epoch)/massAt(law,epoch),direction=directionAt(law,epoch-law.epoch);
    for(let i=0;i<3;i++)d[i+3]+=a*direction[i];return d;
  };
  const add=(base:State,d:State,h:number)=>base.map((x,i)=>x+h*d[i]) as State;
  const a=rate(t,y),b=rate(t+h/2,add(y,a,h/2)),c=rate(t+h/2,add(y,b,h/2)),d=rate(t+h,add(y,c,h));
  return y.map((x,i)=>x+h*(a[i]+2*b[i]+2*c[i]+d[i])/6) as State;
}
export function thrustBound(law?:MassLaw):number {
  return law?(law.steering?1+2e-12:norm(law.direction))*Math.min(law.force/law.nonfuel,law.accelerationCap??Infinity):0;
}
