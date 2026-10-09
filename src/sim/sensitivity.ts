import {derivative} from './dynamics';
import {massAt,type MassLaw} from './propulsion';
import type {Scenario,State} from './schema';

// Derivative of an uncapped RK4 interval with respect to two inertial force
// vectors. The supplied state and mass law belong to the canonical Runner.
// At zero force use the zero mass subgradient; final Newton candidates still
// require canonical execution. Cap/depletion/steering branches use probes.
export function forceSensitivityStep(s:Scenario,t:number,y:State,h:number,law:MassLaw|undefined,pulse:number,anchorMassGradient:number[],tangent:number[]):number[] {
 const gravity=Array(9).fill(0),ve=s.ship.exhaustVelocity;
 const rate=(epoch:number,state:State,S:number[])=>{
  const dy=derivative(s,epoch,state,gravity),out=Array(36).fill(0);
  const mass=law?massAt(law,epoch):1,force=law?.direction.map(d=>d*law.force)??[0,0,0];
  for(let i=0;i<3;i++)dy[i+3]+=force[i]/mass;
  for(let j=0;j<6;j++){
   const dm=law?anchorMassGradient[j]-(Math.floor(j/3)===pulse?(epoch-law.epoch)*law.direction[j%3]*(law.force?1:0)/ve:0):0;
   for(let i=0;i<3;i++){
    out[i*6+j]=S[(i+3)*6+j];
    out[(i+3)*6+j]=gravity[i*3]*S[j]+gravity[i*3+1]*S[6+j]+gravity[i*3+2]*S[12+j]+(law?((j===pulse*3+i?1:0)/mass-force[i]*dm/mass**2):0);
   }
  }
  return {dy,out};
 };
 const add=(base:number[],d:number[],dt:number)=>base.map((v,i)=>v+dt*d[i]);
 const a=rate(t,y,tangent),b=rate(t+h/2,add(y,a.dy,h/2) as State,add(tangent,a.out,h/2)),c=rate(t+h/2,add(y,b.dy,h/2) as State,add(tangent,b.out,h/2)),d=rate(t+h,add(y,c.dy,h) as State,add(tangent,c.out,h));
 return tangent.map((v,i)=>v+h*(a.out[i]+2*b.out[i]+2*c.out[i]+d.out[i])/6);
}
