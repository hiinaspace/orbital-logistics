import type {State,Vec3} from '../sim/schema';
export const AU_KM=149597870.7,YEAR_SECONDS=365.25*86400;
export const solarNames=['Sun','Earth','Moon','Mars','Jupiter'] as const;
export interface SolarWorld {mu:number;marsPhase:number}
export const solarGMs=(mu:number)=>[mu,...[398600.435507,4902.800118,42828.375816,126712764.1].map(x=>x*YEAR_SECONDS**2/AU_KM**3)];
export const solarRadii=[695700,6378.137,1737.4,3396.2,71492].map(x=>x/AU_KM);
export function circular(t:number,r:number,mu:number,phase=0,inclination=0):State {
 const w=Math.sqrt(mu/r**3),a=phase+w*t,c=Math.cos(a),s=Math.sin(a),ci=Math.cos(inclination),si=Math.sin(inclination);
 return [r*c,r*s*ci,r*s*si,-r*w*s,r*w*c*ci,r*w*c*si];
}
export function solarStates(world:SolarWorld,t:number):State[] {
 if(!Number.isFinite(t))throw Error('Invalid solar epoch');
 const gm=solarGMs(world.mu),earth=circular(t,1,gm[0]);
 const relative=circular(t,384400/AU_KM,gm[1]+gm[2],.7,5.145*Math.PI/180);
 return [[0,0,0,0,0,0],earth,relative.map((x,i)=>x+earth[i]) as State,circular(t,1.523679,gm[0],world.marsPhase,1.85*Math.PI/180),circular(t,5.2044,gm[0],2.8,1.3*Math.PI/180)];
}
export function solarBodyState(world:SolarWorld,id:string,t:number):State {
 if(id==='Sun')return [0,0,0,0,0,0];
 if(id==='Earth')return circular(t,1,world.mu);
 if(id==='Mars')return circular(t,1.523679,world.mu,world.marsPhase,1.85*Math.PI/180);
 if(id==='Jupiter')return circular(t,5.2044,world.mu,2.8,1.3*Math.PI/180);
 if(id==='Moon'){const gm=solarGMs(world.mu),earth=circular(t,1,world.mu),relative=circular(t,384400/AU_KM,gm[1]+gm[2],.7,5.145*Math.PI/180);return relative.map((x,i)=>x+earth[i]) as State;}
 throw Error('Unknown solar body');
}
// Acceleration of the prescribed origin is necessary for body-centered physical
// integration; display transforms separately include the exact origin velocity.
export function solarBodyAcceleration(world:SolarWorld,index:number,t:number):Vec3 {
 const b=solarStates(world,t),gm=solarGMs(world.mu);
 if(index===0)return [0,0,0];
 if(index===2){const d=b[2].slice(0,3).map((x,i)=>x-b[1][i]),r=Math.hypot(...d);return d.map((x,i)=>-(gm[1]+gm[2])*x/r**3-gm[0]*b[1][i]) as Vec3;}
 const r=Math.hypot(...b[index].slice(0,3));return b[index].slice(0,3).map(x=>-gm[0]*x/r**3) as Vec3;
}
// Nonrotating heliocentric field. The indirect term accounts for acceleration
// of the Sun's origin. Major bodies remain prescribed, rather than N-body.
export function solarGravity(world:SolarWorld,t:number,y:readonly number[]):Vec3 {
 const b=solarStates(world,t),gm=solarGMs(world.mu),a:Vec3=[0,0,0];
 for(let j=0;j<b.length;j++){
  const d=b[j].slice(0,3).map((x,i)=>x-y[i]),r=Math.hypot(...d);if(!(r>solarRadii[j]))throw Error('Solar derivative inside a surface');
  const origin=j?Math.hypot(...b[j].slice(0,3)):1;
  for(let i=0;i<3;i++)a[i]+=gm[j]*d[i]/r**3-(j?gm[j]*b[j][i]/origin**3:0);
 }
 return a;
}
// Preserve the small primary-relative position when evaluating its dominant
// gravity. Adding it to an AU-sized origin and subtracting again loses digits.
export function solarGravityRelative(world:SolarWorld,t:number,y:readonly number[],reference:number):Vec3 {
 const b=solarStates(world,t),gm=solarGMs(world.mu),a:Vec3=[0,0,0];
 const moon=reference===1?circular(t,384400/AU_KM,gm[1]+gm[2],.7,5.145*Math.PI/180):undefined;
 for(let j=0;j<b.length;j++){
  const d=b[j].slice(0,3).map((x,i)=>(j===reference?0:reference===1&&j===2?moon![i]:x-b[reference][i])-y[i]),r=Math.hypot(...d);
  if(!(r>solarRadii[j]))throw Error('Solar derivative inside a surface');
  const n=j?Math.hypot(...b[j].slice(0,3)):1;
  for(let i=0;i<3;i++)a[i]+=gm[j]*d[i]/r**3-(j?gm[j]*b[j][i]/n**3:0);
 }
 return a;
}
