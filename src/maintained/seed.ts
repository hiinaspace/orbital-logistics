import type {State} from '../sim/schema';
import {PlanningFailure} from './shoot';
// Universal-variable f/g equations, zero-revolution prograde branch, mu=1.
// Reference: https://docs.poliastro.space/en/stable/autoapi/poliastro/core/iod/index.html
// This only seeds finite-force shooting; it is never an executed impulse plan.
export function transferSeed(from:State,to:State,duration:number,mass:number):number[] {
 const r0=Math.hypot(...from.slice(0,3)),r=Math.hypot(...to.slice(0,3)),cos=from.slice(0,3).reduce((s,x,i)=>s+x*to[i],0)/(r0*r),cross=from[0]*to[1]-from[1]*to[0];
 const A=Math.sign(cross)*Math.sqrt(r*r0*(1+Math.max(-1,Math.min(1,cos))));
 if(Math.abs(A)<1e-5)throw new PlanningFailure('Degenerate Lambert seed');
 const at=(z:number)=>{const q=Math.sqrt(Math.abs(z)),C=Math.abs(z)<1e-6?.5-z/24+z*z/720:z>0?(1-Math.cos(q))/z:(Math.cosh(q)-1)/(-z),S=Math.abs(z)<1e-6?1/6-z/120+z*z/5040:z>0?(q-Math.sin(q))/(q*q*q):(Math.sinh(q)-q)/(q*q*q),y=r0+r+A*(z*S-1)/Math.sqrt(C);return {y,time:y<0?-Infinity:Math.pow(y/C,1.5)*S+A*Math.sqrt(y)};};
 let lo=-4*Math.PI*Math.PI,hi=4*Math.PI*Math.PI-1e-5;
 for(let i=0;i<64;i++){const z=(lo+hi)/2;if(at(z).time<duration)lo=z;else hi=z;}
 const v=at((lo+hi)/2);if(!Number.isFinite(v.time)||Math.abs(v.time-duration)>1e-7 || v.y<=0)throw new PlanningFailure('Lambert seed did not converge');
 const f=1-v.y/r0,g=A*Math.sqrt(v.y),gd=1-v.y/r;
 return [...from.slice(0,3).map((x,i)=>((to[i]-f*x)/g-from[i+3])*mass/1.6),...to.slice(0,3).map((x,i)=>(to[i+3]-(gd*x-from[i])/g)*mass/1.8)];
}
