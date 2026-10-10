import {atmosphericStep} from './atmospheric-step';
import {massLaw,massAt} from './propulsion';
import {derivative} from './dynamics';
import {aerodynamicForces,type Atmosphere,type AeroConfiguration} from './atmosphere';
import {entryStepEnvelope,type EntryState} from './entry';
import {directionAt} from './steering';
import {norm,subtract,type State,type Vec3} from './vectors';
import type {Scenario,ThrustArc} from './schema';

export interface AtmosphericLeg {scenario:Scenario;atmosphere:Atmosphere;aero:AeroConfiguration;arcs:ThrustArc[];start:number;end:number}
export interface AtmosphericNode {t:number;z:EntryState}
export interface AtmosphericRun {definition:AtmosphericLeg;nodes:AtmosphericNode[];work:{trials:number;evaluations:number};maxima:{pressure:number;acceleration:number;heat:number;force:number}}
export function atmosphericForces(d:AtmosphericLeg,t:number,z:EntryState,arc?:ThrustArc) {
 const mass=d.scenario.ship.dryMass+d.scenario.ship.cargoMass+z[6],engine=d.scenario.ship.engine!;
 if(z.some(v=>!Number.isFinite(v))||z[6]<0||mass<=0)throw new Error('Atmospheric leg fuel depleted');
 const aero=aerodynamicForces(d.scenario.bodies[0],d.atmosphere,d.aero,t,z.slice(0,6) as State);
 const direction=arc?directionAt(arc,t-arc.start):[0,0,0] as Vec3;
 const force=arc?Math.min(engine.maxThrust*arc.throttle,(engine.maxAcceleration??Infinity)*mass):0;
 return {aero,direction,force,mass,acceleration:force/mass};
}
const active=(d:AtmosphericLeg,t:number)=>d.arcs.find(a=>a.start<=t&&t<a.end);
function step(d:AtmosphericLeg,t:number,z:EntryState,h:number,arc?:ThrustArc,check?:(t:number,z:EntryState)=>void):EntryState {
 const rate=(t:number,z:EntryState):EntryState=>{
  const f=atmosphericForces(d,t,z,arc),r=derivative(d.scenario,t,z.slice(0,6) as State);
  for(let i=0;i<3;i++)r[i+3]+=(f.aero.drag[i]+f.aero.lift[i]+f.force*f.direction[i])/f.mass;
  return [...r,-f.force/d.scenario.ship.exhaustVelocity];
 };
 return atmosphericStep(t,z,h,rate,check);
}
// Each interval owns one immutable control mode, including its RK endpoint.
// Canonical checkpoints cut every arc/key; display queries never append nodes.
export function prepareAtmosphericLeg(d:AtmosphericLeg):AtmosphericRun {
 const s=d.scenario,nodes:AtmosphericNode[]=[{t:d.start,z:[...s.ship.state,s.ship.propellant]}],work={trials:0,evaluations:0},maxima={pressure:0,acceleration:0,heat:0,force:0};
 const integrate=(end:number,depth=0):void=>{
  const a=nodes.at(-1)!,h=end-a.t,arc=active(d,(a.t+end)/2);
  if(nodes.length>=s.policy.maxNodes||++work.trials>131072)throw new Error('Atmospheric leg work budget exceeded');
  const envelope=entryStepEnvelope(d,a.t,a.z,h);
  const split=()=>{if(depth>=s.policy.maxSubdivision||a.t+h/2===a.t)throw new Error('Atmospheric leg clearance/accuracy certificate exhausted');integrate(a.t+h/2,depth+1);integrate(end,depth+1);};
  if(!envelope.safe){split();return;}
  const check=(t:number,z:EntryState)=>{
   if(++work.evaluations>524288)throw new Error('Atmospheric leg force-evaluation budget exceeded');
   if(norm(subtract(z.slice(0,3) as Vec3,a.z.slice(0,3) as Vec3))>envelope.half*(1+1e-12)||norm(subtract(z.slice(3,6) as Vec3,a.z.slice(3,6) as Vec3))>envelope.allowance*(1+1e-12))throw new Error('Atmospheric leg stage escaped enclosure');
   const f=atmosphericForces(d,t,z,arc),load=norm(f.aero.drag.map((x,i)=>x+f.aero.lift[i]+f.force*f.direction[i]) as Vec3)/f.mass;
   maxima.pressure=Math.max(maxima.pressure,f.aero.dynamicPressure);maxima.heat=Math.max(maxima.heat,f.aero.heatProxy);maxima.acceleration=Math.max(maxima.acceleration,load);maxima.force=Math.max(maxima.force,f.force);
  };
  const z=step(d,a.t,a.z,h,arc,check),mid=step(d,a.t,a.z,h/2,arc,check),fine=step(d,a.t+h/2,mid,h/2,arc,check);
  if(Math.max(...z.map((x,i)=>Math.abs(x-fine[i])/(1+Math.abs(x))))>2e-11||norm(a.z.slice(3,6) as Vec3)*h>d.atmosphere.scaleHeight*.02){split();return;}
  nodes.push({t:end,z});
 };
 const cuts=new Set([d.end,...d.arcs.flatMap(a=>[a.start,a.end,...(a.steering?.keys.map(k=>a.start+k.offset)??[])])].filter(t=>t>d.start&&t<=d.end));
 const count=Math.ceil((d.end-d.start)/s.policy.step);
 if(count>32768)throw new Error('Atmospheric leg grid budget exceeded');
 for(let i=1;i<count;i++)cuts.add(d.start+i*s.policy.step);
 const schedule=[...cuts].sort((a,b)=>a-b);
 const laws=new Map<string,ReturnType<typeof massLaw>>();
 const begin=(t:number)=>{
  for(const arc of d.arcs.filter(a=>a.start===t)){
   const n=nodes.at(-1)!,law=massLaw(s.ship.engine!,arc,s.ship.dryMass+s.ship.cargoMass,n.z[6],s.ship.exhaustVelocity);laws.set(arc.id,law);
   if((law.depletionEpoch??Infinity)<=arc.end)throw new Error('Atmospheric leg fuel depleted');
   if(law.capEpoch!==undefined&&law.capEpoch>arc.start&&law.capEpoch<arc.end&&!schedule.includes(law.capEpoch)){schedule.push(law.capEpoch);schedule.sort((a,b)=>a-b);}
  }
 };
 begin(d.start);
 for(let i=0;i<schedule.length;i++){
  const t=schedule[i];integrate(t);
  for(const arc of d.arcs.filter(a=>a.end===t)){
   const expected=massAt(laws.get(arc.id)!,t)-s.ship.dryMass-s.ship.cargoMass;
   if(Math.abs(nodes.at(-1)!.z[6]-expected)>2e-9)throw new Error('Atmospheric leg fuel-law mismatch');
  }
  begin(t);
 }

 return {definition:structuredClone(d),nodes,work,maxima};
}
export function atmosphericStateAt(run:AtmosphericRun,t:number):EntryState {
 const d=run.definition;
 if(!Number.isFinite(t)||t<d.start||t>d.end)throw new Error('Atmospheric leg query outside coverage');
 let lo=0,hi=run.nodes.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(run.nodes[mid].t<=t)lo=mid;else hi=mid-1;}
 const a=run.nodes[lo];return t===a.t?[...a.z]:step(d,a.t,a.z,t-a.t,active(d,(a.t+t)/2));
}
