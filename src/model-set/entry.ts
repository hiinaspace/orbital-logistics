import {validateBundle,type State,type Vec3,type Scenario} from '../sim/schema';
import {bodyState} from '../sim/dynamics';
import {dot,norm,scale,subtract} from '../sim/vectors';
import {entryForces,entryStep,entryStepEnvelope,recoveredState,type EntryPhysics,type EntryState,type RecoveryPose} from '../sim/entry';
import type {SceneView,VesselView,ViewSample,ViewerEvent} from './model';

export interface EntryFlight extends EntryPhysics {
 kind:'entry-flight-v1';schemaVersion:1;modelVersion:'entry-rk4-v1';
 id:string;name:string;extent:number;description:string;provenance:string;
 limits:{dynamicPressure:number;acceleration:number;heatProxy:number};
 presentation:{name:string;color:string;heatScale:number};
 rotating:{name:string;rate:number;phase:number};
}
export const isEntry=(d:unknown):d is EntryFlight=>!!d&&typeof d==='object'&&(d as EntryFlight).kind==='entry-flight-v1';
const object=(x:unknown):Record<string,unknown>=>{if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('Invalid entry object');return x as Record<string,unknown>;};
const text=(x:unknown)=>{if(typeof x!=='string'||!x.length||x.length>2048)throw new Error('Invalid entry text');return x;};
const finite=(x:unknown,min=0,max=Infinity)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw new Error('Invalid entry number');return x;};
const vector=(x:unknown):Vec3=>{if(!Array.isArray(x)||x.length!==3)throw new Error('Invalid entry vector');return x.map(v=>finite(v,-Infinity)) as Vec3;};
export function validateEntry(value:unknown):EntryFlight {
 const d=object(value);
 if(d.kind!=='entry-flight-v1'||d.schemaVersion!==1||d.modelVersion!=='entry-rk4-v1')throw new Error('Unsupported atmospheric entry version');
 const keys=(o:Record<string,unknown>,allowed:string[])=>{if(Object.keys(o).some(k=>!allowed.includes(k)))throw new Error('Unknown entry physical field');};
 keys(d,['kind','schemaVersion','modelVersion','id','name','extent','description','provenance','scenario','atmosphere','aero','guidance','recovery','limits','presentation','rotating']);
 const raw=object(d.scenario);
 if(raw.logistics!==undefined||raw.rendezvous!==undefined)throw new Error('Entry exhibit cannot use legacy logistics or targeting');
 keys(raw,['schemaVersion','modelVersion','id','units','epoch','duration','policy','bodies','ship']);
 keys(object(raw.policy),['step','maxNodes','maxSubdivision']);keys(object(raw.ship),['id','state','dryMass','cargoMass','propellant','tankCapacity','exhaustVelocity','engine']);keys(object(object(raw.ship).engine),['maxThrust','maxAcceleration']);
 if(!Array.isArray(raw.bodies))throw new Error('Invalid entry bodies');
 for(const body of raw.bodies){keys(object(body),['id','mu','radius','rail']);keys(object(object(body).rail),['kind','position']);}
 const scenario=validateBundle({scenario:raw,program:{schemaVersion:3,id:'entry-validation',burns:[]}}).scenario;
 if(scenario.bodies.length!==1||scenario.bodies[0].rail.kind!=='fixed'||!scenario.ship.engine||scenario.epoch!==0||scenario.duration>8||scenario.policy.maxNodes>32768||scenario.policy.step>1/512)throw new Error('Unsupported entry world/work budget');
 const a=object(d.atmosphere),c=object(d.aero),g=object(d.guidance),r=object(d.recovery),l=object(d.limits),p=object(d.presentation),rotation=object(d.rotating);
 keys(a,['bodyId','spin','density','scaleHeight','fadeHeight','topHeight']);keys(c,['dragArea','liftToDrag','liftFadeHeight']);
 keys(g,['startHeight','fullHeight','descentSpeed','descentGain','velocityGain']);keys(r,['height','maxSpeed']);keys(l,['dynamicPressure','acceleration','heatProxy']);
 const atmosphere={bodyId:text(a.bodyId),spin:vector(a.spin),density:finite(a.density),scaleHeight:finite(a.scaleHeight,1e-6),fadeHeight:finite(a.fadeHeight,1e-6),topHeight:finite(a.topHeight,1e-6)};
 if(atmosphere.bodyId!==scenario.bodies[0].id||atmosphere.spin[0]!==0||atmosphere.spin[1]!==0||scenario.ship.state[2]!==0||scenario.ship.state[5]!==0||norm(atmosphere.spin)>1||atmosphere.fadeHeight>=atmosphere.topHeight||atmosphere.topHeight>scenario.bodies[0].radius)throw new Error('Invalid atmosphere extent/rotation');
 const aero={dragArea:finite(c.dragArea),liftToDrag:finite(c.liftToDrag,-1,1),liftFadeHeight:finite(c.liftFadeHeight,1e-6)};
 const guidance={startHeight:finite(g.startHeight,1e-6),fullHeight:finite(g.fullHeight,1e-6),descentSpeed:finite(g.descentSpeed,1e-6),descentGain:finite(g.descentGain),velocityGain:finite(g.velocityGain,1e-6)};
 const recovery={height:finite(r.height,1e-6),maxSpeed:finite(r.maxSpeed,1e-6)};
 if(guidance.fullHeight>=guidance.startHeight||guidance.startHeight>=atmosphere.fadeHeight||recovery.height>=guidance.fullHeight)throw new Error('Invalid entry guidance heights');
 if(norm(subtract(scenario.ship.state.slice(0,3) as Vec3,bodyState(scenario.bodies[0],0).slice(0,3) as Vec3))<=scenario.bodies[0].radius+atmosphere.topHeight)throw new Error('Entry must begin above atmosphere');
 const presentation={name:text(p.name),color:text(p.color),heatScale:finite(p.heatScale,1e-6)};
 if(!/^#[0-9a-f]{6}$/i.test(presentation.color))throw new Error('Invalid entry color');
 const rotating={name:text(rotation.name),rate:finite(rotation.rate,-Infinity),phase:finite(rotation.phase,-Infinity)};
 return {kind:'entry-flight-v1',schemaVersion:1,modelVersion:'entry-rk4-v1',id:text(d.id),name:text(d.name),extent:finite(d.extent,1e-6),description:text(d.description),provenance:text(d.provenance),scenario,atmosphere,aero,guidance,recovery,
 limits:{dynamicPressure:finite(l.dynamicPressure,1e-6),acceleration:finite(l.acceleration,1e-6),heatProxy:finite(l.heatProxy,1e-6)},presentation,rotating};
}
export interface EntryNode {t:number;z:EntryState}
export interface EntryResult {
 definition:EntryFlight;nodes:EntryNode[];contact:{t:number;before:EntryState;pose:RecoveryPose;relativeSpeed:number;waterEnergy:number;impulse:Vec3};
 entryEpoch:number;brakingEpoch:number;work:{trials:number;evaluations:number;roots:number};maxima:{pressure:number;acceleration:number;heat:number;force:number};view:SceneView;
}
export function prepareEntry(value:unknown):EntryResult {
 const definition=validateEntry(value),d=definition,s=d.scenario,body=s.bodies[0],initial=[...s.ship.state,s.ship.propellant] as EntryState;
 const work={trials:0,evaluations:0,roots:0};
 const nodes:EntryNode[]=[{t:0,z:initial}],maxima={pressure:0,acceleration:0,heat:0,force:0};
 let contact:EntryResult['contact']|undefined,entryEpoch=Infinity,brakingEpoch=Infinity;
 const altitude=(z:EntryState)=>norm(subtract(z.slice(0,3) as Vec3,bodyState(body,0).slice(0,3) as Vec3))-body.radius;
 const check=(t:number,z:EntryState)=>{
  if(++work.evaluations>524288)throw new Error('Entry force-evaluation budget exceeded');
  const f=entryForces(d,t,z),acceleration=norm(f.aero.drag.map((x,i)=>x+f.aero.lift[i]+f.force[i]) as Vec3)/f.mass;
  if(f.aero.dynamicPressure>d.limits.dynamicPressure||acceleration>d.limits.acceleration||f.aero.heatProxy>d.limits.heatProxy)throw new Error('Atmospheric entry load limit exceeded');
  maxima.pressure=Math.max(maxima.pressure,f.aero.dynamicPressure);maxima.acceleration=Math.max(maxima.acceleration,acceleration);maxima.heat=Math.max(maxima.heat,f.aero.heatProxy);maxima.force=Math.max(maxima.force,norm(f.force));
 };
 const integrate=(end:number,depth=0):void=>{
  if(contact)return;
  const a=nodes.at(-1)!,h=end-a.t;
  if(nodes.length>=s.policy.maxNodes)throw new Error('Entry retained-node budget exceeded');
  if(++work.trials>131072)throw new Error('Entry trial-step budget exceeded');
  const envelope=entryStepEnvelope(d,a.t,a.z,h);
  const split=()=>{
   if(depth>=s.policy.maxSubdivision||a.t+h/2===a.t)throw new Error('Entry clearance/accuracy certificate exhausted');
   integrate(a.t+h/2,depth+1);integrate(end,depth+1);
  };
  if(!envelope.safe) {
   split();return;
  }
  const stageCheck=(t:number,z:EntryState)=>{
   if(norm(subtract(z.slice(0,3) as Vec3,a.z.slice(0,3) as Vec3))>envelope.half*(1+1e-12)||norm(subtract(z.slice(3,6) as Vec3,a.z.slice(3,6) as Vec3))>envelope.allowance*(1+1e-12))throw new Error('Entry stage escaped enclosure');
   check(t,z);
  };
  const z=entryStep(d,a.t,a.z,h,stageCheck),middle=entryStep(d,a.t,a.z,h/2,stageCheck),fine=entryStep(d,a.t+h/2,middle,h/2,stageCheck);
  const error=Math.max(...z.map((v,i)=>Math.abs(v-fine[i])/(1+Math.abs(v))));
  const radial=dot(a.z.slice(3,6) as Vec3,scale(subtract(a.z.slice(0,3) as Vec3,bodyState(body,a.t).slice(0,3) as Vec3),1/(body.radius+altitude(a.z))));
  if(error>2e-11 || Math.abs(radial)*h>d.atmosphere.scaleHeight*.02 || h*d.guidance.velocityGain>.02) {split();return;}
  check(end,z);
  const radius=body.radius+altitude(a.z),speed=norm(a.z.slice(3,6) as Vec3);
  // A bound on r'' proves descent stays monotonic near the support shell.
  // Equal endpoint signs are never used to exclude a hidden grazing crossing.
  const radialChange=(envelope.bound+(speed+envelope.allowance)**2/(radius-envelope.half))*h;
  const monotonic=radial+radialChange<0;
  if(altitude(a.z)-d.recovery.height<=speed*h+envelope.bound*h*h/2 && !monotonic){split();return;}
  if(altitude(z)<=d.recovery.height) {
   // Find first descending support crossing from one certified canonical
   // interval. The event is independent of display/playback query times.
   let lo=0,hi=h;
   for(let i=0;i<48;i++){work.roots++;const mid=(lo+hi)/2;if(altitude(entryStep(d,a.t,a.z,mid,stageCheck))>d.recovery.height)lo=mid;else hi=mid;}
   const t=a.t+hi,before=entryStep(d,a.t,a.z,hi,stageCheck),f=entryForces(d,t,before),relativeSpeed=norm(f.aero.relativeVelocity);
   if(dot(f.aero.relativeVelocity,subtract(before.slice(0,3) as Vec3,bodyState(body,t).slice(0,3) as Vec3))>=0||relativeSpeed+1e-7>d.recovery.maxSpeed)throw new Error('Unsafe ocean recovery speed');
   const y=before.slice(0,6) as State,pose={t,y,spin:[...d.atmosphere.spin] as Vec3,center:bodyState(body,t).slice(0,3) as Vec3};
   contact={t,before,pose,relativeSpeed,waterEnergy:.5*f.mass*relativeSpeed**2,impulse:scale(f.aero.relativeVelocity,-f.mass)};nodes.push({t,z:before});return;
  }
  nodes.push({t:end,z});
 };
 for(let i=1;i<=Math.round(s.duration/s.policy.step)&&!contact;i++) {
  integrate(i*s.policy.step);
  const n=nodes.at(-1)!,f=entryForces(d,n.t,n.z);
  if(entryEpoch===Infinity&&f.aero.density>0)entryEpoch=n.t;
  if(brakingEpoch===Infinity&&f.engagement>0)brakingEpoch=n.t;
 }
 if(!contact)throw new Error('Entry exhibit did not reach ocean recovery');
 if(contact.before[6]<1e-6)throw new Error('Entry recovery requires positive fuel margin');
 if(!Number.isFinite(entryEpoch)||!Number.isFinite(brakingEpoch))throw new Error('Entry phases missing');
 const actual=contact as EntryResult['contact'];
 const metadata={physics:{scenario:s,atmosphere:d.atmosphere,aero:d.aero,guidance:d.guidance,recovery:d.recovery},recovery:actual.pose,brakingEpoch,entryEpoch,heatScale:d.presentation.heatScale};
 const sample=(t:number,before=false):ViewSample=>{
  const z=entryStateAt({definition:d,nodes,contact:actual},t,before),recovered=!before&&t>=actual.t;
  const f=entryForces(d,Math.min(t,actual.t),z);
  return {t,y:recovered?recoveredState(actual.pose,t):z.slice(0,6) as State,propellant:z[6],fuelUsed:s.ship.propellant-z[6],mass:s.ship.dryMass+s.ship.cargoMass+z[6],burnCursor:0,status:t===s.duration?'horizon':'running',detail:'',
   entryPhase:recovered?'recovered':t>=brakingEpoch?'braking':t>=entryEpoch?'entry':'coast',axis:recovered?scale(subtract(recoveredState(actual.pose,t).slice(0,3) as Vec3,actual.pose.center),1/norm(subtract(actual.pose.y.slice(0,3) as Vec3,actual.pose.center))):f.axis,
   ...(recovered?{}:{aero:f.aero,...(norm(f.force)>0?{thrust:{id:'terminal-braking',force:norm(f.force),acceleration:norm(f.force)/f.mass,direction:scale(f.force,1/norm(f.force))}}:{})})};
 };
 const events:ViewerEvent[]=[
  {t:entryEpoch,kind:'entry',id:'atmospheric-entry',deltaV:0,fuelUsed:0,propellantBefore:s.ship.propellant,propellantAfter:s.ship.propellant},
  {t:brakingEpoch,kind:'thrust-start',id:'terminal-braking',deltaV:0,fuelUsed:0,propellantBefore:s.ship.propellant,propellantAfter:s.ship.propellant},
  {t:actual.t,kind:'thrust-end',id:'terminal-braking',deltaV:s.ship.exhaustVelocity*Math.log((s.ship.dryMass+s.ship.cargoMass+s.ship.propellant)/(s.ship.dryMass+s.ship.cargoMass+actual.before[6])),fuelUsed:s.ship.propellant-actual.before[6],propellantBefore:s.ship.propellant,propellantAfter:actual.before[6]},
  {t:actual.t,kind:'splashdown',id:'ocean-recovery',deltaV:0,fuelUsed:0,propellantBefore:actual.before[6],propellantAfter:actual.before[6],detail:'Ocean dissipates relative impact kinetic energy'}];
 const times=[...new Set([...Array.from({length:Math.ceil(s.duration*2048)+1},(_,i)=>i*s.duration/Math.ceil(s.duration*2048)),...events.map(e=>e.t)])].sort((a,b)=>a-b);
 const vessel:VesselView={id:s.ship.id,name:d.presentation.name,color:d.presentation.color,cargo:'Freight',ship:s.ship,ports:[],cargoCapacity:s.ship.cargoMass,arcs:[],continuousFuel:true,portSamples:{},glyph:'rocket',initialAxis:[0,1,0],entry:metadata,samples:times.map(t=>sample(t)),ledger:events,boundaries:[{t:actual.t,before:sample(actual.t,true),after:sample(actual.t)}]};
 const view:SceneView={schemaVersion:1,id:d.id,name:d.name,extent:d.extent,description:d.description,provenance:d.provenance,stations:[],rotating:d.rotating,vessels:[vessel],portSamples:{},world:{bodies:s.bodies,ports:[],units:s.units},window:{start:0,end:s.duration},atmosphere:d.atmosphere,entry:{recoveryEpoch:actual.t,relativeSpeed:actual.relativeSpeed,waterEnergy:actual.waterEnergy,maxima,impulse:actual.impulse,work}};
 if(new TextEncoder().encode(JSON.stringify(view)).byteLength>12_000_000)throw new Error('Entry display packet budget exceeded');
 return {definition:d,nodes,contact:actual,entryEpoch,brakingEpoch,work,maxima,view};
}
export function entryStateAt(run:Pick<EntryResult,'definition'|'nodes'|'contact'>,t:number,before=false):EntryState {
 if(!Number.isFinite(t)||t<0||t>run.definition.scenario.duration)throw new Error('Entry epoch outside exhibit');
 if(t>=run.contact.t)return [...(!before?recoveredState(run.contact.pose,t):run.contact.before.slice(0,6) as State),run.contact.before[6]];
 let lo=0,hi=run.nodes.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(run.nodes[mid].t<=t)lo=mid;else hi=mid-1;}
 const n=run.nodes[lo];return t===n.t?[...n.z]:entryStep(run.definition,n.t,n.z,t-n.t);
}
