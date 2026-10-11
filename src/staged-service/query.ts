import {sampleVessel,stateAt,type VesselView,type ViewSample} from '../model-set/model';
import {portState,surfaceNormal} from '../sim/logistics';
import {recoveredState} from '../sim/entry';
import type {Port,State,Vec3} from '../sim/schema';
import {rotate,rotateState} from '../expedition/query';

export const STAGED_PARTS=['booster','orbiter','lander'] as const;
export const STAGED_ACTORS=['stack',...STAGED_PARTS] as const;
export type StagedPart=typeof STAGED_PARTS[number];
export type StagedActor=typeof STAGED_ACTORS[number];
export interface StagedTank {id:string;fuel:number;spent:number;dryMass:number;tankCapacity:number;recovery:number}
export interface StagedSchedule {
 period:number;angle:number;pad:Port;duration:number;transport:number;refuelLead:number;maxEpoch:number;
 parts:Record<StagedPart,StagedTank>;lifetimes:Record<StagedActor,NonNullable<VesselView['lifetime']>>;seams:number[];
}
export interface StagedPlayback {schedule:StagedSchedule;templates:Record<StagedActor,VesselView>;id:StagedActor}
export type StagedVessel=VesselView&{stagedService:StagedPlayback};
export const stagedId=(index:number,id:string)=>`${index}:${id}`;
export function stagedOccurrence(p:StagedSchedule,t:number,before=false){
 if(!Number.isFinite(t)||t<0||t>p.maxEpoch)throw Error('Staged expedition epoch outside admitted range');
 let index=Math.floor(t/p.period),offset=index*p.period;
 if(index>0&&offset>t)index--;else if((index+1)*p.period<=t)index++;
 offset=index*p.period;let local=t-offset;
 if(before&&local===0&&index>0){index--;offset=index*p.period;local=p.period;}
 // Global indexed seam equality takes precedence over cancellation in t-offset.
 let lo=0,hi=p.seams.length;while(lo<hi){const mid=(lo+hi)>>>1;if(offset+p.seams[mid]<t)lo=mid+1;else hi=mid;}
 if(lo<p.seams.length&&t===offset+p.seams[lo])local=p.seams[lo];
 if(t===(index+1)*p.period-p.refuelLead)local=p.period-p.refuelLead;
 if(t===(index+1)*p.period-3)local=p.period-3;
 return {index,offset,local,angle:(index*p.angle)%(2*Math.PI)};
}
const tankFor=(id:StagedActor):StagedPart=>id==='stack'?'booster':id;
export function stagedPresent(p:StagedSchedule,id:StagedActor,t:number,before=false){
 const {local}=stagedOccurrence(p,t,before),life=p.lifetimes[id];
 if(id==='stack')return local>p.period-3||local===p.period-3&&!before||local<life.end||before&&local===life.end;
 const end=Math.min(life.end,p.parts[id].recovery+2);
 return (local>life.start||local===life.start&&!before)&&(local<end||local===end&&before);
}
export function stagedServicePresent(v:StagedVessel,t:number){return stagedPresent(v.stagedService.schedule,v.stagedService.id,t);}
export function stagedServicePresenceLabel(v:StagedVessel,t:number){
 const {schedule:p,id}=v.stagedService,{local}=stagedOccurrence(p,t);
 if(id==='stack')return 'Separated';
 if(local<p.lifetimes[id].start)return id==='lander'&&local>=p.lifetimes.orbiter.start?'Attached to orbiter':'Attached to launch stack';
 if(id==='lander'&&local>=p.lifetimes.lander.end&&local<p.parts.orbiter.recovery+p.transport)return 'Attached to orbiter';
 return 'Ground turnaround';
}
export function stagedFlightSample(p:StagedSchedule,id:StagedActor,q:ViewSample,index:number,t:number,before=false):ViewSample {
 const angle=(index*p.angle)%(2*Math.PI),part=tankFor(id),l=q.t;
 const result:ViewSample={...structuredClone(q),t,y:rotateState(q.y,angle)};
 if(result.frameOrigin)result.frameOrigin=rotateState(result.frameOrigin,angle);
 if(result.axis)result.axis=rotate(result.axis,angle);
 if(result.thrust){result.thrust.direction=rotate(result.thrust.direction,angle);result.thrust.id=stagedId(index,result.thrust.id);}
 if(result.aero)for(const key of ['airVelocity','relativeVelocity','drag','lift'] as const)result.aero[key]=rotate(result.aero[key],angle);
 result.fuelUsed=index*p.parts[part].spent+p.parts[part].fuel-q.propellant;
 if(result.logistics){result.logistics.fuelUsed=result.fuelUsed;if(id!=='stack'&&!stagedPresent(p,id,t,before))delete result.logistics.dockedPortId;}
 if(!stagedPresent(p,id,t,before))result.opacity=0;
 if((id==='booster'||id==='orbiter')&&l>=p.parts[id].recovery+1){
  result.opacity=Math.max(0,p.parts[id].recovery+2-l);delete result.entryPhase;
  result.activity={kind:'service',reason:'Ocean recovery'};
 }else result.activity={kind:result.logistics?.dockedPortId?'waiting':'flying'};
 return result;
}
export function scheduledStagedSample(p:StagedSchedule,templates:Record<StagedActor,VesselView>,id:StagedActor,t:number,provider:(id:StagedActor,t:number,before:boolean)=>ViewSample,before=false):ViewSample {
 const o=stagedOccurrence(p,t,before),part=tankFor(id),tank=p.parts[part];
 // The launch glyph can retire while all three persistent parts remain real.
 // It is restored only after every part's supported ground transport completes.
 const recovered=id==='stack'?o.local>=p.lifetimes.stack.end:o.local>=tank.recovery+2;
 if(!recovered)return stagedFlightSample(p,id,provider(id,o.local,before),o.index,t,before);
 if(id==='stack'&&(o.local<p.period-3||o.local===p.period-3&&before)){
  const q=stagedFlightSample(p,id,provider(id,p.lifetimes.stack.end,false),o.index,t);
  q.opacity=0;q.activity={kind:'service',reason:'Ground turnaround'};return q;
 }
 const refuelEpoch=(o.index+1)*p.period-p.refuelLead,refilled=t>refuelEpoch||t===refuelEpoch&&!before;
 const fuels=Object.fromEntries(STAGED_PARTS.map(key=>[key,refilled?p.parts[key].fuel:p.parts[key].fuel-p.parts[key].spent])) as Record<StagedPart,number>;
 const carrier=part==='lander'?'orbiter':part,base=templates[carrier],recovery=p.parts[carrier].recovery;
 const transportEpoch=o.offset+(recovery+p.transport),onPad=id==='stack'||t>transportEpoch||t===transportEpoch&&!before;
 const fuel=fuels[part],used=(o.index+1)*tank.spent;
 const mass=id==='stack'?STAGED_PARTS.reduce((n,key)=>n+p.parts[key].dryMass+fuels[key],0):id==='orbiter'?tank.dryMass+p.parts.lander.dryMass+fuels.orbiter+fuels.lander:tank.dryMass+fuel;
 const q:ViewSample={t,y:onPad?portState(p.pad,t):rotateState(recoveredState(base.entry!.recovery,o.local),o.angle),propellant:fuel,fuelUsed:used,mass,burnCursor:0,status:'running',detail:'',
  opacity:id==='stack'?Math.max(0,Math.min(1,o.local-(p.period-3))):0,
  axis:onPad?surfaceNormal(p.pad,t):rotate(base.samples.at(-1)!.axis??[1,0,0],o.angle),
  activity:{kind:onPad?'waiting':'service',reason:onPad?undefined:'Ground recovery transport',nextDeparture:(o.index+1)*p.period}};
 if(onPad)q.logistics={operationCursor:0,cargoMass:0,fuelUsed:used,ports:[],dockedPortId:id==='stack'?p.pad.id:undefined};
 const held=rotateState(recoveredState(base.entry!.recovery,recovery+2),o.angle),weight=Math.max(0,Math.min(1,o.local-(p.period-3)));
 q.frameOrigin=held.map((x,i)=>x+(q.y[i]-x)*weight) as State;
 if(weight===1)delete q.frameOrigin;
 // Hidden parts are not extra physical berths. They are supported members of
 // the one reassembled launch owner; accounting still retains each tank.
 return q;
}
export function stagedDrawingSample(p:StagedSchedule,templates:Record<StagedActor,VesselView>,id:StagedActor,t:number,before=false){
 const at=(part:StagedActor,local:number,left:boolean):ViewSample=>{const base=templates[part];return left?base.boundaries.find(b=>b.t===local)?.before??sampleVessel(base,local):sampleVessel(base,local);};
 return scheduledStagedSample(p,templates,id,t,(part,local,left)=>{
  const preBoost=local<p.lifetimes.stack.end||local===p.lifetimes.stack.end&&left;
  const attachedLander=part==='lander'&&(local<p.lifetimes.lander.start||local===p.lifetimes.lander.start&&left||local>p.lifetimes.lander.end||local===p.lifetimes.lander.end&&!left);
  if(part==='stack'||!preBoost&&!attachedLander)return at(part,local,left);
  const carrier=preBoost?'stack':'orbiter',q={...structuredClone(at(carrier,local,left))},tank=p.parts[part];
  const fuel=part==='booster'?q.propellant:part==='lander'&&(local>p.lifetimes.lander.end||local===p.lifetimes.lander.end&&!left)?tank.fuel-tank.spent:tank.fuel;
  q.propellant=fuel;q.fuelUsed=tank.fuel-fuel;q.mass=tank.dryMass+fuel+(part==='orbiter'?p.parts.lander.dryMass+p.parts.lander.fuel:0);
  delete q.thrust;delete q.aero;delete q.logistics;
  return q;
 },before);
}
export function sampleStagedService(v:StagedVessel,t:number):ViewSample {
 if(t<v.samples[0].t||t>v.samples.at(-1)!.t)throw Error('Staged expedition drawing epoch outside window');
 const {schedule,templates,id}=v.stagedService;return stagedDrawingSample(schedule,templates,id,t);
}

// Trail/frame projection needs only position. Avoid cloning telemetry and
// evaluating entry forces for every historical path point.
function stagedPosition(v:StagedVessel,t:number,displayOrigin:boolean):State {
 if(t<v.samples[0].t||t>v.samples.at(-1)!.t)throw Error('Staged expedition drawing epoch outside window');
 const {schedule:p,templates,id}=v.stagedService,o=stagedOccurrence(p,t);
 const ground=id==='stack'?o.local>=p.lifetimes.stack.end:o.local>=p.parts[id].recovery+2;
 if(ground){const q=sampleStagedService(v,t);return displayOrigin?q.frameOrigin??q.y:q.y;}
 const carrier=id==='stack'?'stack':o.local<p.lifetimes.booster.start?'stack':id==='lander'&&(o.local<p.lifetimes.lander.start||o.local>=p.lifetimes.lander.end)?'orbiter':id;
 return rotateState(stateAt(templates[carrier],o.local),o.angle);
}
export const stagedStateAt=(v:StagedVessel,t:number):State=>stagedPosition(v,t,false);
export const stagedDisplayOrigin=(v:StagedVessel,t:number):State=>stagedPosition(v,t,true);
