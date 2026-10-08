import type {Steering} from './schema';
import type {Vec3} from './vectors';

interface Orientation {direction:Vec3;steering?:Steering}
const unit=(v:number[]):Vec3=>{const n=Math.hypot(...v);return v.map(x=>x/n) as Vec3;};
// Short great-circle turns eased with smoothstep. Angular velocity is zero at
// each key, so direction is C1 across keys. No camera or display interpolation.
export function directionAt(command:Orientation,elapsed:number):Vec3 {
  const keys=command.steering?.keys;
  if(!keys)return [...command.direction];
  if(elapsed<=keys[0].offset)return unit(keys[0].direction);
  if(elapsed>=keys.at(-1)!.offset)return unit(keys.at(-1)!.direction);
  const hi=keys.findIndex(k=>k.offset>elapsed),a=keys[hi-1],b=keys[hi];
  const x=(elapsed-a.offset)/(b.offset-a.offset),u=x*x*(3-2*x);
  const p=unit(a.direction),q=unit(b.direction),dot=Math.max(-1,Math.min(1,p.reduce((s,v,i)=>s+v*q[i],0)));
  if(dot>1-1e-10)return unit(p.map((v,i)=>(1-u)*v+u*q[i]));
  const theta=Math.acos(dot),den=Math.sin(theta);
  return unit(p.map((v,i)=>(Math.sin((1-u)*theta)*v+Math.sin(u*theta)*q[i])/den));
}
