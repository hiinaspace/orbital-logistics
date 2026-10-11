import {ExpeditionViewStore} from './view';
import {ExpeditionEngine,type ExpeditionDefinition,EXPEDITION_LEAD,HISTORY,type PreparedExpeditionCycle} from './engine';
import {scheduledSample,type ExpeditionSchedule} from './query';
import {OrbiterStream,type OrbiterDefinition,type OrbiterDelta} from './orbiter';
import type {SceneView,ViewSample,ViewerEvent} from '../model-set/model';
import type {Port} from '../sim/schema';
import type {ResourceAnchor,Depot} from '../traffic/resources';

export interface ExpeditionActor {id:string;name:string;color:string;phase:number;padId:string}
export interface ExpeditionFleetDefinition {domain:'apollo-fleet-v1';schemaVersion:1;id:string;name:string;description:string;provenance:string;source:ExpeditionDefinition;actors:ExpeditionActor[];orbiter:OrbiterDefinition}
export const isExpeditionFleet=(d:unknown):d is ExpeditionFleetDefinition=>!!d&&typeof d==='object'&&(d as ExpeditionFleetDefinition).domain==='apollo-fleet-v1';
export interface ExpeditionFleetEvent extends ViewerEvent {shipId:string}
export interface ExpeditionFleetDelta {
 domain:'apollo-fleet-v1';frontier:number;oldest:number;template?:SceneView;schedules:ExpeditionSchedule[];current:ViewSample[];
 preparedCycles:PreparedExpeditionCycle[][];resources:ResourceAnchor[];events:ExpeditionFleetEvent[];orbiter:OrbiterDelta;stats:Record<string,number>;halt?:string;
}
export class ExpeditionFleetEngine {
 readonly definition:ExpeditionFleetDefinition;readonly seed:ExpeditionEngine;readonly schedules:ExpeditionSchedule[];readonly ports:Port[];readonly orbiter:OrbiterStream;
 frontier=0;oldest=0;halt?:string;#sent=false;#orbiterAfter=-1;#counts=[0,0];#views:ExpeditionViewStore[];#resources:ResourceAnchor[];#events:ExpeditionFleetEvent[]=[];
 constructor(value:ExpeditionFleetDefinition){
  if(!isExpeditionFleet(value)||value.schemaVersion!==1||!value.id||!value.name||value.actors.length!==2||value.actors[0].phase!==0||value.actors[1].phase!==.5||value.actors.some(a=>!a.id||!a.name||!/^#[0-9a-f]{6}$/i.test(a.color)||!Number.isFinite(a.phase)||a.phase<0||a.phase>=1)||!/^#[0-9a-f]{6}$/i.test(value.orbiter.color))throw Error('Invalid expedition fleet');
  this.definition=structuredClone(value);this.#views=value.actors.map(()=>new ExpeditionViewStore(value.source));this.seed=new ExpeditionEngine(value.source);
  const p=this.seed.schedule,moon=this.seed.prepared.definition.scenario.bodies[1].rail;
  if(moon.kind!=='circular')throw Error('Invalid fleet Moon');
  this.schedules=value.actors.map(a=>{
   const epochOffset=a.phase*p.period,pad=structuredClone(p.pad);
   if(pad.rail.kind!=='surface')throw Error('Invalid fleet support');
   pad.id=a.padId;pad.rail.phase+=2*Math.PI*a.phase;
   return {...p,pad,instance:{id:a.id,name:a.name,color:a.color,epochOffset,rotationOffset:moon.rate*epochOffset,sourcePadId:p.pad.id}};
  });
  this.ports=[...this.schedules.map(p=>p.pad),...this.seed.prepared.definition.ports.filter(q=>q.id!==p.pad.id)];
  const ids=[...this.ports.map(p=>p.id),...value.actors.map(a=>a.id),value.orbiter.id,...this.seed.prepared.definition.scenario.bodies.map(b=>b.id)];
  if(ids.some(id=>!id)||new Set(ids).size!==ids.length)throw Error('Fleet identity collision');
  const d=this.seed.prepared.definition;
  // Half-open supported lunar visits, admitted over a periodic seam too.
  for(let i=0;i<this.schedules.length;i++)for(let j=i+1;j<this.schedules.length;j++)for(const turn of [-1,0,1]){
   const a=this.schedules[i].instance!.epochOffset,b=this.schedules[j].instance!.epochOffset+turn*p.period;
   if(Math.max(a+d.landing,b+d.landing)<Math.min(a+d.liftoff,b+d.liftoff))throw Error('Fleet lunar berth overlap');
  }
  this.#resources=[this.#resource(0,this.#counts)];
  this.orbiter=new OrbiterStream(d.scenario,value.orbiter,d.scenario.bodies[0].radius+d.entry.atmosphere.topHeight);
 }
 sample(index:number,t:number,before=false){return scheduledSample(this.schedules[index],this.seed.prepared.view.vessels[0],t,(local,left)=>this.seed.prepared.sample(local,left),before);}
 #resource(t:number,counts:number[]):ResourceAnchor{return {t,stocks:this.ports.map(p=>({id:p.id,cargo:0,propellant:0})),cargoImported:0,cargoExported:0,fuelImported:counts.reduce((n,k)=>n+k*this.seed.schedule.spent,0),fuelExported:0};}
 advanceTo(target:number){
  const max=this.seed.schedule.maxEpoch;
  if(!Number.isFinite(target)||target<this.frontier||target>max||target-this.frontier>(this.frontier===0?32:8))throw Error('Fleet advance outside work budget');
  const counts=[...this.#counts],events:ExpeditionFleetEvent[]=[],resources:ResourceAnchor[]=[];
  const due:{t:number;actor:number;count:number}[]=[];
  for(const [i,p] of this.schedules.entries())for(let count=counts[i]+1;;count++){const t=p.instance!.epochOffset+count*p.period-p.refuelLead;if(t>target)break;due.push({t,actor:i,count});if(due.length>4)throw Error('Fleet transaction work budget');}
  due.sort((a,b)=>a.t-b.t||a.actor-b.actor);
  for(const op of due){const p=this.schedules[op.actor],before=this.sample(op.actor,op.t,true),after=this.sample(op.actor,op.t),amount=after.propellant-before.propellant;
   if(before.logistics?.dockedPortId!==p.pad.id||amount<0||amount>this.definition.source.maxImport+1e-10||Math.abs(amount-p.spent)>1e-10)throw Error('Fleet refuel invariant');
   counts[op.actor]=op.count;resources.push(this.#resource(op.t,counts));events.push({t:op.t,kind:'transfer',shipId:p.instance!.id,id:p.instance!.id+':'+op.count+':ground-refuel',portId:p.pad.id,deltaV:0,fuelUsed:0,propellantBefore:before.propellant,propellantAfter:after.propellant,detail:'Ground supply imported '+amount.toFixed(6)+' propellant; depot debited into ship'});
  }
  // Private coast extension completes before shared facts are published.
  this.orbiter.extend(Math.min(max,target+EXPEDITION_LEAD));
  this.#counts=counts;this.#events.push(...events);this.#resources.push(...resources);this.frontier=target;this.oldest=Math.max(0,target-HISTORY);
  if(target===max)this.halt='Exhibit calendar ended';
  this.#events=this.#events.filter(e=>e.t>=this.oldest);let i=0;while(i+1<this.#resources.length&&this.#resources[i+1].t<=this.oldest)i++;this.#resources=this.#resources.slice(i);
 }
 delta():ExpeditionFleetDelta{
  const orbiter=this.orbiter.delta(this.#orbiterAfter,this.oldest,this.frontier);this.#orbiterAfter=this.orbiter.end;
  const current=this.schedules.map((_,i)=>this.sample(i,this.frontier));
  const end=Math.min(this.seed.schedule.maxEpoch,this.frontier+EXPEDITION_LEAD);
  const preparedCycles=this.#views.map((view,i)=>{view.ingest({domain:'apollo-continuous-v1',frontier:this.frontier,oldest:this.oldest,schedule:this.schedules[i],current:current[i],resources:this.#resources,events:this.#events.filter(e=>e.shipId===this.definition.actors[i].id),stats:{},...(!this.#sent?{template:this.seed.prepared.view}:{})});view.view(this.frontier,end);return view.exportPreparedCycles();});
  const p=this.seed.schedule,stats={planningPending:0,cacheCompilations:1,cacheHits:this.schedules.reduce((n,s)=>n+Math.max(0,Math.floor((this.frontier-s.instance!.epochOffset)/p.period)),0),completedTrips:this.schedules.reduce((n,s)=>n+Math.max(0,Math.floor((this.frontier-s.instance!.epochOffset-p.recovery)/p.period)+1),0),refills:this.#counts.reduce((n,k)=>n+k,0),physicsBytes:this.seed.prepared.work.physicsBytes+orbiter.physicsBytes,physicalNodes:this.seed.prepared.work.nodes+orbiter.nodes,packetBytes:0,orbiterFault:this.orbiter.fault?1:0,workerDrawingBytes:this.#views.reduce((n,v)=>n+v.stats.retainedDrawingBytes,0),workerDrawingSamples:this.#views.reduce((n,v)=>n+v.stats.retainedDrawingSamples,0)};
  const packet:ExpeditionFleetDelta={domain:'apollo-fleet-v1',frontier:this.frontier,oldest:this.oldest,schedules:this.schedules,current,preparedCycles,resources:this.#resources,events:this.#events,orbiter,stats,halt:this.halt};
  if(!this.#sent){packet.template=this.seed.prepared.view;this.#sent=true;}
  stats.packetBytes=new TextEncoder().encode(JSON.stringify(packet)).byteLength;
  if(stats.packetBytes>(packet.template?32_000_000:12_000_000)||stats.workerDrawingBytes>72_000_000||stats.workerDrawingSamples>240000||stats.physicsBytes>40_000_000||stats.physicalNodes>115000)throw Error('Fleet aggregate physical/packet budget');
  return packet;
 }
 depots():Depot[]{return this.ports.map(p=>({id:p.id,role:'Surface terminal',berths:1,cargo:0,cargoCapacity:1,propellant:0,tankCapacity:this.definition.source.maxImport,cargoRate:0,propellantRate:0}));}
}
